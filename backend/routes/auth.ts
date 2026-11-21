import { Router } from 'express';
import crypto from 'node:crypto';
import { db, sanitizeUser } from '../db.ts';
import {
  generateAppUserId,
  generateDemoOtp,
  generateIndiaDemoNumber,
  hashOtp,
  hashPassword,
  signToken,
  verifyOtpHash,
  verifyPassword,
} from '../crypto.ts';
import { requireUserAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const authRouter = Router();

function createUniqueDemoNumber(): string {
  for (let i = 0; i < 10; i++) {
    const candidate = generateIndiaDemoNumber();
    const existing = db.prepare('SELECT id FROM users WHERE demo_virtual_number = ?').get(candidate);
    if (!existing) return candidate;
  }
  return `+91 90009 ${crypto.randomInt(10000, 99999)}`;
}

function createUniqueAppUserId(): string {
  for (let i = 0; i < 10; i++) {
    const candidate = generateAppUserId();
    const existing = db.prepare('SELECT id FROM users WHERE app_user_id = ?').get(candidate);
    if (!existing) return candidate;
  }
  return `ESC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

authRouter.get('/demo-accounts', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, app_user_id, full_name, email, demo_virtual_number, avatar_url, bio, is_online
       FROM users
       WHERE email LIKE '%@esimconnect.demo'
       ORDER BY created_at ASC`
    )
    .all();
  res.json({ accounts: rows });
});

authRouter.post('/register', (req, res) => {
  const { fullName, email, password, bio } = req.body ?? {};
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters' });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Valid email address is required' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const userId = crypto.randomUUID();
  const appUserId = createUniqueAppUserId();
  const demoVirtualNumber = createUniqueDemoNumber();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (
      id, app_user_id, full_name, email, password_hash, demo_virtual_number,
      bio, account_status, otp_verified, is_online
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0)`
  ).run(
    userId,
    appUserId,
    fullName.trim(),
    normalizedEmail,
    passwordHash,
    demoVirtualNumber,
    typeof bio === 'string' && bio.trim() ? bio.trim() : 'Using eSIM Connect internet calling'
  );

  // Add seeded directory contacts automatically for quick local testing
  const existingContacts = db.prepare('SELECT id FROM users WHERE id != ? LIMIT 4').all(userId) as Array<{ id: string }>;
  const insertContact = db.prepare(
    'INSERT OR IGNORE INTO contacts (id, owner_user_id, contact_user_id, is_favorite) VALUES (?, ?, ?, 0)'
  );
  for (const peer of existingContacts) {
    insertContact.run(crypto.randomUUID(), userId, peer.id);
    insertContact.run(crypto.randomUUID(), peer.id, userId);
  }

  // Generate local Demo OTP (stored hashed, never plaintext)
  const otp = generateDemoOtp();
  const otpHash = hashOtp(otp, userId);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  db.prepare(
    `INSERT INTO demo_otps (id, user_id, otp_hash, purpose, expires_at, consumed)
     VALUES (?, ?, ?, 'verification', ?, 0)`
  ).run(crypto.randomUUID(), userId, otpHash, expiresAt);

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  const token = signToken({ sub: userId, role: 'user', email: normalizedEmail });

  res.status(201).json({
    token,
    user: sanitizeUser(userRow),
    demoOtp: {
      code: otp,
      expiresAt,
      disclaimer: 'DEMO OTP ONLY — Generated locally for in-app testing. Cannot verify third-party telecom services.',
    },
  });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as
    | (Record<string, unknown> & { id: string; password_hash: string; account_status: string; email: string })
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  if (row.account_status === 'suspended') {
    res.status(403).json({ error: 'This account has been suspended by an administrator' });
    return;
  }

  const token = signToken({ sub: row.id, role: 'user', email: row.email });
  res.json({
    token,
    user: sanitizeUser(row),
  });
});

authRouter.post('/demo-otp/generate', requireUserAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const otp = generateDemoOtp();
  const otpHash = hashOtp(otp, userId);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  db.prepare(`UPDATE demo_otps SET consumed = 1 WHERE user_id = ? AND purpose = 'verification' AND consumed = 0`).run(userId);
  db.prepare(
    `INSERT INTO demo_otps (id, user_id, otp_hash, purpose, expires_at, consumed)
     VALUES (?, ?, ?, 'verification', ?, 0)`
  ).run(crypto.randomUUID(), userId, otpHash, expiresAt);

  res.json({
    demoOtp: {
      code: otp,
      expiresAt,
      disclaimer: 'DEMO OTP ONLY — Generated locally for in-app testing. Cannot verify third-party telecom services.',
    },
  });
});

authRouter.post('/demo-otp/verify', requireUserAuth, (req: AuthenticatedRequest, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ error: 'Enter a valid 6-digit demo OTP code' });
    return;
  }
  const userId = req.user!.id;
  const record = db
    .prepare(
      `SELECT * FROM demo_otps
       WHERE user_id = ? AND purpose = 'verification' AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId) as { id: string; otp_hash: string; expires_at: string } | undefined;

  if (!record) {
    res.status(400).json({ error: 'No active demo OTP found. Generate a new code first.' });
    return;
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Demo OTP expired. Request a new code.' });
    return;
  }
  if (!verifyOtpHash(code.trim(), userId, record.otp_hash)) {
    res.status(400).json({ error: 'Incorrect demo OTP code' });
    return;
  }

  db.prepare('UPDATE demo_otps SET consumed = 1 WHERE id = ?').run(record.id);
  db.prepare('UPDATE users SET otp_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  res.json({
    verified: true,
    user: sanitizeUser(updated),
  });
});

authRouter.post('/password-reset/request', (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'No registered user found with that email' });
    return;
  }

  const otp = generateDemoOtp();
  const otpHash = hashOtp(otp, user.id);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  db.prepare(`UPDATE demo_otps SET consumed = 1 WHERE user_id = ? AND purpose = 'password_reset' AND consumed = 0`).run(user.id);
  db.prepare(
    `INSERT INTO demo_otps (id, user_id, otp_hash, purpose, expires_at, consumed)
     VALUES (?, ?, ?, 'password_reset', ?, 0)`
  ).run(crypto.randomUUID(), user.id, otpHash, expiresAt);

  res.json({
    message: 'Local demo password reset OTP generated.',
    demoOtp: {
      code: otp,
      expiresAt,
      disclaimer: 'DEMO OTP ONLY — Generated locally for password reset testing. No real SMS sent.',
    },
  });
});

authRouter.post('/password-reset/confirm', (req, res) => {
  const { email, code, newPassword } = req.body ?? {};
  if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'Email, demo OTP code, and new password are required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const record = db
    .prepare(
      `SELECT * FROM demo_otps
       WHERE user_id = ? AND purpose = 'password_reset' AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(user.id) as { id: string; otp_hash: string; expires_at: string } | undefined;

  if (!record || new Date(record.expires_at).getTime() < Date.now() || !verifyOtpHash(code.trim(), user.id, record.otp_hash)) {
    res.status(400).json({ error: 'Invalid or expired password reset demo OTP' });
    return;
  }

  db.prepare('UPDATE demo_otps SET consumed = 1 WHERE id = ?').run(record.id);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hashPassword(newPassword),
    user.id
  );

  res.json({ reset: true, message: 'Password updated successfully. You can now sign in.' });
});

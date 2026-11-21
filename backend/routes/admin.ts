import { Router } from 'express';
import { db, sanitizeUser } from '../db.ts';
import { hashPassword, signToken, timingSafeCompareStrings, verifyPassword } from '../crypto.ts';
import { requireAdminAuth } from '../middleware/auth.ts';
import { disconnectUserSockets } from '../socket.ts';

export const adminRouter = Router();

function getAdminState() {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
  const storedRow = db
    .prepare("SELECT value FROM admin_settings WHERE key = 'admin_passcode_hash'")
    .get() as { value: string } | undefined;

  return {
    envConfigured: envPasscode.length > 0,
    claimed: Boolean(storedRow?.value),
    configured: envPasscode.length > 0 || Boolean(storedRow?.value),
    storedHash: storedRow?.value || null,
    envPasscode,
  };
}

adminRouter.get('/status', (_req, res) => {
  const state = getAdminState();
  res.json({
    configured: state.configured,
    envOverride: state.envConfigured,
  });
});

adminRouter.post('/claim', (req, res) => {
  const state = getAdminState();
  if (state.configured) {
    res.status(409).json({ error: 'Admin passcode is already configured. Please sign in.' });
    return;
  }

  const { passcode } = req.body ?? {};
  if (typeof passcode !== 'string' || passcode.trim().length < 6) {
    res.status(400).json({ error: 'Passcode must be at least 6 characters' });
    return;
  }

  const hashed = hashPassword(passcode.trim());
  const tx = db.transaction(() => {
    const existing = db
      .prepare("SELECT value FROM admin_settings WHERE key = 'admin_passcode_hash'")
      .get() as { value: string } | undefined;
    if (existing) return false;
    db.prepare(
      "INSERT INTO admin_settings (key, value, updated_at) VALUES ('admin_passcode_hash', ?, CURRENT_TIMESTAMP)"
    ).run(hashed);
    return true;
  });

  if (!tx()) {
    res.status(409).json({ error: 'Admin passcode already claimed' });
    return;
  }

  const token = signToken({ sub: 'admin-console', role: 'admin' });
  res.status(201).json({ token });
});

adminRouter.post('/login', (req, res) => {
  const { passcode } = req.body ?? {};
  if (typeof passcode !== 'string' || !passcode) {
    res.status(400).json({ error: 'Admin passcode is required' });
    return;
  }

  const state = getAdminState();
  if (!state.configured) {
    res.status(400).json({ error: 'Admin passcode has not been claimed yet' });
    return;
  }

  let valid = false;
  if (state.envConfigured) {
    valid = timingSafeCompareStrings(passcode, state.envPasscode);
  } else if (state.storedHash) {
    valid = verifyPassword(passcode, state.storedHash);
  }

  if (!valid) {
    res.status(401).json({ error: 'Invalid admin passcode' });
    return;
  }

  const token = signToken({ sub: 'admin-console', role: 'admin' });
  res.json({ token });
});

adminRouter.use(requireAdminAuth);

adminRouter.get('/stats', (_req, res) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeUsers = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE account_status = 'active'").get() as { c: number }
  ).c;
  const suspendedUsers = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE account_status = 'suspended'").get() as { c: number }
  ).c;
  const onlineUsers = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_online = 1').get() as { c: number }).c;
  const verifiedUsers = (db.prepare('SELECT COUNT(*) as c FROM users WHERE otp_verified = 1').get() as { c: number }).c;
  const totalCalls = (db.prepare('SELECT COUNT(*) as c FROM call_records').get() as { c: number }).c;
  const totalCallDuration = (
    db.prepare('SELECT COALESCE(SUM(duration_seconds), 0) as s FROM call_records').get() as { s: number }
  ).s;
  const totalMessages = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      suspendedUsers,
      onlineUsers,
      verifiedUsers,
      totalCalls,
      totalCallDuration,
      totalMessages,
    },
  });
});

adminRouter.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM messages m WHERE m.sender_id = u.id OR m.receiver_id = u.id) as message_count,
              (SELECT COUNT(*) FROM call_records c WHERE c.caller_id = u.id OR c.callee_id = u.id) as call_count
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  res.json({ users: rows.map((r) => sanitizeUser(r)) });
});

adminRouter.get('/users/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  const user = sanitizeUser(row);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const recentCalls = db
    .prepare(
      `SELECT c.*, caller.full_name as caller_name, callee.full_name as callee_name
       FROM call_records c
       JOIN users caller ON caller.id = c.caller_id
       JOIN users callee ON callee.id = c.callee_id
       WHERE c.caller_id = ? OR c.callee_id = ?
       ORDER BY c.started_at DESC LIMIT 20`
    )
    .all(user.id, user.id);

  const recentMessages = db
    .prepare(
      `SELECT m.*, s.full_name as sender_name, r.full_name as receiver_name
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.receiver_id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC LIMIT 20`
    )
    .all(user.id, user.id);

  res.json({ user, recentCalls, recentMessages });
});

adminRouter.patch('/users/:id/status', (req, res) => {
  const { status } = req.body ?? {};
  if (status !== 'active' && status !== 'suspended' && status !== 'pending_verification') {
    res.status(400).json({ error: 'Invalid account status' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.prepare('UPDATE users SET account_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    status,
    req.params.id
  );

  if (status === 'suspended') {
    disconnectUserSockets(req.params.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json({ user: sanitizeUser(updated) });
});

adminRouter.get('/calls', (_req, res) => {
  const calls = db
    .prepare(
      `SELECT c.*,
              caller.full_name as caller_name,
              caller.demo_virtual_number as caller_number,
              callee.full_name as callee_name,
              callee.demo_virtual_number as callee_number
       FROM call_records c
       JOIN users caller ON caller.id = c.caller_id
       JOIN users callee ON callee.id = c.callee_id
       ORDER BY c.started_at DESC
       LIMIT 200`
    )
    .all();
  res.json({ calls });
});

adminRouter.get('/messages', (_req, res) => {
  const messages = db
    .prepare(
      `SELECT m.*,
              s.full_name as sender_name,
              s.demo_virtual_number as sender_number,
              r.full_name as receiver_name,
              r.demo_virtual_number as receiver_number
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.receiver_id
       ORDER BY m.created_at DESC
       LIMIT 200`
    )
    .all();
  res.json({ messages });
});

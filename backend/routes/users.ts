import { Router } from 'express';
import crypto from 'node:crypto';
import { db, sanitizeUser } from '../db.ts';
import { generateIndiaDemoNumber } from '../crypto.ts';
import { requireUserAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const usersRouter = Router();

usersRouter.use(requireUserAuth);

usersRouter.get('/me', (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

usersRouter.patch('/me', (req: AuthenticatedRequest, res) => {
  const { fullName, bio, regenerateDemoNumber } = req.body ?? {};
  const userId = req.user!.id;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof fullName === 'string' && fullName.trim().length >= 2) {
    updates.push('full_name = ?');
    params.push(fullName.trim());
  }
  if (typeof bio === 'string') {
    updates.push('bio = ?');
    params.push(bio.trim().slice(0, 140));
  }
  if (regenerateDemoNumber === true) {
    let nextNumber = generateIndiaDemoNumber();
    for (let i = 0; i < 8; i++) {
      const conflict = db.prepare('SELECT id FROM users WHERE demo_virtual_number = ?').get(nextNumber);
      if (!conflict) break;
      nextNumber = generateIndiaDemoNumber();
    }
    updates.push('demo_virtual_number = ?');
    params.push(nextNumber);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid profile fields supplied' });
    return;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  res.json({ user: sanitizeUser(updated) });
});

usersRouter.get('/directory', (req: AuthenticatedRequest, res) => {
  const q = typeof req.query.q === 'string' ? `%${req.query.q.trim()}%` : '%';
  const rows = db
    .prepare(
      `SELECT id, app_user_id, full_name, email, demo_virtual_number, avatar_url, bio, is_online, last_seen_at, otp_verified
       FROM users
       WHERE id != ? AND account_status != 'suspended'
         AND (full_name LIKE ? OR demo_virtual_number LIKE ? OR app_user_id LIKE ? OR email LIKE ?)
       ORDER BY is_online DESC, full_name ASC`
    )
    .all(req.user!.id, q, q, q, q);

  res.json({ users: rows });
});

usersRouter.get('/lookup', (req: AuthenticatedRequest, res) => {
  const query = typeof req.query.number === 'string' ? req.query.number.replace(/\s+/g, '') : '';
  if (!query) {
    res.status(400).json({ error: 'Number or user ID required' });
    return;
  }

  const all = db
    .prepare(
      `SELECT id, app_user_id, full_name, email, demo_virtual_number, avatar_url, bio, is_online
       FROM users WHERE id != ? AND account_status != 'suspended'`
    )
    .all(req.user!.id) as Array<{
    id: string;
    app_user_id: string;
    full_name: string;
    email: string;
    demo_virtual_number: string;
    avatar_url: string;
    bio: string;
    is_online: number;
  }>;

  const match = all.find(
    (u) =>
      u.demo_virtual_number.replace(/\s+/g, '') === query ||
      u.demo_virtual_number.replace(/\D/g, '').endsWith(query.replace(/\D/g, '')) ||
      u.app_user_id.toUpperCase() === query.toUpperCase()
  );

  if (!match) {
    res.status(404).json({ error: 'No registered eSIM Connect user matches that demo number' });
    return;
  }
  res.json({ user: match });
});

usersRouter.get('/contacts', (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT c.id as contact_id, c.nickname, c.is_favorite,
              u.id, u.app_user_id, u.full_name, u.email, u.demo_virtual_number,
              u.avatar_url, u.bio, u.is_online, u.last_seen_at
       FROM contacts c
       JOIN users u ON u.id = c.contact_user_id
       WHERE c.owner_user_id = ? AND u.account_status != 'suspended'
       ORDER BY c.is_favorite DESC, u.is_online DESC, u.full_name ASC`
    )
    .all(req.user!.id);
  res.json({ contacts: rows });
});

usersRouter.post('/contacts', (req: AuthenticatedRequest, res) => {
  const { contactUserId, demoNumber, nickname } = req.body ?? {};
  let targetId = typeof contactUserId === 'string' ? contactUserId : '';

  if (!targetId && typeof demoNumber === 'string') {
    const clean = demoNumber.replace(/\s+/g, '');
    const all = db.prepare('SELECT id, demo_virtual_number, app_user_id FROM users').all() as Array<{
      id: string;
      demo_virtual_number: string;
      app_user_id: string;
    }>;
    const found = all.find(
      (u) =>
        u.demo_virtual_number.replace(/\s+/g, '') === clean ||
        u.app_user_id.toUpperCase() === clean.toUpperCase()
    );
    if (found) targetId = found.id;
  }

  if (!targetId || targetId === req.user!.id) {
    res.status(400).json({ error: 'Valid contact user or demo number required' });
    return;
  }

  const targetExists = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!targetExists) {
    res.status(404).json({ error: 'Contact user not found' });
    return;
  }

  db.prepare(
    `INSERT OR REPLACE INTO contacts (id, owner_user_id, contact_user_id, nickname, is_favorite)
     VALUES (
       COALESCE((SELECT id FROM contacts WHERE owner_user_id = ? AND contact_user_id = ?), ?),
       ?, ?, ?, 0
     )`
  ).run(req.user!.id, targetId, crypto.randomUUID(), req.user!.id, targetId, typeof nickname === 'string' ? nickname.trim() : null);

  res.status(201).json({ added: true });
});

usersRouter.patch('/contacts/:contactUserId/favorite', (req: AuthenticatedRequest, res) => {
  const { isFavorite } = req.body ?? {};
  db.prepare('UPDATE contacts SET is_favorite = ? WHERE owner_user_id = ? AND contact_user_id = ?').run(
    isFavorite ? 1 : 0,
    req.user!.id,
    req.params.contactUserId
  );
  res.json({ updated: true });
});

usersRouter.delete('/contacts/:contactUserId', (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM contacts WHERE owner_user_id = ? AND contact_user_id = ?').run(
    req.user!.id,
    req.params.contactUserId
  );
  res.json({ removed: true });
});

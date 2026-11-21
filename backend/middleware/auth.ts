import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../crypto.ts';
import { db, sanitizeUser, type SafeUser } from '../db.ts';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  isAdmin?: boolean;
}

export function requireUserAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as Record<string, unknown> | undefined;
  const safeUser = sanitizeUser(row);
  if (!safeUser) {
    res.status(401).json({ error: 'User account no longer exists' });
    return;
  }
  if (safeUser.account_status === 'suspended') {
    res.status(403).json({ error: 'Account has been suspended by an administrator' });
    return;
  }

  req.user = safeUser;
  next();
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }
  req.isAdmin = true;
  next();
}

import { Router } from 'express';
import { db } from '../db.ts';
import { requireUserAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const callsRouter = Router();

callsRouter.use(requireUserAuth);

callsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT c.*,
              caller.full_name as caller_name,
              caller.demo_virtual_number as caller_number,
              caller.avatar_url as caller_avatar,
              callee.full_name as callee_name,
              callee.demo_virtual_number as callee_number,
              callee.avatar_url as callee_avatar
       FROM call_records c
       JOIN users caller ON caller.id = c.caller_id
       JOIN users callee ON callee.id = c.callee_id
       WHERE c.caller_id = ? OR c.callee_id = ?
       ORDER BY c.started_at DESC
       LIMIT 100`
    )
    .all(myId, myId);

  res.json({ calls: rows });
});

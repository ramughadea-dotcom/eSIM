import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.ts';
import { requireUserAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { emitToUser, isUserOnline } from '../socket.ts';

export const messagesRouter = Router();

messagesRouter.use(requireUserAuth);

messagesRouter.get('/conversations', (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;

  const rows = db
    .prepare(
      `SELECT m.*,
              CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as peer_id
       FROM messages m
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(myId, myId, myId) as Array<{
    id: string;
    sender_id: string;
    receiver_id: string;
    body: string;
    status: string;
    created_at: string;
    peer_id: string;
  }>;

  const map = new Map<
    string,
    {
      peerId: string;
      lastMessage: typeof rows[number];
      unreadCount: number;
    }
  >();

  for (const row of rows) {
    const existing = map.get(row.peer_id);
    const isUnread = row.receiver_id === myId && row.status !== 'read';
    if (!existing) {
      map.set(row.peer_id, {
        peerId: row.peer_id,
        lastMessage: row,
        unreadCount: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unreadCount += 1;
    }
  }

  const peerStmt = db.prepare(
    'SELECT id, app_user_id, full_name, demo_virtual_number, avatar_url, is_online, last_seen_at FROM users WHERE id = ?'
  );

  const conversations = Array.from(map.values())
    .map((entry) => {
      const peer = peerStmt.get(entry.peerId);
      if (!peer) return null;
      return {
        peer,
        lastMessage: entry.lastMessage,
        unreadCount: entry.unreadCount,
      };
    })
    .filter(Boolean);

  res.json({ conversations });
});

messagesRouter.get('/:peerId', (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;
  const peerId = req.params.peerId;

  const peer = db
    .prepare('SELECT id, app_user_id, full_name, demo_virtual_number, avatar_url, bio, is_online, last_seen_at FROM users WHERE id = ?')
    .get(peerId);
  if (!peer) {
    res.status(404).json({ error: 'Recipient not found' });
    return;
  }

  const readAt = new Date().toISOString();
  const unreadIncoming = db
    .prepare("SELECT id FROM messages WHERE sender_id = ? AND receiver_id = ? AND status != 'read'")
    .all(peerId, myId) as Array<{ id: string }>;

  if (unreadIncoming.length > 0) {
    db.prepare(
      "UPDATE messages SET status = 'read', read_at = COALESCE(read_at, ?), delivered_at = COALESCE(delivered_at, ?) WHERE sender_id = ? AND receiver_id = ? AND status != 'read'"
    ).run(readAt, readAt, peerId, myId);

    emitToUser(peerId, 'messages:read', {
      peerId: myId,
      messageIds: unreadIncoming.map((m) => m.id),
      readAt,
    });
  }

  const messages = db
    .prepare(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`
    )
    .all(myId, peerId, peerId, myId);

  res.json({ peer, messages });
});

messagesRouter.post('/', (req: AuthenticatedRequest, res) => {
  const myId = req.user!.id;
  const { receiverId, body } = req.body ?? {};

  if (typeof receiverId !== 'string' || !receiverId.trim()) {
    res.status(400).json({ error: 'Receiver ID is required' });
    return;
  }
  if (typeof body !== 'string' || !body.trim()) {
    res.status(400).json({ error: 'Message text cannot be empty' });
    return;
  }
  if (body.length > 2000) {
    res.status(400).json({ error: 'Message exceeds 2000 character limit' });
    return;
  }

  const receiver = db.prepare('SELECT id, account_status FROM users WHERE id = ?').get(receiverId) as
    | { id: string; account_status: string }
    | undefined;
  if (!receiver || receiver.account_status === 'suspended') {
    res.status(404).json({ error: 'Recipient unavailable' });
    return;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const online = isUserOnline(receiverId);
  const status = online ? 'delivered' : 'sent';
  const deliveredAt = online ? createdAt : null;

  db.prepare(
    `INSERT INTO messages (id, sender_id, receiver_id, body, status, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, myId, receiverId, body.trim(), status, createdAt, deliveredAt);

  const savedMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  emitToUser(receiverId, 'message:new', {
    message: savedMessage,
    sender: {
      id: req.user!.id,
      full_name: req.user!.full_name,
      demo_virtual_number: req.user!.demo_virtual_number,
      avatar_url: req.user!.avatar_url,
    },
  });

  res.status(201).json({ message: savedMessage });
});

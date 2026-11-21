import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import crypto from 'node:crypto';
import { verifyToken } from './crypto.ts';
import { db, sanitizeUser } from './db.ts';

let ioInstance: SocketIOServer | null = null;
const onlineSockets = new Map<string, Set<string>>();

export function isUserOnline(userId: string): boolean {
  const set = onlineSockets.get(userId);
  return Boolean(set && set.size > 0);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  const socketIds = onlineSockets.get(userId);
  if (!socketIds) return;
  for (const sid of socketIds) {
    ioInstance.to(sid).emit(event, payload);
  }
}

export function disconnectUserSockets(userId: string): void {
  if (!ioInstance) return;
  const socketIds = onlineSockets.get(userId);
  if (!socketIds) return;
  for (const sid of socketIds) {
    const sock = ioInstance.sockets.sockets.get(sid);
    if (sock) {
      sock.emit('account:suspended', { reason: 'Account suspended by administrator' });
      sock.disconnect(true);
    }
  }
  onlineSockets.delete(userId);
}

export function attachSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });
  ioInstance = io;

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.query?.token as string | undefined);
    if (!token) {
      next(new Error('Authentication token required'));
      return;
    }
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'user') {
      next(new Error('Invalid session token'));
      return;
    }
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as Record<string, unknown> | undefined;
    const safeUser = sanitizeUser(userRow);
    if (!safeUser || safeUser.account_status === 'suspended') {
      next(new Error('Account unavailable or suspended'));
      return;
    }
    (socket as Socket & { userId: string }).userId = safeUser.id;
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as Socket & { userId: string };
    const userId = socket.userId;

    let set = onlineSockets.get(userId);
    if (!set) {
      set = new Set<string>();
      onlineSockets.set(userId, set);
    }
    set.add(socket.id);

    db.prepare('UPDATE users SET is_online = 1, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    io.emit('presence:update', { userId, isOnline: true, lastSeenAt: new Date().toISOString() });

    // Deliver any pending 'sent' messages to this user on connect
    const pendingMsgs = db
      .prepare("SELECT id, sender_id FROM messages WHERE receiver_id = ? AND status = 'sent'")
      .all(userId) as Array<{ id: string; sender_id: string }>;
    if (pendingMsgs.length > 0) {
      const deliveredAt = new Date().toISOString();
      const markDelivered = db.prepare("UPDATE messages SET status = 'delivered', delivered_at = ? WHERE id = ?");
      for (const msg of pendingMsgs) {
        markDelivered.run(deliveredAt, msg.id);
        emitToUser(msg.sender_id, 'message:status', {
          messageId: msg.id,
          status: 'delivered',
          deliveredAt,
        });
      }
    }

    socket.on('typing:start', (data: { peerId?: string }) => {
      if (data?.peerId) {
        emitToUser(data.peerId, 'typing:start', { userId });
      }
    });

    socket.on('typing:stop', (data: { peerId?: string }) => {
      if (data?.peerId) {
        emitToUser(data.peerId, 'typing:stop', { userId });
      }
    });

    socket.on('message:read', (data: { peerId?: string }) => {
      if (!data?.peerId) return;
      const readAt = new Date().toISOString();
      const unread = db
        .prepare("SELECT id FROM messages WHERE sender_id = ? AND receiver_id = ? AND status != 'read'")
        .all(data.peerId, userId) as Array<{ id: string }>;
      if (unread.length > 0) {
        db.prepare(
          "UPDATE messages SET status = 'read', read_at = COALESCE(read_at, ?), delivered_at = COALESCE(delivered_at, ?) WHERE sender_id = ? AND receiver_id = ? AND status != 'read'"
        ).run(readAt, readAt, data.peerId, userId);

        emitToUser(data.peerId, 'messages:read', {
          peerId: userId,
          messageIds: unread.map((u) => u.id),
          readAt,
        });
      }
    });

    // WebRTC Signaling Events
    socket.on(
      'call:initiate',
      (
        data: { calleeId?: string; sdpOffer?: unknown },
        ack?: (res: { ok: boolean; callId?: string; error?: string }) => void
      ) => {
        const calleeId = data?.calleeId;
        if (!calleeId || calleeId === userId) {
          ack?.({ ok: false, error: 'Invalid callee' });
          return;
        }
        const calleeRow = db.prepare('SELECT id, full_name, demo_virtual_number, avatar_url, account_status FROM users WHERE id = ?').get(calleeId) as
          | { id: string; full_name: string; demo_virtual_number: string; avatar_url: string; account_status: string }
          | undefined;
        if (!calleeRow || calleeRow.account_status === 'suspended') {
          ack?.({ ok: false, error: 'Callee is unavailable' });
          return;
        }

        const callerRow = db
          .prepare('SELECT id, full_name, demo_virtual_number, app_user_id, avatar_url FROM users WHERE id = ?')
          .get(userId) as { id: string; full_name: string; demo_virtual_number: string; app_user_id: string; avatar_url: string };

        const callId = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const calleeOnline = isUserOnline(calleeId);

        db.prepare(
          `INSERT INTO call_records (id, caller_id, callee_id, call_type, status, started_at, duration_seconds)
           VALUES (?, ?, ?, 'audio', ?, ?, 0)`
        ).run(callId, userId, calleeId, calleeOnline ? 'ringing' : 'missed', startedAt);

        if (!calleeOnline) {
          db.prepare('UPDATE call_records SET ended_at = ? WHERE id = ?').run(startedAt, callId);
          ack?.({ ok: false, callId, error: 'User is currently offline. Call logged as missed.' });
          return;
        }

        emitToUser(calleeId, 'call:incoming', {
          callId,
          caller: callerRow,
          sdpOffer: data?.sdpOffer ?? null,
          startedAt,
        });

        ack?.({ ok: true, callId });
      }
    );

    socket.on('call:accept', (data: { callId?: string; callerId?: string; sdpAnswer?: unknown }) => {
      if (!data?.callId || !data?.callerId) return;
      const connectedAt = new Date().toISOString();
      db.prepare("UPDATE call_records SET status = 'connected', connected_at = ? WHERE id = ?").run(
        connectedAt,
        data.callId
      );
      emitToUser(data.callerId, 'call:accepted', {
        callId: data.callId,
        calleeId: userId,
        sdpAnswer: data.sdpAnswer ?? null,
        connectedAt,
      });
    });

    socket.on('call:reject', (data: { callId?: string; callerId?: string; reason?: string }) => {
      if (!data?.callId || !data?.callerId) return;
      const endedAt = new Date().toISOString();
      db.prepare("UPDATE call_records SET status = 'rejected', ended_at = ? WHERE id = ?").run(endedAt, data.callId);
      emitToUser(data.callerId, 'call:rejected', {
        callId: data.callId,
        calleeId: userId,
        reason: data.reason || 'Call declined',
      });
    });

    socket.on('call:ice-candidate', (data: { callId?: string; targetUserId?: string; candidate?: unknown }) => {
      if (!data?.callId || !data?.targetUserId || !data?.candidate) return;
      emitToUser(data.targetUserId, 'call:ice-candidate', {
        callId: data.callId,
        fromUserId: userId,
        candidate: data.candidate,
      });
    });

    socket.on('call:end', (data: { callId?: string; peerId?: string; durationSeconds?: number }) => {
      if (!data?.callId) return;
      const existing = db.prepare('SELECT status, connected_at FROM call_records WHERE id = ?').get(data.callId) as
        | { status: string; connected_at: string | null }
        | undefined;
      const endedAt = new Date().toISOString();
      const nextStatus = existing?.status === 'ringing' ? 'missed' : 'ended';
      const duration = Math.max(0, Math.round(Number(data.durationSeconds || 0)));

      db.prepare('UPDATE call_records SET status = ?, ended_at = ?, duration_seconds = ? WHERE id = ?').run(
        nextStatus,
        endedAt,
        duration,
        data.callId
      );

      if (data.peerId) {
        emitToUser(data.peerId, 'call:ended', {
          callId: data.callId,
          endedBy: userId,
          durationSeconds: duration,
        });
      }
    });

    socket.on('disconnect', () => {
      const userSet = onlineSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          onlineSockets.delete(userId);
          db.prepare('UPDATE users SET is_online = 0, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
          io.emit('presence:update', {
            userId,
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
}

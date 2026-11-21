import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from './crypto.ts';

const dbDir = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'esim_connect.db');
const schemaPath = path.join(dbDir, 'schema.sql');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Reset online statuses on fresh boot
  db.prepare('UPDATE users SET is_online = 0').run();

  const existingCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingCountRow.count === 0) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const demoPasswordHash = hashPassword('esimconnect123');
  const seededUsers = [
    {
      id: 'usr-aarav-01',
      app_user_id: 'ESC-IND001',
      full_name: 'Aarav Sharma',
      email: 'aarav@esimconnect.demo',
      demo_virtual_number: '+91 90001 10482',
      avatar_url: '/src/assets/images/avatar_aarav_sharma_1795236284498.jpg',
      bio: 'Android & WebRTC engineer · Bengaluru',
      otp_verified: 1,
    },
    {
      id: 'usr-priya-02',
      app_user_id: 'ESC-IND002',
      full_name: 'Priya Nair',
      email: 'priya@esimconnect.demo',
      demo_virtual_number: '+91 90002 44819',
      avatar_url: '/src/assets/images/avatar_priya_nair_1795236284696.jpg',
      bio: 'Product Designer · Mumbai',
      otp_verified: 1,
    },
    {
      id: 'usr-rohan-03',
      app_user_id: 'ESC-IND003',
      full_name: 'Rohan Verma',
      email: 'rohan@esimconnect.demo',
      demo_virtual_number: '+91 90003 77210',
      avatar_url: '/src/assets/images/avatar_rohan_verma_1795236292328.jpg',
      bio: 'Systems Architect · Pune',
      otp_verified: 1,
    },
    {
      id: 'usr-ananya-04',
      app_user_id: 'ESC-IND004',
      full_name: 'Ananya Iyer',
      email: 'ananya@esimconnect.demo',
      demo_virtual_number: '+91 90004 89315',
      avatar_url: '/src/assets/images/avatar_ananya_iyer_1795236292277.jpg',
      bio: 'Backend Developer · Chennai',
      otp_verified: 1,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, app_user_id, full_name, email, password_hash, demo_virtual_number,
      avatar_url, bio, account_status, otp_verified, is_online
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0)
  `);

  const insertContact = db.prepare(`
    INSERT OR IGNORE INTO contacts (id, owner_user_id, contact_user_id, is_favorite)
    VALUES (?, ?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, body, status, created_at, delivered_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCall = db.prepare(`
    INSERT INTO call_records (id, caller_id, callee_id, call_type, status, started_at, connected_at, ended_at, duration_seconds)
    VALUES (?, ?, ?, 'audio', ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const u of seededUsers) {
      insertUser.run(
        u.id,
        u.app_user_id,
        u.full_name,
        u.email,
        demoPasswordHash,
        u.demo_virtual_number,
        u.avatar_url,
        u.bio,
        u.otp_verified
      );
    }

    // Contacts graph
    for (const owner of seededUsers) {
      for (const target of seededUsers) {
        if (owner.id !== target.id) {
          insertContact.run(
            crypto.randomUUID(),
            owner.id,
            target.id,
            target.id === 'usr-priya-02' ? 1 : 0
          );
        }
      }
    }

    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

    // Sample initial messages
    insertMsg.run(
      'msg-seed-01',
      'usr-priya-02',
      'usr-aarav-01',
      'Hey Aarav! Tested the WebRTC signaling server from Mumbai—audio latency is super crisp.',
      'read',
      iso(-3600_000 * 3),
      iso(-3600_000 * 3 + 500),
      iso(-3600_000 * 2.9)
    );
    insertMsg.run(
      'msg-seed-02',
      'usr-aarav-01',
      'usr-priya-02',
      'Awesome! Remember our +91 9000x virtual IDs are app-only demo identifiers over internet Socket.IO.',
      'read',
      iso(-3600_000 * 2.8),
      iso(-3600_000 * 2.8 + 400),
      iso(-3600_000 * 2.7)
    );
    insertMsg.run(
      'msg-seed-03',
      'usr-rohan-03',
      'usr-aarav-01',
      'Can we test an audio call on the Jetpack Compose dialer in 10 mins?',
      'delivered',
      iso(-1800_000),
      iso(-1795_000),
      null
    );
    insertMsg.run(
      'msg-seed-04',
      'usr-ananya-04',
      'usr-priya-02',
      'SQLite schema and parameterized queries are ready for review.',
      'read',
      iso(-7200_000),
      iso(-7198_000),
      iso(-7000_000)
    );

    // Sample call records
    insertCall.run(
      'call-seed-01',
      'usr-aarav-01',
      'usr-priya-02',
      'ended',
      iso(-3600_000 * 5),
      iso(-3600_000 * 5 + 4000),
      iso(-3600_000 * 5 + 245000),
      241
    );
    insertCall.run(
      'call-seed-02',
      'usr-rohan-03',
      'usr-aarav-01',
      'missed',
      iso(-3600_000 * 2),
      null,
      iso(-3600_000 * 2 + 25000),
      0
    );
    insertCall.run(
      'call-seed-03',
      'usr-ananya-04',
      'usr-rohan-03',
      'ended',
      iso(-3600_000 * 8),
      iso(-3600_000 * 8 + 3000),
      iso(-3600_000 * 8 + 128000),
      125
    );
  });

  tx();
}

export interface SafeUser {
  id: string;
  app_user_id: string;
  full_name: string;
  email: string;
  demo_virtual_number: string;
  avatar_url: string;
  bio: string;
  account_status: 'active' | 'suspended' | 'pending_verification';
  otp_verified: number;
  is_online: number;
  last_seen_at: string;
  created_at: string;
}

export function sanitizeUser(row: Record<string, unknown> | undefined): SafeUser | null {
  if (!row) return null;
  const { password_hash: _ignored, ...rest } = row;
  return rest as unknown as SafeUser;
}

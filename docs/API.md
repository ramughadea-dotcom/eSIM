# eSIM Connect — REST & Socket.IO API Documentation

Base URL (Local): `http://localhost:3000`

> **Non-Telecom Notice:** eSIM Connect is an internet-based VoIP & messaging application. `+91 9000X XXXXX` virtual numbers are app-internal identifiers only and do not connect to PSTN, cellular eSIM networks, or SMS gateways.

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a new user, generate unique `ESC-XXXXXX` ID & `+91 9000X XXXXX` demo virtual number, hash password with `scrypt`, and generate a local hashed Demo OTP. |
| `POST` | `/api/auth/login` | Public | Verify credentials and return signed Bearer session token + sanitized user profile. |
| `POST` | `/api/auth/demo-otp/generate` | User | Generate a new 6-digit Demo OTP (stored hashed in `demo_otps`, valid 5 mins). |
| `POST` | `/api/auth/demo-otp/verify` | User | Verify submitted 6-digit Demo OTP and mark `otp_verified = 1`. |
| `POST` | `/api/auth/password-reset/request` | Public | Request a local Demo OTP for password reset. |
| `POST` | `/api/auth/password-reset/confirm` | Public | Verify password reset Demo OTP and update scrypt password hash. |
| `GET` | `/api/auth/demo-accounts` | Public | List seeded local test directory accounts (never exposes passwords). |

---

## 2. Users & Contacts (`/api/users`)

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/users/me` | Fetch authenticated user's profile. |
| `PATCH` | `/api/users/me` | Update `fullName`, `bio`, or set `regenerateDemoNumber: true`. |
| `GET` | `/api/users/directory?q=` | Search active users by name, demo number, `app_user_id`, or email. |
| `GET` | `/api/users/lookup?number=` | Look up a single user by `+91 9000X` demo number or `ESC-` ID. |
| `GET` | `/api/users/contacts` | List saved contacts for current user. |
| `POST` | `/api/users/contacts` | Add contact via `contactUserId` or `demoNumber`. |
| `PATCH` | `/api/users/contacts/:contactUserId/favorite` | Toggle contact favorite status. |
| `DELETE` | `/api/users/contacts/:contactUserId` | Remove a contact. |

---

## 3. Messaging (`/api/messages`)

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/messages/conversations` | List conversations with last message and unread counts. |
| `GET` | `/api/messages/:peerId` | Load chat history with `peerId` and mark unread incoming messages as `read`. |
| `POST` | `/api/messages` | Send text message (`{ receiverId, body }`), persist to SQLite, and emit `message:new` via Socket.IO. |

---

## 4. Call History (`/api/calls`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/calls` | User | Fetch call history for the authenticated user (`caller` / `callee` metadata + duration). |

---

## 5. Admin Dashboard (`/api/admin`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/admin/status` | Public | Check whether an admin passcode is configured via `ADMIN_PASSCODE` or claimed in SQLite. |
| `POST` | `/api/admin/claim` | Public (first-run) | Claim and scrypt-hash the initial admin passcode when none is configured. |
| `POST` | `/api/admin/login` | Public | Verify admin passcode and issue Admin Bearer token. |
| `GET` | `/api/admin/stats` | Admin | Aggregate user, online, call, duration, and message counts. |
| `GET` | `/api/admin/users` | Admin | Full user directory with activity counts. |
| `GET` | `/api/admin/users/:id` | Admin | Detailed user profile with recent calls and messages. |
| `PATCH` | `/api/admin/users/:id/status` | Admin | Update account status (`active`, `suspended`, `pending_verification`). |
| `GET` | `/api/admin/calls` | Admin | All platform demo call records. |
| `GET` | `/api/admin/messages` | Admin | All platform demo message records. |

---

## 6. Socket.IO Real-Time & WebRTC Signaling Events

Connect with `auth: { token: "<user_bearer_token>" }`.

- **Presence**: `presence:update` (`{ userId, isOnline, lastSeenAt }`)
- **Messaging**: `message:new`, `message:status`, `messages:read`, `message:read`, `typing:start`, `typing:stop`
- **WebRTC Signaling**:
  - `call:initiate` (`{ calleeId, sdpOffer }`) -> callback `{ ok, callId }`
  - `call:incoming` (`{ callId, caller, sdpOffer, startedAt }`)
  - `call:accept` (`{ callId, callerId, sdpAnswer }`)
  - `call:accepted` (`{ callId, calleeId, sdpAnswer, connectedAt }`)
  - `call:reject` (`{ callId, callerId, reason }`)
  - `call:rejected` (`{ callId, calleeId, reason }`)
  - `call:ice-candidate` (`{ callId, targetUserId, candidate }`)
  - `call:end` (`{ callId, peerId, durationSeconds }`)
  - `call:ended` (`{ callId, endedBy, durationSeconds }`)

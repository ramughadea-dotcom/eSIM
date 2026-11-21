# eSIM Connect — Web Admin Dashboard

The Admin Dashboard is served directly by the Node.js Express server and accessible via the **Admin Dashboard** workspace tab in the web application (`http://localhost:3000`).

## Implemented Features
- **Secure Admin Authentication**:
  - Supports `ADMIN_PASSCODE` environment variable override on the server.
  - When `ADMIN_PASSCODE` is unset on initial setup, renders an atomic first-run passcode claim form (`POST /api/admin/claim`) that hashes the passcode with `crypto.scryptSync` and stores it in SQLite (`admin_settings`).
  - Admin credentials are never compiled into or exposed by the Android app.
- **Usage Statistics**: Total registered users, active accounts, live online Socket.IO presence, demo OTP verification rate, total call count & cumulative duration, and total messages.
- **User Directory & Details Drawer**: Searchable user table with App User ID (`ESC-XXXXXX`), India `+91 9000X XXXXX` demo virtual number, verification status, online status, and inspectable recent calls/messages.
- **Account Status Controls**: Suspend, activate, or mark accounts pending verification—suspending immediately terminates active Socket.IO sessions.
- **Demo Call & Message Records**: Live tables showing platform-wide internet call logs and message delivery/read states.

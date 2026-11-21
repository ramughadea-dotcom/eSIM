# eSIM Connect

An open-source, internet-based calling and messaging platform built with **Kotlin + Jetpack Compose** (Android), **Node.js + Express + Socket.IO + SQLite** (Backend & WebRTC Signaling), an interactive **Web Client**, and a **Web Admin Dashboard**.

> **Important Disclaimer:** eSIM Connect is **not** a telecom operator or real eSIM service. Demo virtual numbers (`+91 9000X XXXXX`) and Demo OTPs are local, app-internal test identifiers only. The app does not provide PSTN phone calls, real cellular numbers, or third-party SMS delivery.

---

## Project Structure

```
├── android/                  # Kotlin + Jetpack Compose Android Studio project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/com/esimconnect/app/
│   │       ├── MainActivity.kt
│   │       ├── data/         # REST API client, Socket.IO manager, models
│   │       ├── webrtc/       # WebRTC PeerConnection audio manager
│   │       └── ui/           # Material 3 Light/Dark theme + all 13 screens
│   ├── build.gradle.kts
│   └── settings.gradle.kts
├── backend/                  # Express REST API, Socket.IO signaling, scrypt auth
│   ├── crypto.ts
│   ├── db.ts
│   ├── middleware/auth.ts
│   ├── routes/               # auth, users, messages, calls, admin
│   └── socket.ts
├── admin-dashboard/          # Admin console integration & standalone deployment notes
├── database/
│   ├── schema.sql            # SQLite schema (users, demo_otps, contacts, messages, call_records)
│   └── seed.sql              # Demo accounts reference
├── docs/
│   ├── API.md                # REST & Socket.IO specification
│   ├── ANDROID_BUILD.md      # Gradle & APK build instructions
│   └── SELF_HOSTING.md       # Self-hosting & coturn/VPS infrastructure notes
├── src/                      # Interactive Web Client + Admin Dashboard + Source Explorer (React + Vite)
├── server.ts                 # Unified Express + Socket.IO + Vite runtime on port 3000
└── package.json
```

---

## Local Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the full-stack server (Backend API + Socket.IO + SQLite + Web Client & Admin UI):**
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

### Local Multi-User Testing (Real WebRTC & Socket.IO)
- Open `http://localhost:3000` in **two browser tabs** (or use the **Quick Switch** demo account menu).
- Sign in as **Aarav Sharma** (`aarav@esimconnect.demo` / `esimconnect123`) in Tab 1 and **Priya Nair** (`priya@esimconnect.demo` / `esimconnect123`) in Tab 2.
- Send real-time messages (observe `sent` → `delivered` → `read` indicators) or initiate a live WebRTC voice call using the Dialer or Contacts screen.
- Open the **Admin Dashboard** tab to claim/enter the admin passcode and inspect active users, call logs, message records, and account status controls.

---

## Security Highlights
- **Passwords & OTPs**: Hashed with `crypto.scryptSync` (per-user salt) and HMAC-SHA256; never stored in plaintext.
- **SQLite Queries**: 100% parameterized prepared statements via `better-sqlite3`.
- **Admin Isolation**: Admin passcode verification and admin routes live exclusively on the server; admin credentials are never embedded in the Android client.

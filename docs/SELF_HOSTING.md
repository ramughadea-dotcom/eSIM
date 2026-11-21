# Self-Hosting & Infrastructure Transparency Guide

eSIM Connect is built on 100% free and open-source software with zero paid telecom or third-party SaaS dependencies.

## 1. Local Development (Zero Cost)
- **Backend + Signaling + Admin Web UI**: Runs on Node.js 22+ with Express, Socket.IO, and local SQLite (`database/esim_connect.db`).
- **STUN Servers**: Uses free public STUN servers (`stun:stun.l.google.com:19302`) for NAT traversal on local/standard networks.

## 2. Production Self-Hosting Notes & Infrastructure Limits
While all application software is free and open-source, deploying on the public internet involves standard infrastructure considerations:

1. **VPS / Cloud Compute**: Hosting Node.js + SQLite requires a server (e.g., a small Linux VPS, Oracle Cloud Always-Free ARM tier, or Fly.io/Railway free allowance).
2. **TURN Relay Server (Optional for Symmetric NATs)**:
   - On local Wi-Fi or standard NATs, WebRTC connects peer-to-peer using free STUN.
   - Behind strict corporate/carrier-grade NAT firewalls (common on mobile 4G/5G), you should self-host **coturn** (100% open-source TURN server) on your VPS. TURN relays media traffic and consumes server bandwidth.
3. **TLS / HTTPS (Required for WebRTC Microphone in Browsers & Android Production)**:
   - Use **Caddy** or **Nginx + Let's Encrypt** (free automated SSL certificates) as a reverse proxy in front of port `3000`.
4. **Admin Passcode**:
   - Set `ADMIN_PASSCODE` in your server environment variables before exposing the Admin Dashboard publicly.

## 3. Running in Production
```bash
npm install
npm run build
ADMIN_PASSCODE="your-strong-passcode" SESSION_SECRET="your-random-hex-secret" NODE_ENV=production npm start
```

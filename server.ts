import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { initializeDatabase } from './backend/db.ts';
import { authRouter } from './backend/routes/auth.ts';
import { usersRouter } from './backend/routes/users.ts';
import { messagesRouter } from './backend/routes/messages.ts';
import { callsRouter } from './backend/routes/calls.ts';
import { adminRouter } from './backend/routes/admin.ts';
import { projectFilesRouter } from './backend/routes/projectFiles.ts';
import { attachSocketServer } from './backend/socket.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  initializeDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'eSIM Connect Signaling & API Server' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/calls', callsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/project-files', projectFilesRouter);

  const server = http.createServer(app);
  attachSocketServer(server);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`eSIM Connect server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start eSIM Connect server:', err);
  process.exit(1);
});

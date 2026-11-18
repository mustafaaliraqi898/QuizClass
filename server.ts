import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createServerApp } from './server/app.ts';
import { resolveStoragePaths } from './server/config/storagePaths.ts';
import { initializeDatabase } from './server/db/database.ts';
import {
  attachLiveSessionSocket,
  type LiveSessionBroadcastHub,
  NOOP_LIVE_SESSION_HUB,
} from './server/services/liveSessionSocket.ts';

const PORT = Number(process.env.PORT ?? 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const storagePaths = resolveStoragePaths();
  const db = initializeDatabase(storagePaths.dbFilePath);

  let liveSocketHub: LiveSessionBroadcastHub = NOOP_LIVE_SESSION_HUB;
  const hubProxy: LiveSessionBroadcastHub = {
    broadcastTeacherSessionUpdate: (sessionId, requestOrigin) =>
      liveSocketHub.broadcastTeacherSessionUpdate(sessionId, requestOrigin),
    broadcastStudentSessionStatus: (sessionId) =>
      liveSocketHub.broadcastStudentSessionStatus(sessionId),
    syncSessionSchedule: (sessionId) => liveSocketHub.syncSessionSchedule(sessionId),
    close: () => liveSocketHub.close(),
  };

  const app = createServerApp(db, storagePaths, hubProxy);
  const httpServer = http.createServer(app);
  liveSocketHub = attachLiveSessionSocket(httpServer, db, storagePaths);

  let vite: ViteDevServer | undefined;

  if (IS_PRODUCTION) {
    const appRoot = process.env.QUIZCLASS_APP_ROOT || process.cwd();
    const distDir = path.join(appRoot, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('تطبيق QuizClass غير مبني بعد.');
      }
    });
  } else {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizClass server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    void liveSocketHub.close().catch(() => {
      // Ignore Socket.IO close errors on shutdown
    });
    void vite?.close().catch(() => {
      // Ignore Vite close errors on shutdown
    });
    httpServer.close(() => {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Failed to start QuizClass server:', error);
  process.exit(1);
});

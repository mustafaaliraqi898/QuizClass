import 'node:process';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServerApp } from './app.ts';
import { resolveStoragePaths } from './config/storagePaths.ts';
import { initializeDatabase } from './db/database.ts';
import {
  attachLiveSessionSocket,
  type LiveSessionBroadcastHub,
  NOOP_LIVE_SESSION_HUB,
} from './services/liveSessionSocket.ts';

// Android owns the process lifecycle and supplies app-private paths through env.
process.env.NODE_ENV = 'production';

const PORT = Number(process.env.PORT ?? 3000);
// Bind to all interfaces so student phones/tablets on the same LAN can join.
// Teacher/admin HTTP routes and teacher Socket.IO subscriptions remain guarded.
const HOST = '0.0.0.0';

async function startMobileServer() {
  const appRoot = process.env.QUIZCLASS_APP_ROOT;
  const dataDir = process.env.QUIZCLASS_DATA_DIR;

  if (!appRoot || !path.isAbsolute(appRoot)) {
    throw new Error('QUIZCLASS_APP_ROOT must be an absolute Android app-private path.');
  }
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw new Error('QUIZCLASS_DATA_DIR must be an absolute Android app-private path.');
  }

  const storagePaths = resolveStoragePaths(dataDir);
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
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'quizclass-local' });
  });

  const distDir = path.join(appRoot, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`QuizClass frontend build not found at ${distDir}`);
  }

  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  const httpServer = http.createServer(app);
  liveSocketHub = attachLiveSessionSocket(httpServer, db, storagePaths);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, HOST, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  console.log(`QuizClass Android local server ready at http://${HOST}:${PORT}`);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    void liveSocketHub.close().catch(() => undefined);
    httpServer.close(() => {
      try {
        db.close();
      } catch {
        // Ignore database close errors during Android process shutdown.
      }
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startMobileServer().catch((error) => {
  console.error('[QuizClass Android] Failed to start local server:', error);
  process.exit(1);
});

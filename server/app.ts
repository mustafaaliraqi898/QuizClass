import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from './config/storagePaths.ts';
import { createQuestionBankRouter } from './routes/questionBankRoutes.ts';

export function createServerApp(db: DatabaseSync, storagePaths: StoragePaths) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createQuestionBankRouter(db, storagePaths));

  return app;
}

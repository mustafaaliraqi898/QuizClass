import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from './config/storagePaths.ts';
import { createQuestionBankRouter } from './routes/questionBankRoutes.ts';
import { createQuizRouter } from './routes/quizRoutes.ts';
import { MediaValidationError } from './services/mediaStorageService.ts';
import {
  QuestionNotFoundError,
  QuestionValidationError,
} from './services/questionBankRepository.ts';
import { QuizNotFoundError, QuizValidationError } from './services/quizRepository.ts';

export function createServerApp(db: DatabaseSync, storagePaths: StoragePaths) {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createQuestionBankRouter(db, storagePaths));
  app.use('/api', createQuizRouter(db, storagePaths));

  // Global error handler catching JSON parse errors and internal server errors without leaking stack traces
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && 'status' in error && (error as { status: number }).status === 400) {
      res.status(400).json({ error: 'صيغة البيانات المرسلة غير صالحة.' });
      return;
    }

    if (
      error instanceof QuestionValidationError ||
      error instanceof QuestionNotFoundError ||
      error instanceof QuizValidationError ||
      error instanceof QuizNotFoundError ||
      error instanceof MediaValidationError
    ) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('[QuizClass API Error]', error);
    res.status(500).json({
      error: 'حدث خطأ داخلي أثناء التعامل مع قاعدة البيانات المحلية.',
    });
  });

  return app;
}

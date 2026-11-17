import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import { localAdminGuard } from '../middleware/localAdminGuard.ts';
import {
  MediaValidationError,
  resolveSafeQuizMediaFile,
} from '../services/mediaStorageService.ts';
import {
  QuizNotFoundError,
  QuizValidationError,
  SqliteQuizRepository,
} from '../services/quizRepository.ts';

export function createQuizRouter(db: DatabaseSync, storagePaths: StoragePaths) {
  const router = express.Router();
  const repository = new SqliteQuizRepository(db, storagePaths);

  router.use('/quizzes', localAdminGuard);

  router.get('/quizzes/stats', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = repository.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  router.post('/quizzes/random-preview', (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = repository.previewOrDrawRandom(req.body ?? {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/quizzes', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = repository.listQuizzes();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/quizzes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const quiz = repository.getQuizById(String(req.params.id));
      res.json(quiz);
    } catch (error) {
      next(error);
    }
  });

  router.post('/quizzes', (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = repository.createQuiz(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.put('/quizzes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = repository.updateQuiz(String(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/quizzes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      repository.deleteQuiz(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/media/quizzes/:filename', (req: Request, res: Response) => {
    const filePath = resolveSafeQuizMediaFile(String(req.params.filename), storagePaths);
    if (!filePath) {
      res.status(404).json({ error: 'الصورة المطلوبة غير موجودة.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  });

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      error instanceof QuizValidationError ||
      error instanceof QuizNotFoundError ||
      error instanceof MediaValidationError
    ) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  });

  return router;
}

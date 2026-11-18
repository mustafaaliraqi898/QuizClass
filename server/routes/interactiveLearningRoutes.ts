import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import { localAdminGuard } from '../middleware/localAdminGuard.ts';
import {
  InteractiveActivityNotFoundError,
  InteractiveActivityValidationError,
  SqliteInteractiveLearningRepository,
} from '../services/interactiveLearningRepository.ts';

export function createInteractiveLearningRouter(
  db: DatabaseSync,
  storagePaths: StoragePaths
) {
  const router = express.Router();
  const repository = new SqliteInteractiveLearningRepository(db, storagePaths);

  router.use('/interactive-activities', localAdminGuard);

  router.get('/interactive-activities', (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(repository.listActivities());
    } catch (error) {
      next(error);
    }
  });

  router.get('/interactive-activities/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const activity = repository.getActivityById(String(req.params.id));
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });

  router.post('/interactive-activities', (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = repository.createActivity(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.put('/interactive-activities/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = repository.updateActivity(String(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/interactive-activities/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      repository.deleteActivity(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      error instanceof InteractiveActivityValidationError ||
      error instanceof InteractiveActivityNotFoundError
    ) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });

  return router;
}

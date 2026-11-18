import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { localAdminGuard } from '../middleware/localAdminGuard.ts';
import {
  ResultsArchiveNotFoundError,
  ResultsArchiveValidationError,
  SqliteResultsArchiveRepository,
} from '../services/resultsArchiveRepository.ts';

export function createResultsArchiveRouter(db: DatabaseSync) {
  const router = express.Router();
  const repository = new SqliteResultsArchiveRepository(db);

  router.use('/results', localAdminGuard);

  router.get('/results', (req: Request, res: Response, next: NextFunction) => {
    try {
      const sortParam = typeof req.query.sort === 'string' ? req.query.sort : undefined;
      const result = repository.listArchivedResults({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        sort: sortParam === 'oldest' ? 'oldest' : 'newest',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/results/:archiveId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = repository.getArchivedResultById(String(req.params.archiveId));
      res.json(details);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/results/:archiveId/participants/:participantId',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const details = repository.getArchivedParticipantDetails(
          String(req.params.archiveId),
          String(req.params.participantId)
        );
        res.json(details);
      } catch (error) {
        next(error);
      }
    }
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      error instanceof ResultsArchiveValidationError ||
      error instanceof ResultsArchiveNotFoundError
    ) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  });

  return router;
}

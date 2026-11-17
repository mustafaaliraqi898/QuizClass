import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import type {
  QuestionDifficulty,
  QuestionFilterParams,
  QuestionType,
} from '../../src/types/questionBank.ts';
import { localAdminGuard } from '../middleware/localAdminGuard.ts';
import {
  deleteMediaFilesIfUnreferenced,
  MAX_IMAGE_SIZE_BYTES,
  MediaValidationError,
  normalizeMediaRelativePath,
  resolveSafeQuestionMediaFile,
  saveUploadedQuestionImage,
} from '../services/mediaStorageService.ts';
import {
  QuestionNotFoundError,
  QuestionValidationError,
  SqliteQuestionBankRepository,
} from '../services/questionBankRepository.ts';

export function createQuestionBankRouter(db: DatabaseSync, storagePaths: StoragePaths) {
  const router = express.Router();
  const repository = new SqliteQuestionBankRepository(db, storagePaths);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_SIZE_BYTES,
      files: 1,
    },
  });

  router.use('/questions', localAdminGuard);

  router.get('/questions/stats', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = repository.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  router.get('/questions', (req: Request, res: Response, next: NextFunction) => {
    try {
      const typeParam = typeof req.query.type === 'string' ? req.query.type : undefined;
      const difficultyParam =
        typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;

      const filters: QuestionFilterParams = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        type:
          typeParam === 'multiple_choice' || typeParam === 'true_false'
            ? (typeParam as QuestionType)
            : 'all',
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        grade: typeof req.query.grade === 'string' ? req.query.grade : undefined,
        topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
        difficulty:
          difficultyParam === 'easy' ||
          difficultyParam === 'medium' ||
          difficultyParam === 'hard'
            ? (difficultyParam as QuestionDifficulty)
            : 'all',
      };

      const result = repository.listQuestions(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/questions/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const question = repository.getQuestionById(String(req.params.id));
      res.json(question);
    } catch (error) {
      next(error);
    }
  });

  router.post('/questions', (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = repository.createQuestion(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.put('/questions/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = repository.updateQuestion(String(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/questions/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      repository.deleteQuestion(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/media/upload',
    localAdminGuard,
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('image')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            next(
              new MediaValidationError(
                'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).',
                413
              )
            );
            return;
          }
          next(new MediaValidationError('تعذر معالجة ملف الصورة المرفوع.'));
          return;
        }
        if (err) {
          next(err);
          return;
        }
        next();
      });
    },
    (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new MediaValidationError('لم يتم إرفاق أي ملف صورة.');
        }

        const saved = saveUploadedQuestionImage(
          req.file.buffer,
          req.file.mimetype,
          storagePaths
        );
        res.status(201).json(saved);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete('/media', localAdminGuard, (req: Request, res: Response, next: NextFunction) => {
    try {
      const imagePath =
        typeof req.body?.imagePath === 'string'
          ? req.body.imagePath
          : typeof req.query.imagePath === 'string'
            ? req.query.imagePath
            : null;

      if (!imagePath) {
        throw new MediaValidationError('مسار الصورة مطلوب.');
      }

      const normalized = normalizeMediaRelativePath(imagePath);
      if (normalized) {
        deleteMediaFilesIfUnreferenced(db, storagePaths, [normalized]);
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/media/questions/:filename', (req: Request, res: Response) => {
    const filePath = resolveSafeQuestionMediaFile(
      String(req.params.filename),
      storagePaths
    );
    if (!filePath) {
      res.status(404).json({ error: 'الصورة المطلوبة غير موجودة.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (
      error instanceof QuestionValidationError ||
      error instanceof QuestionNotFoundError ||
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

  return router;
}

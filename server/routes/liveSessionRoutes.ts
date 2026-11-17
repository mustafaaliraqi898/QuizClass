import express, { type NextFunction, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import { localAdminGuard } from '../middleware/localAdminGuard.ts';
import {
  LiveSessionConflictError,
  LiveSessionNotFoundError,
  LiveSessionValidationError,
  SqliteLiveSessionRepository,
} from '../services/liveSessionRepository.ts';
import type { LiveSessionBroadcastHub } from '../services/liveSessionSocket.ts';

function resolveRequestOrigin(req: Request): string | null {
  const host = req.headers.host;
  if (!host) return null;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : req.protocol || 'http';
  return `${proto}://${host}`;
}

function resolveRequestPort(req: Request): number {
  const localPort = req.socket?.localPort;
  if (typeof localPort === 'number' && localPort > 0) {
    return localPort;
  }
  return Number(process.env.PORT ?? 3000);
}

export function createLiveSessionRouter(
  db: DatabaseSync,
  storagePaths: StoragePaths,
  liveSocketHub: LiveSessionBroadcastHub
) {
  const router = express.Router();
  const repository = new SqliteLiveSessionRepository(db, storagePaths);

  // مسارات الطلاب عبر الشبكة المحلية (متاحة لهواتف الطلاب دون localAdminGuard وبدون كشف أي إجابات)
  router.get('/live-sessions/lookup', (req: Request, res: Response, next: NextFunction) => {
    try {
      const info = repository.lookupPublicSessionByPin(req.query.pin);
      res.json({ session: info });
    } catch (error) {
      next(error);
    }
  });

  router.post('/live-sessions/join', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = repository.joinSession(req.body);
      await liveSocketHub.broadcastTeacherSessionUpdate(
        result.session.sessionId,
        resolveRequestOrigin(req)
      );
      res.status(result.reconnected ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  // استعادة حالة الطالب بأمان (بعد التحقق من participantId + reconnectToken)
  router.get(
    '/live-sessions/:id/student-state',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const participantId =
          typeof req.query.participantId === 'string' ? req.query.participantId : '';
        const reconnectToken =
          typeof req.query.reconnectToken === 'string'
            ? req.query.reconnectToken
            : typeof req.headers['x-reconnect-token'] === 'string'
              ? req.headers['x-reconnect-token']
              : '';

        repository.verifyParticipantAuth({
          sessionId,
          participantId,
          reconnectToken,
        });

        const state = repository.getStudentLiveState(sessionId, participantId);
        res.json(state);
      } catch (error) {
        next(error);
      }
    }
  );

  // إرسال إجابة الطالب (مسار HTTP مساند إضافةً إلى Socket.IO)
  router.post(
    '/live-sessions/:id/answer',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const result = repository.submitStudentAnswer({
          sessionId,
          participantId: typeof body.participantId === 'string' ? body.participantId : '',
          reconnectToken: typeof body.reconnectToken === 'string' ? body.reconnectToken : '',
          sessionQuestionId:
            typeof body.sessionQuestionId === 'string' ? body.sessionQuestionId : '',
          selectedOptionId:
            typeof body.selectedOptionId === 'string' ? body.selectedOptionId : null,
          selectedBoolean:
            typeof body.selectedBoolean === 'boolean' ? body.selectedBoolean : null,
        });

        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // مسارات المعلم المحمية بـ localAdminGuard
  router.get(
    '/live-sessions',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await repository.listSessionsForTeacher({
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/live-sessions',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body =
          req.body && typeof req.body === 'object'
            ? (req.body as { quizId?: string; settings?: unknown })
            : {};
        const session = await repository.createSession(body.quizId ?? '', {
          settings: body.settings,
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        res.status(201).json(session);
      } catch (error) {
        if (error instanceof LiveSessionConflictError) {
          try {
            const existingSession = await repository.getTeacherSessionDetails(
              error.existingSessionId,
              {
                port: resolveRequestPort(req),
                requestOrigin: resolveRequestOrigin(req),
              }
            );
            res.status(409).json({
              error: error.message,
              code: error.code,
              existingSession,
            });
            return;
          } catch (innerErr) {
            next(innerErr);
            return;
          }
        }
        next(error);
      }
    }
  );

  router.get(
    '/live-sessions/:id',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await repository.getTeacherSessionDetails(String(req.params.id), {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/live-sessions/:id/settings',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.updateSessionSettings(sessionId, req.body, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/live-sessions/:id/start',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const body =
          req.body && typeof req.body === 'object'
            ? (req.body as { settings?: unknown })
            : {};
        const session = await repository.startSession(sessionId, {
          settings: body.settings,
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/live-sessions/:id/next-question',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.nextQuestionByTeacher(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/live-sessions/:id/complete',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.completeSession(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/live-sessions/:id/cancel',
    localAdminGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.cancelSession(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req),
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      error instanceof LiveSessionValidationError ||
      error instanceof LiveSessionNotFoundError
    ) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  });

  return router;
}

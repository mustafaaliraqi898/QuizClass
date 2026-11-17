import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { StoragePaths } from '../config/storagePaths.ts';
import { SqliteLiveSessionRepository } from './liveSessionRepository.ts';

interface SocketClientData {
  role?: 'teacher' | 'student';
  sessionId?: string;
  participantId?: string;
}

interface AckPayload<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface LiveSessionBroadcastHub {
  broadcastTeacherSessionUpdate(sessionId: string, requestOrigin?: string | null): Promise<void>;
  broadcastStudentSessionStatus(sessionId: string): void;
  close(): Promise<void>;
}

export const NOOP_LIVE_SESSION_HUB: LiveSessionBroadcastHub = {
  async broadcastTeacherSessionUpdate() {
    // No-op when Socket.IO is not attached
  },
  broadcastStudentSessionStatus() {
    // No-op when Socket.IO is not attached
  },
  async close() {
    // No-op
  },
};

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isSocketFromLocalAdmin(req: IncomingMessage): boolean {
  if (process.env.QUIZCLASS_ALLOW_REMOTE_ADMIN === 'true') {
    return true;
  }

  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress && LOOPBACK_IPS.has(remoteAddress)) {
    return true;
  }

  const appUrl = process.env.APP_URL;
  const isCloudRun = Boolean(process.env.K_SERVICE || (appUrl && appUrl.startsWith('https://')));
  if (!isCloudRun) {
    return false;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers.host;
  if (forwardedProto !== 'https' || !hostHeader) {
    return false;
  }

  if (appUrl) {
    try {
      const expectedHost = new URL(appUrl).host;
      if (hostHeader === expectedHost) return true;
    } catch {
      return false;
    }
  }

  return hostHeader.endsWith('.run.app');
}

function resolveSocketRequestOrigin(req: IncomingMessage): string | null {
  const host = req.headers.host;
  if (!host) return null;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string' && protoHeader.trim()
      ? protoHeader.split(',')[0].trim()
      : 'http';
  return `${proto}://${host}`;
}

export function attachLiveSessionSocket(
  httpServer: HttpServer,
  db: DatabaseSync,
  storagePaths: StoragePaths
): LiveSessionBroadcastHub & { io: SocketIOServer } {
  const repository = new SqliteLiveSessionRepository(db, storagePaths);
  repository.markAllParticipantsDisconnectedOnBoot();

  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 10000,
  });

  // يتتبع معرّفات اتصالات Socket النشطة لكل طالب لتجنب اعتباره منقطعاً عند فتح تبويب/إعادة اتصال متداخلة
  const activeParticipantSockets = new Map<string, Set<string>>();

  const getServerPort = (): number => {
    const addr = httpServer.address();
    if (addr && typeof addr === 'object' && 'port' in addr) {
      return addr.port;
    }
    return Number(process.env.PORT ?? 3000);
  };

  const teacherRoom = (sessionId: string) => `session:${sessionId}:teacher`;
  const studentRoom = (sessionId: string) => `session:${sessionId}:students`;

  const broadcastTeacherSessionUpdate = async (
    sessionId: string,
    requestOrigin?: string | null
  ): Promise<void> => {
    try {
      const details = await repository.getTeacherSessionDetails(sessionId, {
        port: getServerPort(),
        requestOrigin,
      });
      io.to(teacherRoom(sessionId)).emit('session:teacher_state', details);
    } catch {
      // Session may have been deleted or no longer accessible
    }
  };

  const broadcastStudentSessionStatus = (sessionId: string): void => {
    try {
      const publicSession = repository.getStudentPublicSessionById(sessionId);
      io.to(studentRoom(sessionId)).emit('session:student_status', {
        session: publicSession,
      });
    } catch {
      // Ignore if session not found
    }
  };

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketClientData;

    socket.on(
      'teacher:subscribe',
      async (
        payload: { sessionId?: string; hostToken?: string },
        ack?: (res: AckPayload) => void
      ) => {
        try {
          if (!isSocketFromLocalAdmin(socket.request)) {
            ack?.({ ok: false, error: 'غير مصرح بمتابعة لوحة المعلم من هذا الجهاز.' });
            return;
          }

          const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
          const hostToken = typeof payload?.hostToken === 'string' ? payload.hostToken.trim() : '';
          if (!sessionId || !hostToken || !repository.verifyTeacherHostToken(sessionId, hostToken)) {
            ack?.({ ok: false, error: 'تعذر التحقق من صلاحية المعلم لهذه الجلسة.' });
            return;
          }

          // مغادرة أي غرفة معلم سابقة عند التبديل بين جلسات
          for (const room of socket.rooms) {
            if (room !== socket.id && room.startsWith('session:')) {
              await socket.leave(room);
            }
          }

          data.role = 'teacher';
          data.sessionId = sessionId;
          data.participantId = undefined;

          await socket.join(teacherRoom(sessionId));

          const details = await repository.getTeacherSessionDetails(sessionId, {
            port: getServerPort(),
            requestOrigin: resolveSocketRequestOrigin(socket.request),
          });
          socket.emit('session:teacher_state', details);
          ack?.({ ok: true, data: details });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'تعذر ربط شاشة المعلم بالجلسة المباشرة.';
          ack?.({ ok: false, error: message });
        }
      }
    );

    socket.on(
      'student:subscribe',
      async (
        payload: { sessionId?: string; participantId?: string; reconnectToken?: string },
        ack?: (res: AckPayload) => void
      ) => {
        try {
          const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
          const participantId =
            typeof payload?.participantId === 'string' ? payload.participantId.trim() : '';
          const reconnectToken =
            typeof payload?.reconnectToken === 'string' ? payload.reconnectToken.trim() : '';

          const verified = repository.verifyParticipantAuth({
            sessionId,
            participantId,
            reconnectToken,
          });

          if (verified.session.status === 'completed' || verified.session.status === 'cancelled') {
            ack?.({
              ok: false,
              error:
                verified.session.status === 'completed'
                  ? 'انتهت هذه المسابقة بالفعل.'
                  : 'تم إلغاء هذه الجلسة.',
            });
            return;
          }

          // التحقق من عدم استخدام نفس Socket لانتحال مشارك أو جلسة أخرى
          if (data.role === 'student' && data.participantId && data.participantId !== participantId) {
            const oldSockets = activeParticipantSockets.get(data.participantId);
            oldSockets?.delete(socket.id);
          }

          for (const room of socket.rooms) {
            if (room !== socket.id && room.startsWith('session:')) {
              await socket.leave(room);
            }
          }

          data.role = 'student';
          data.sessionId = verified.session.sessionId;
          data.participantId = verified.participant.id;

          let socketSet = activeParticipantSockets.get(verified.participant.id);
          if (!socketSet) {
            socketSet = new Set<string>();
            activeParticipantSockets.set(verified.participant.id, socketSet);
          }
          socketSet.add(socket.id);

          const updatedParticipant = repository.setParticipantConnectionStatus(
            verified.session.sessionId,
            verified.participant.id,
            'connected'
          );

          await socket.join(studentRoom(verified.session.sessionId));

          const safeStudentPayload = {
            session: verified.session,
            participant: {
              id: verified.participant.id,
              sessionId: verified.participant.sessionId,
              displayName: verified.participant.displayName,
              connectionStatus: updatedParticipant?.connectionStatus ?? 'connected',
              joinedAt: verified.participant.joinedAt,
            },
          };

          socket.emit('session:student_state', safeStudentPayload);
          ack?.({ ok: true, data: safeStudentPayload });

          await broadcastTeacherSessionUpdate(
            verified.session.sessionId,
            resolveSocketRequestOrigin(socket.request)
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'فشل التحقق من جلسة الطالب.';
          ack?.({ ok: false, error: message });
        }
      }
    );

    // منع الطالب صراحةً من إرسال أي أوامر تحكم في الجلسة أو المؤقت
    const rejectUnauthorizedControl = (_payload: unknown, ack?: (res: AckPayload) => void) => {
      ack?.({ ok: false, error: 'غير مصرح للمشاركين بالتحكم في الجلسة أو المؤقت.' });
    };
    socket.on('session:start', rejectUnauthorizedControl);
    socket.on('session:cancel', rejectUnauthorizedControl);
    socket.on('session:complete', rejectUnauthorizedControl);
    socket.on('session:next_question', rejectUnauthorizedControl);

    socket.on('disconnect', async () => {
      if (data.role !== 'student' || !data.sessionId || !data.participantId) {
        return;
      }

      const socketSet = activeParticipantSockets.get(data.participantId);
      if (socketSet) {
        socketSet.delete(socket.id);
        if (socketSet.size > 0) {
          // لا يزال لدى الطالب اتصال نشط آخر
          return;
        }
        activeParticipantSockets.delete(data.participantId);
      }

      repository.setParticipantConnectionStatus(data.sessionId, data.participantId, 'disconnected');
      await broadcastTeacherSessionUpdate(
        data.sessionId,
        resolveSocketRequestOrigin(socket.request)
      );
    });
  });

  return {
    io,
    broadcastTeacherSessionUpdate,
    broadcastStudentSessionStatus,
    async close() {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}

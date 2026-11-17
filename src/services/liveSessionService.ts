import type {
  LiveSessionConflictPayload,
  LiveSessionListResponse,
  StudentJoinRequest,
  StudentJoinResponse,
  StudentPublicSessionInfo,
  TeacherLiveSessionDetails,
} from '../types/liveSession';

export class LiveSessionConflictClientError extends Error {
  existingSession: TeacherLiveSessionDetails;

  constructor(payload: LiveSessionConflictPayload) {
    super(payload.error);
    this.name = 'LiveSessionConflictClientError';
    this.existingSession = payload.existingSession;
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let body: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    if (
      response.status === 409 &&
      body &&
      typeof body === 'object' &&
      'code' in body &&
      (body as { code: unknown }).code === 'ACTIVE_SESSION_EXISTS' &&
      'existingSession' in body
    ) {
      throw new LiveSessionConflictClientError(body as LiveSessionConflictPayload);
    }

    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'تعذر إتمام عملية الجلسة المباشرة مع الخادم المحلي.';
    throw new Error(message);
  }

  return body as T;
}

export const httpLiveSessionService = {
  async listSessions(options?: { signal?: AbortSignal }): Promise<LiveSessionListResponse> {
    const response = await fetch('/api/live-sessions', { signal: options?.signal });
    return parseJsonOrThrow<LiveSessionListResponse>(response);
  },

  async createSession(quizId: string): Promise<TeacherLiveSessionDetails> {
    const response = await fetch('/api/live-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    });
    return parseJsonOrThrow<TeacherLiveSessionDetails>(response);
  },

  async getSessionById(sessionId: string): Promise<TeacherLiveSessionDetails> {
    const response = await fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}`);
    return parseJsonOrThrow<TeacherLiveSessionDetails>(response);
  },

  async startSession(sessionId: string): Promise<TeacherLiveSessionDetails> {
    const response = await fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}/start`, {
      method: 'POST',
    });
    return parseJsonOrThrow<TeacherLiveSessionDetails>(response);
  },

  async completeSession(sessionId: string): Promise<TeacherLiveSessionDetails> {
    const response = await fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
    });
    return parseJsonOrThrow<TeacherLiveSessionDetails>(response);
  },

  async cancelSession(sessionId: string): Promise<TeacherLiveSessionDetails> {
    const response = await fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
    });
    return parseJsonOrThrow<TeacherLiveSessionDetails>(response);
  },

  async lookupPublicSession(
    pinCode: string,
    options?: { signal?: AbortSignal }
  ): Promise<StudentPublicSessionInfo> {
    const response = await fetch(
      `/api/live-sessions/lookup?pin=${encodeURIComponent(pinCode)}`,
      { signal: options?.signal }
    );
    const data = await parseJsonOrThrow<{ session: StudentPublicSessionInfo }>(response);
    return data.session;
  },

  async joinSession(payload: StudentJoinRequest): Promise<StudentJoinResponse> {
    const response = await fetch('/api/live-sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<StudentJoinResponse>(response);
  },
};

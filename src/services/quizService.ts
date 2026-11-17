import type {
  QuizListResponse,
  QuizPayload,
  QuizRecord,
  QuizStats,
  RandomSelectionRequest,
  RandomSelectionResponse,
} from '../types/quiz';

export interface QuizService {
  listQuizzes(options?: { signal?: AbortSignal }): Promise<QuizListResponse>;
  getQuizById(id: string): Promise<QuizRecord>;
  getStats(): Promise<QuizStats>;
  previewOrDrawRandom(
    request: RandomSelectionRequest,
    options?: { signal?: AbortSignal }
  ): Promise<RandomSelectionResponse>;
  createQuiz(payload: QuizPayload): Promise<QuizRecord>;
  updateQuiz(id: string, payload: QuizPayload): Promise<QuizRecord>;
  deleteQuiz(id: string): Promise<void>;
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
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'تعذر إتمام العملية مع قاعدة البيانات المحلية.';
    throw new Error(message);
  }

  return body as T;
}

export const httpQuizService: QuizService = {
  async listQuizzes(options?: { signal?: AbortSignal }): Promise<QuizListResponse> {
    const response = await fetch('/api/quizzes', { signal: options?.signal });
    return parseJsonOrThrow<QuizListResponse>(response);
  },

  async getQuizById(id: string): Promise<QuizRecord> {
    const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}`);
    return parseJsonOrThrow<QuizRecord>(response);
  },

  async getStats(): Promise<QuizStats> {
    const response = await fetch('/api/quizzes/stats');
    return parseJsonOrThrow<QuizStats>(response);
  },

  async previewOrDrawRandom(
    request: RandomSelectionRequest,
    options?: { signal?: AbortSignal }
  ): Promise<RandomSelectionResponse> {
    const response = await fetch('/api/quizzes/random-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options?.signal,
    });
    return parseJsonOrThrow<RandomSelectionResponse>(response);
  },

  async createQuiz(payload: QuizPayload): Promise<QuizRecord> {
    const response = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<QuizRecord>(response);
  },

  async updateQuiz(id: string, payload: QuizPayload): Promise<QuizRecord> {
    const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<QuizRecord>(response);
  },

  async deleteQuiz(id: string): Promise<void> {
    const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseJsonOrThrow<void>(response);
  },
};

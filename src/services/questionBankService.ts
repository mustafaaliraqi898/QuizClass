import type {
  QuestionBankListResponse,
  QuestionBankStats,
  QuestionFilterParams,
  QuestionPayload,
  QuestionRecord,
  UploadedMediaAsset,
} from '../types/questionBank';

export interface QuestionBankService {
  listQuestions(
    filters?: QuestionFilterParams,
    options?: { signal?: AbortSignal }
  ): Promise<QuestionBankListResponse>;
  getQuestionById(id: string): Promise<QuestionRecord>;
  createQuestion(payload: QuestionPayload): Promise<QuestionRecord>;
  updateQuestion(id: string, payload: QuestionPayload): Promise<QuestionRecord>;
  deleteQuestion(id: string): Promise<void>;
  getStats(): Promise<QuestionBankStats>;
  uploadImage(file: File): Promise<UploadedMediaAsset>;
  deleteUnusedImage(imagePath: string): Promise<void>;
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

export const httpQuestionBankService: QuestionBankService = {
  async listQuestions(
    filters: QuestionFilterParams = {},
    options?: { signal?: AbortSignal }
  ): Promise<QuestionBankListResponse> {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.subject && filters.subject !== 'all') params.set('subject', filters.subject);
    if (filters.grade && filters.grade !== 'all') params.set('grade', filters.grade);
    if (filters.topic && filters.topic !== 'all') params.set('topic', filters.topic);
    if (filters.difficulty && filters.difficulty !== 'all') {
      params.set('difficulty', filters.difficulty);
    }

    const queryString = params.toString();
    const url = queryString ? `/api/questions?${queryString}` : '/api/questions';
    const response = await fetch(url, { signal: options?.signal });
    return parseJsonOrThrow<QuestionBankListResponse>(response);
  },

  async getQuestionById(id: string): Promise<QuestionRecord> {
    const response = await fetch(`/api/questions/${encodeURIComponent(id)}`);
    return parseJsonOrThrow<QuestionRecord>(response);
  },

  async createQuestion(payload: QuestionPayload): Promise<QuestionRecord> {
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<QuestionRecord>(response);
  },

  async updateQuestion(id: string, payload: QuestionPayload): Promise<QuestionRecord> {
    const response = await fetch(`/api/questions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<QuestionRecord>(response);
  },

  async deleteQuestion(id: string): Promise<void> {
    const response = await fetch(`/api/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseJsonOrThrow<void>(response);
  },

  async getStats(): Promise<QuestionBankStats> {
    const response = await fetch('/api/questions/stats');
    return parseJsonOrThrow<QuestionBankStats>(response);
  },

  async uploadImage(file: File): Promise<UploadedMediaAsset> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
    return parseJsonOrThrow<UploadedMediaAsset>(response);
  },

  async deleteUnusedImage(imagePath: string): Promise<void> {
    const response = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    });
    await parseJsonOrThrow<void>(response);
  },
};

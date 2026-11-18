import type {
  InteractiveActivityListResponse,
  InteractiveActivityPayload,
  InteractiveActivityRecord,
} from '../types/interactiveLearning';

export interface InteractiveLearningService {
  listActivities(options?: { signal?: AbortSignal }): Promise<InteractiveActivityListResponse>;
  getActivityById(id: string, options?: { signal?: AbortSignal }): Promise<InteractiveActivityRecord>;
  createActivity(payload: InteractiveActivityPayload): Promise<InteractiveActivityRecord>;
  updateActivity(id: string, payload: InteractiveActivityPayload): Promise<InteractiveActivityRecord>;
  deleteActivity(id: string): Promise<void>;
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

export const httpInteractiveLearningService: InteractiveLearningService = {
  async listActivities(options?: { signal?: AbortSignal }): Promise<InteractiveActivityListResponse> {
    const response = await fetch('/api/interactive-activities', {
      signal: options?.signal,
    });
    return parseJsonOrThrow<InteractiveActivityListResponse>(response);
  },

  async getActivityById(
    id: string,
    options?: { signal?: AbortSignal }
  ): Promise<InteractiveActivityRecord> {
    const response = await fetch(`/api/interactive-activities/${encodeURIComponent(id)}`, {
      signal: options?.signal,
    });
    return parseJsonOrThrow<InteractiveActivityRecord>(response);
  },

  async createActivity(payload: InteractiveActivityPayload): Promise<InteractiveActivityRecord> {
    const response = await fetch('/api/interactive-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<InteractiveActivityRecord>(response);
  },

  async updateActivity(
    id: string,
    payload: InteractiveActivityPayload
  ): Promise<InteractiveActivityRecord> {
    const response = await fetch(`/api/interactive-activities/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<InteractiveActivityRecord>(response);
  },

  async deleteActivity(id: string): Promise<void> {
    const response = await fetch(`/api/interactive-activities/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseJsonOrThrow<void>(response);
  },
};

import type {
  ArchivedParticipantDetailsResponse,
  ArchivedResultsFilterParams,
  ArchivedResultsListResponse,
  ArchivedResultSessionDetails,
} from '../types/resultsArchive';

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
        : 'تعذر قراءة أرشيف النتائج من قاعدة البيانات المحلية.';
    throw new Error(message);
  }

  return body as T;
}

export const httpResultsArchiveService = {
  async listArchivedResults(
    filters: ArchivedResultsFilterParams = {},
    options?: { signal?: AbortSignal }
  ): Promise<ArchivedResultsListResponse> {
    const params = new URLSearchParams();
    if (filters.search && filters.search.trim().length > 0) {
      params.set('search', filters.search.trim());
    }
    if (filters.date && filters.date.trim().length > 0) {
      params.set('date', filters.date.trim());
    }
    if (filters.dateFrom && filters.dateFrom.trim().length > 0) {
      params.set('dateFrom', filters.dateFrom.trim());
    }
    if (filters.dateTo && filters.dateTo.trim().length > 0) {
      params.set('dateTo', filters.dateTo.trim());
    }
    if (filters.sort) {
      params.set('sort', filters.sort);
    }

    const qs = params.toString();
    const url = qs ? `/api/results?${qs}` : '/api/results';
    const response = await fetch(url, { signal: options?.signal });
    return parseJsonOrThrow<ArchivedResultsListResponse>(response);
  },

  async getArchivedResultById(
    archiveId: string,
    options?: { signal?: AbortSignal }
  ): Promise<ArchivedResultSessionDetails> {
    const response = await fetch(`/api/results/${encodeURIComponent(archiveId)}`, {
      signal: options?.signal,
    });
    return parseJsonOrThrow<ArchivedResultSessionDetails>(response);
  },

  async getArchivedParticipantDetails(
    archiveId: string,
    participantId: string,
    options?: { signal?: AbortSignal }
  ): Promise<ArchivedParticipantDetailsResponse> {
    const response = await fetch(
      `/api/results/${encodeURIComponent(archiveId)}/participants/${encodeURIComponent(participantId)}`,
      {
        signal: options?.signal,
      }
    );
    return parseJsonOrThrow<ArchivedParticipantDetailsResponse>(response);
  },
};

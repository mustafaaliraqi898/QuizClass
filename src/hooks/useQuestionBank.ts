import { useCallback, useEffect, useRef, useState } from 'react';
import {
  httpQuestionBankService,
  type QuestionBankService,
} from '../services/questionBankService';
import type {
  QuestionBankStats,
  QuestionFacets,
  QuestionFilterParams,
  QuestionPayload,
  QuestionRecord,
  QuestionSyncResponse,
  QuestionUpdateResult,
} from '../types/questionBank';

const EMPTY_FACETS: QuestionFacets = {
  subjects: [],
  grades: [],
  topics: [],
};

const EMPTY_STATS: QuestionBankStats = {
  totalQuestions: 0,
  multipleChoiceCount: 0,
  trueFalseCount: 0,
  subjectCount: 0,
};

export function useQuestionBank(service: QuestionBankService = httpQuestionBankService) {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [facets, setFacets] = useState<QuestionFacets>(EMPTY_FACETS);
  const [stats, setStats] = useState<QuestionBankStats>(EMPTY_STATS);
  const [filters, setFilters] = useState<QuestionFilterParams>({
    search: '',
    type: 'all',
    subject: 'all',
    grade: 'all',
    topic: 'all',
    difficulty: 'all',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const activeAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);

  const fetchQuestions = useCallback(
    async (activeFilters: QuestionFilterParams) => {
      activeAbortRef.current?.abort();
      const controller = new AbortController();
      activeAbortRef.current = controller;
      const reqId = ++requestSeqRef.current;

      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await service.listQuestions(activeFilters, {
          signal: controller.signal,
        });
        if (reqId !== requestSeqRef.current) return;

        setQuestions(result.questions);
        setFacets(result.facets);
        setStats(result.stats);

        // Reset stale classification filters if the last matching item was deleted/updated
        const nextSubjectInvalid =
          activeFilters.subject &&
          activeFilters.subject !== 'all' &&
          !result.facets.subjects.includes(activeFilters.subject);
        const nextGradeInvalid =
          activeFilters.grade &&
          activeFilters.grade !== 'all' &&
          !result.facets.grades.includes(activeFilters.grade);
        const nextTopicInvalid =
          activeFilters.topic &&
          activeFilters.topic !== 'all' &&
          !result.facets.topics.includes(activeFilters.topic);

        if (nextSubjectInvalid || nextGradeInvalid || nextTopicInvalid) {
          setFilters((prev) => ({
            ...prev,
            subject: nextSubjectInvalid ? 'all' : prev.subject,
            grade: nextGradeInvalid ? 'all' : prev.grade,
            topic: nextTopicInvalid ? 'all' : prev.topic,
          }));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (reqId !== requestSeqRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الأسئلة من قاعدة البيانات المحلية.';
        setLoadError(message);
      } finally {
        if (reqId === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [service]
  );

  useEffect(() => {
    void fetchQuestions(filters);
    return () => {
      activeAbortRef.current?.abort();
    };
  }, [fetchQuestions, filters]);

  const refresh = useCallback(async () => {
    await fetchQuestions(filters);
  }, [fetchQuestions, filters]);

  const createQuestion = useCallback(
    async (payload: QuestionPayload): Promise<QuestionRecord> => {
      setIsMutating(true);
      setFeedback(null);
      try {
        const created = await service.createQuestion(payload);
        await fetchQuestions(filters);
        setFeedback({
          type: 'success',
          message: 'تم حفظ السؤال في بنك الأسئلة بنجاح.',
        });
        return created;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
  );

  const updateQuestion = useCallback(
    async (id: string, payload: QuestionPayload): Promise<QuestionUpdateResult> => {
      setIsMutating(true);
      setFeedback(null);
      try {
        const updated = await service.updateQuestion(id, payload);
        await fetchQuestions(filters);
        setFeedback({
          type: 'success',
          message: 'تم تعديل السؤال في بنك الأسئلة بنجاح.',
        });
        return updated;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
  );

  const syncQuestionToQuizzes = useCallback(
    async (id: string): Promise<QuestionSyncResponse> => {
      setIsMutating(true);
      try {
        return await service.syncQuestionToQuizzes(id);
      } finally {
        setIsMutating(false);
      }
    },
    [service]
  );

  const deleteQuestion = useCallback(
    async (id: string): Promise<void> => {
      setIsMutating(true);
      setFeedback(null);
      try {
        await service.deleteQuestion(id);
        await fetchQuestions(filters);
        setFeedback({
          type: 'success',
          message: 'تم حذف السؤال من بنك الأسئلة.',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
  );

  const importQuestionsBatch = useCallback(
    async (payloads: QuestionPayload[]) => {
      setIsMutating(true);
      setFeedback(null);
      try {
        const result = await service.createQuestionsBatch(payloads);
        await fetchQuestions(filters);
        setFeedback({
          type: 'success',
          message: `تم استيراد ${result.count} ${
            result.count === 1 ? 'سؤال' : result.count === 2 ? 'سؤالين' : 'أسئلة'
          } بنجاح إلى بنك الأسئلة المحلي.`,
        });
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر استيراد الأسئلة إلى قاعدة البيانات المحلية.';
        setFeedback({
          type: 'error',
          message,
        });
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
  );

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      type: 'all',
      subject: 'all',
      grade: 'all',
      topic: 'all',
      difficulty: 'all',
    });
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    questions,
    facets,
    stats,
    filters,
    setFilters,
    resetFilters,
    isLoading,
    loadError,
    isMutating,
    feedback,
    setFeedback,
    clearFeedback,
    refresh,
    createQuestion,
    importQuestionsBatch,
    updateQuestion,
    syncQuestionToQuizzes,
    deleteQuestion,
    service,
  };
}

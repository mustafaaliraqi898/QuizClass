import { useCallback, useEffect, useState } from 'react';
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
    difficulty: 'all',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchQuestions = useCallback(
    async (activeFilters: QuestionFilterParams) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await service.listQuestions(activeFilters);
        setQuestions(result.questions);
        setFacets(result.facets);
        setStats(result.stats);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الأسئلة من قاعدة البيانات المحلية.';
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  useEffect(() => {
    void fetchQuestions(filters);
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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'تعذر حفظ السؤال في قاعدة البيانات.';
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
  );

  const updateQuestion = useCallback(
    async (id: string, payload: QuestionPayload): Promise<QuestionRecord> => {
      setIsMutating(true);
      setFeedback(null);
      try {
        const updated = await service.updateQuestion(id, payload);
        await fetchQuestions(filters);
        setFeedback({
          type: 'success',
          message: 'تم تحديث السؤال بنجاح.',
        });
        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'تعذر تحديث السؤال في قاعدة البيانات.';
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQuestions, filters, service]
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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'تعذر حذف السؤال من قاعدة البيانات.';
        setFeedback({ type: 'error', message });
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
    clearFeedback,
    refresh,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    service,
  };
}

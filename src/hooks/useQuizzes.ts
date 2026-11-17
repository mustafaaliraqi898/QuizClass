import { useCallback, useEffect, useRef, useState } from 'react';
import { httpQuizService, type QuizService } from '../services/quizService';
import type { QuizStats, QuizSummary } from '../types/quiz';

export interface QuizFeedback {
  type: 'success' | 'error';
  message: string;
}

const EMPTY_STATS: QuizStats = {
  totalQuizzes: 0,
  totalQuizQuestions: 0,
};

export function useQuizzes(service: QuizService = httpQuizService) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [stats, setStats] = useState<QuizStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadQuizzes = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await service.listQuizzes({ signal: controller.signal });
      if (currentRequestId !== requestIdRef.current) return;
      setQuizzes(response.quizzes);
      setStats(response.stats);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (currentRequestId !== requestIdRef.current) return;
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل المسابقات من قاعدة البيانات المحلية.';
      setLoadError(message);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [service]);

  useEffect(() => {
    void loadQuizzes();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadQuizzes]);

  const deleteQuiz = useCallback(
    async (id: string) => {
      setIsMutating(true);
      try {
        await service.deleteQuiz(id);
        await loadQuizzes();
        setFeedback({
          type: 'success',
          message: 'تم حذف المسابقة من قاعدة البيانات المحلية بنجاح.',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'تعذر حذف المسابقة من قاعدة البيانات.';
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [loadQuizzes, service]
  );

  return {
    quizzes,
    stats,
    isLoading,
    loadError,
    isMutating,
    feedback,
    setFeedback,
    clearFeedback: useCallback(() => setFeedback(null), []),
    refresh: loadQuizzes,
    deleteQuiz,
    service,
  };
}

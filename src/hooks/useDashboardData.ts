import { useEffect, useState } from 'react';
import {
  previewDashboardRepository,
  type DashboardRepository,
} from '../services/dashboardRepository';
import type { DashboardSnapshot } from '../types/dashboard';
import {
  PREVIEW_METRICS,
  PREVIEW_RECENT_QUIZZES,
  TEACHER_PROFILE,
} from '../data/previewDashboardData';

const INITIAL_SNAPSHOT: DashboardSnapshot = {
  isPreviewData: true,
  teacher: TEACHER_PROFILE,
  metrics: PREVIEW_METRICS,
  recentQuizzes: PREVIEW_RECENT_QUIZZES,
};

export function useDashboardData(
  repository: DashboardRepository = previewDashboardRepository
) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    repository
      .getSnapshot()
      .then((data) => {
        if (active) {
          setSnapshot(data);
        }
      })
      .catch(() => {
        if (active) {
          setError('تعذر تحميل بيانات لوحة التحكم.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [repository]);

  return {
    ...snapshot,
    isLoading,
    error,
  };
}

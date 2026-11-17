import { useCallback, useEffect, useState } from 'react';
import {
  hybridDashboardRepository,
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
  metrics: [
    {
      id: 'total-questions',
      label: 'إجمالي الأسئلة',
      value: null,
      unitLabel: '',
      detailText: 'جارٍ التحميل من قاعدة البيانات...',
      accentTone: 'indigo',
      dataSource: 'database',
    },
    ...PREVIEW_METRICS,
  ],
  recentQuizzes: PREVIEW_RECENT_QUIZZES,
};

export function useDashboardData(
  repository: DashboardRepository = hybridDashboardRepository
) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await repository.getSnapshot();
      setSnapshot(data);
    } catch {
      setError('تعذر تحميل بيانات لوحة التحكم.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  return {
    ...snapshot,
    isLoading,
    error,
    refreshDashboard: loadSnapshot,
  };
}

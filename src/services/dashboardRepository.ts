import type { DashboardSnapshot } from '../types/dashboard';
import {
  PREVIEW_METRICS,
  PREVIEW_RECENT_QUIZZES,
  TEACHER_PROFILE,
} from '../data/previewDashboardData';

/**
 * واجهة مستودع بيانات لوحة التحكم.
 * تسمح باستبدال مصدر البيانات التجريبي لاحقاً بمصدر SQLite عبر Electron IPC أو الخادم المحلي
 * دون تعديل مكونات واجهة المستخدم.
 */
export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}

/**
 * مزود بيانات المعاينة للمرحلة الأولى (لا يمثل بيانات محفوظة فعلياً في قاعدة بيانات).
 */
export const previewDashboardRepository: DashboardRepository = {
  async getSnapshot(): Promise<DashboardSnapshot> {
    return {
      isPreviewData: true,
      teacher: TEACHER_PROFILE,
      metrics: PREVIEW_METRICS,
      recentQuizzes: PREVIEW_RECENT_QUIZZES,
    };
  },
};

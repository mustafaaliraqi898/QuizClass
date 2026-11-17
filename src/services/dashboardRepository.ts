import type { DashboardMetric, DashboardSnapshot } from '../types/dashboard';
import {
  PREVIEW_METRICS,
  PREVIEW_RECENT_QUIZZES,
  TEACHER_PROFILE,
} from '../data/previewDashboardData';
import { httpQuestionBankService } from './questionBankService';

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}

/**
 * يدمج إجمالي الأسئلة الحقيقي من SQLite مع معاينات الأقسام التي لم تُنفذ بعد.
 * عند فشل قراءة قاعدة البيانات، يعرض حالة خطأ واضحة دون الرجوع إلى أي رقم وهمي.
 */
export const hybridDashboardRepository: DashboardRepository = {
  async getSnapshot(): Promise<DashboardSnapshot> {
    let questionMetric: DashboardMetric;

    try {
      const stats = await httpQuestionBankService.getStats();
      questionMetric = {
        id: 'total-questions',
        label: 'إجمالي الأسئلة',
        value: stats.totalQuestions,
        unitLabel: 'سؤالاً',
        detailText:
          stats.totalQuestions === 0
            ? 'قاعدة البيانات فارغة · أضف أول سؤال'
            : stats.subjectCount > 0
              ? `محفوظة محلياً · موزعة على ${stats.subjectCount} مواد`
              : 'محفوظة فعلياً في قاعدة البيانات المحلية',
        accentTone: 'indigo',
        dataSource: 'database',
      };
    } catch {
      questionMetric = {
        id: 'total-questions',
        label: 'إجمالي الأسئلة',
        value: null,
        unitLabel: '',
        detailText: 'تعذر قراءة العدد من قاعدة البيانات المحلية',
        accentTone: 'indigo',
        dataSource: 'database',
        hasError: true,
      };
    }

    return {
      isPreviewData: true,
      teacher: TEACHER_PROFILE,
      metrics: [questionMetric, ...PREVIEW_METRICS],
      recentQuizzes: PREVIEW_RECENT_QUIZZES,
    };
  },
};

import type { DashboardMetric, DashboardSnapshot } from '../types/dashboard';
import { PREVIEW_METRICS, TEACHER_PROFILE } from '../data/previewDashboardData';
import { httpQuestionBankService } from './questionBankService';
import { httpQuizService } from './quizService';
import type { QuizSummary } from '../types/quiz';

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}

/**
 * يدمج الإحصائيات وقائمة المسابقات الحقيقية من SQLite مع معاينات الأقسام التي لم تُنفذ بعد.
 * عند فشل قراءة قاعدة البيانات، يعرض حالة خطأ واضحة دون الرجوع إلى أي بيانات وهمية.
 */
export const hybridDashboardRepository: DashboardRepository = {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const [questionResult, quizzesResult] = await Promise.allSettled([
      httpQuestionBankService.getStats(),
      httpQuizService.listQuizzes(),
    ]);

    let questionMetric: DashboardMetric;
    if (questionResult.status === 'fulfilled') {
      const stats = questionResult.value;
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
    } else {
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

    let competitionMetric: DashboardMetric;
    let recentQuizzes: QuizSummary[] = [];
    let quizzesError: string | null = null;

    if (quizzesResult.status === 'fulfilled') {
      const { quizzes, stats } = quizzesResult.value;
      recentQuizzes = quizzes.slice(0, 6);
      competitionMetric = {
        id: 'total-competitions',
        label: 'عدد المسابقات',
        value: stats.totalQuizzes,
        unitLabel: 'مسابقة',
        detailText:
          stats.totalQuizzes === 0
            ? 'لا توجد مسابقات بعد · أنشئ أول مسابقة'
            : `محفوظة محلياً · تضم ${stats.totalQuizQuestions} سؤالاً`,
        accentTone: 'emerald',
        dataSource: 'database',
      };
    } else {
      quizzesError =
        quizzesResult.reason instanceof Error
          ? quizzesResult.reason.message
          : 'تعذر تحميل المسابقات من قاعدة البيانات المحلية.';
      competitionMetric = {
        id: 'total-competitions',
        label: 'عدد المسابقات',
        value: null,
        unitLabel: '',
        detailText: 'تعذر قراءة العدد من قاعدة البيانات المحلية',
        accentTone: 'emerald',
        dataSource: 'database',
        hasError: true,
      };
    }

    return {
      isPreviewData: false,
      teacher: TEACHER_PROFILE,
      metrics: [questionMetric, competitionMetric],
      recentQuizzes,
      quizzesError,
    };
  },
};


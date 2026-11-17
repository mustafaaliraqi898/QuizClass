import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { NavSectionId, RecentQuizItem } from '../../types/dashboard';
import { QuizStatusLabel } from '../common/QuizStatusLabel';

interface QuizPreviewDrawerProps {
  quiz: RecentQuizItem | null;
  onClose: () => void;
  onNavigate: (section: NavSectionId) => void;
}

export function QuizPreviewDrawer({ quiz, onClose, onNavigate }: QuizPreviewDrawerProps) {
  useEffect(() => {
    if (!quiz) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quiz, onClose]);

  if (!quiz) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between border-s border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              معاينة تفاصيل المسابقة
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="إغلاق المعاينة"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{quiz.subject}</span>
                <span aria-hidden="true">·</span>
                <span>{quiz.grade}</span>
                <span aria-hidden="true">·</span>
                <span>{quiz.mode === 'live' ? 'مسابقة جماعية' : 'اختبار فردي'}</span>
              </div>
              <h4 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
                {quiz.title}
              </h4>
              <QuizStatusLabel status={quiz.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-slate-200 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">عدد الأسئلة</p>
                <p className="font-display tabular-nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {quiz.questionCount} سؤالاً
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">الطلاب المشاركون</p>
                <p className="font-display tabular-nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {quiz.participantCount > 0 ? `${quiz.participantCount} طالباً` : 'لم تبدأ بعد'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">متوسط الدرجات</p>
                <p className="font-display tabular-nums mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {quiz.averageScore !== null ? `${quiz.averageScore}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">رمز الانضمام (PIN)</p>
                <p className="font-display tabular-nums mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {quiz.pinCode}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              هذه المعاينة تعرض بيانات تجريبية لتوضيح تجربة القراءة والتفاصيل في المرحلة الأولى.
              سيتم ربط التشغيل الفوري عبر الشبكة المحلية والتقارير التفصيلية في المراحل القادمة.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate(quiz.status === 'completed' ? 'reports' : 'quizzes');
            }}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {quiz.status === 'completed' ? 'عرض خارطة التقارير' : 'عرض خارطة المسابقات'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

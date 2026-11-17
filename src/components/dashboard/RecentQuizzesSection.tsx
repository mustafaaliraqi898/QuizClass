import { AlertCircle, ClipboardList, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NavSectionId } from '../../types/dashboard';
import type { QuizSummary } from '../../types/quiz';
import { formatDurationArabic, formatQuizDate } from '../quizzes/quizFormatters';
import { QuizPreviewDrawer } from './QuizPreviewDrawer';

interface RecentQuizzesSectionProps {
  quizzes: QuizSummary[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onNavigate: (section: NavSectionId) => void;
  onEditQuiz?: (quizId: string) => void;
  onLaunchLive?: (quizId: string) => void;
}

export function RecentQuizzesSection({
  quizzes,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onNavigate,
  onEditQuiz,
  onLaunchLive,
}: RecentQuizzesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSummary | null>(null);

  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return quizzes;
    return quizzes.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        (item.subject ?? '').toLowerCase().includes(query) ||
        (item.grade ?? '').toLowerCase().includes(query)
      );
    });
  }, [quizzes, searchQuery]);

  return (
    <section
      aria-label="المسابقات الأخيرة"
      className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            المسابقات الأخيرة
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            أحدث المسابقات المحفوظة محلياً في قاعدة البيانات
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو المادة..."
              aria-label="البحث في المسابقات الأخيرة"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pe-3 ps-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none sm:w-56 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={() => onNavigate('quizzes')}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إدارة جميع المسابقات
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center px-6 py-10 text-center"
        >
          <AlertCircle className="h-7 w-7 text-red-500" />
          <p className="mt-2 font-display text-sm font-bold text-slate-900 dark:text-white">
            تعذر تحميل المسابقات من قاعدة البيانات
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{errorMessage}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 dark:bg-indigo-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          )}
        </div>
      ) : isLoading && quizzes.length === 0 ? (
        <div className="space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
            />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <p className="mt-3 font-display text-sm font-bold text-slate-900 dark:text-white">
            لا توجد مسابقات محفوظة حتى الآن
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            ابدأ بإنشاء مسابقتك الأولى باختيار الأسئلة من بنك الأسئلة المحلي.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('create-quiz')}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء مسابقة جديدة</span>
          </button>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
            لا توجد نتائج مطابقة لبحثك
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            جرّب تغيير كلمات البحث لعرض المسابقات المحفوظة.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إظهار جميع المسابقات
          </button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-6 py-3.5 text-start font-bold">عنوان المسابقة</th>
                  <th className="px-4 py-3.5 text-start font-bold">الأسئلة</th>
                  <th className="px-4 py-3.5 text-start font-bold">المدة الكلية</th>
                  <th className="px-4 py-3.5 text-start font-bold">تاريخ الإنشاء</th>
                  <th className="px-6 py-3.5 text-end font-bold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800/80">
                {filteredQuizzes.map((quiz) => {
                  const metaParts = [quiz.subject, quiz.grade].filter(
                    (part): part is string => Boolean(part)
                  );
                  return (
                    <tr
                      key={quiz.id}
                      onClick={() => setSelectedQuiz(quiz)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-display font-bold text-slate-900 dark:text-slate-100">
                          {quiz.title}
                        </div>
                        {metaParts.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            {metaParts.map((part, idx) => (
                              <span key={`${quiz.id}-rowm-${idx}`} className="inline-flex items-center gap-1.5">
                                {idx > 0 && <span aria-hidden="true">·</span>}
                                <span>{part}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="tabular-nums px-4 py-4 text-xs font-bold text-slate-700 whitespace-nowrap dark:text-slate-300">
                        {quiz.questionCount} سؤالاً
                      </td>

                      <td className="tabular-nums px-4 py-4 text-xs font-medium text-slate-600 whitespace-nowrap dark:text-slate-400">
                        {formatDurationArabic(quiz.totalDurationSeconds)}
                      </td>

                      <td className="tabular-nums px-4 py-4 text-xs font-medium text-slate-600 whitespace-nowrap dark:text-slate-400">
                        {formatQuizDate(quiz.createdAt)}
                      </td>

                      <td className="px-6 py-4 text-end whitespace-nowrap">
                        <button
                          type="button"
                          aria-label={`معاينة تفاصيل ${quiz.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuiz(quiz);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>معاينة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {filteredQuizzes.map((quiz) => {
              const metaParts = [
                quiz.subject,
                quiz.grade,
                `${quiz.questionCount} سؤالاً`,
                formatQuizDate(quiz.createdAt),
              ].filter((part): part is string => Boolean(part));

              return (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => setSelectedQuiz(quiz)}
                  className="flex w-full flex-col gap-2 p-4 text-start transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {quiz.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {metaParts.map((part, idx) => (
                      <span
                        key={`${quiz.id}-mobm-${idx}`}
                        className="tabular-nums inline-flex items-center gap-2"
                      >
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span>{part}</span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <QuizPreviewDrawer
        quiz={selectedQuiz}
        onClose={() => setSelectedQuiz(null)}
        onNavigate={onNavigate}
        onEditQuiz={onEditQuiz}
        onLaunchLive={onLaunchLive}
      />
    </section>
  );
}

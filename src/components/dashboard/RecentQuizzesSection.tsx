import { Eye, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NavSectionId, QuizMode, RecentQuizItem } from '../../types/dashboard';
import { QuizStatusLabel } from '../common/QuizStatusLabel';
import { QuizPreviewDrawer } from './QuizPreviewDrawer';

interface RecentQuizzesSectionProps {
  quizzes: RecentQuizItem[];
  isPreviewData?: boolean;
  onNavigate: (section: NavSectionId) => void;
}

type ModeFilter = 'all' | QuizMode;

export function RecentQuizzesSection({
  quizzes,
  isPreviewData = true,
  onNavigate,
}: RecentQuizzesSectionProps) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<RecentQuizItem | null>(null);

  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return quizzes.filter((item) => {
      const matchesMode = modeFilter === 'all' || item.mode === modeFilter;
      const matchesQuery =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        item.grade.toLowerCase().includes(query);
      return matchesMode && matchesQuery;
    });
  }, [quizzes, modeFilter, searchQuery]);

  return (
    <section
      aria-label="المسابقات الأخيرة"
      className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              المسابقات الأخيرة
            </h3>
            {isPreviewData && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  بيانات عرض تجريبية لمعاينة الواجهة
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            أحدث الأنشطة التفاعلية والاختبارات المعدة للصفوف الدراسية
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

          <div
            role="tablist"
            aria-label="تصفية حسب النوع"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950"
          >
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'live', label: 'مسابقة جماعية' },
                { id: 'individual', label: 'اختبار فردي' },
              ] as const
            ).map((tab) => {
              const active = modeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setModeFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
            لا توجد نتائج مطابقة لبحثك
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            جرّب تغيير كلمات البحث أو إعادة تعيين عامل التصفية.
          </p>
          <button
            type="button"
            onClick={() => {
              setModeFilter('all');
              setSearchQuery('');
            }}
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
                  <th className="px-4 py-3.5 text-start font-bold">النمط</th>
                  <th className="px-4 py-3.5 text-start font-bold">الأسئلة</th>
                  <th className="px-4 py-3.5 text-start font-bold">المشاركون</th>
                  <th className="px-4 py-3.5 text-start font-bold">الحالة</th>
                  <th className="px-6 py-3.5 text-end font-bold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800/80">
                {filteredQuizzes.map((quiz) => (
                  <tr
                    key={quiz.id}
                    onClick={() => setSelectedQuiz(quiz)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-4">
                      <div className="font-display font-bold text-slate-900 dark:text-slate-100">
                        {quiz.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{quiz.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{quiz.grade}</span>
                        <span aria-hidden="true">·</span>
                        <span>{quiz.dateLabel}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs font-medium text-slate-700 whitespace-nowrap dark:text-slate-300">
                      {quiz.mode === 'live' ? 'مسابقة جماعية' : 'اختبار فردي'}
                    </td>

                    <td className="tabular-nums px-4 py-4 text-xs font-bold text-slate-700 whitespace-nowrap dark:text-slate-300">
                      {quiz.questionCount} سؤالاً
                    </td>

                    <td className="tabular-nums px-4 py-4 text-xs font-medium text-slate-600 whitespace-nowrap dark:text-slate-400">
                      {quiz.participantCount > 0 ? `${quiz.participantCount} طالباً` : '—'}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <QuizStatusLabel status={quiz.status} />
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {filteredQuizzes.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                onClick={() => setSelectedQuiz(quiz)}
                className="flex w-full flex-col gap-2 p-4 text-start transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {quiz.title}
                  </h4>
                  <span className="shrink-0">
                    <QuizStatusLabel status={quiz.status} compact />
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{quiz.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.grade}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{quiz.questionCount} سؤالاً</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.mode === 'live' ? 'مسابقة جماعية' : 'اختبار فردي'}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <QuizPreviewDrawer
        quiz={selectedQuiz}
        onClose={() => setSelectedQuiz(null)}
        onNavigate={onNavigate}
      />
    </section>
  );
}

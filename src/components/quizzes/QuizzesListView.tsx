import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuizzes } from '../../hooks/useQuizzes';
import type { QuizRecord, QuizSummary } from '../../types/quiz';
import { QuizDeleteConfirmModal } from './QuizDeleteConfirmModal';
import { QuizPreviewModal } from './QuizPreviewModal';
import { formatDurationArabic, formatQuizDate } from './quizFormatters';

interface QuizzesListViewProps {
  externalNotice?: string | null;
  onClearExternalNotice?: () => void;
  onCreateQuiz: () => void;
  onEditQuiz: (quizId: string) => void;
  onQuizzesChanged?: () => void;
}

export function QuizzesListView({
  externalNotice = null,
  onClearExternalNotice,
  onCreateQuiz,
  onEditQuiz,
  onQuizzesChanged,
}: QuizzesListViewProps) {
  const {
    quizzes,
    stats,
    isLoading,
    loadError,
    isMutating,
    feedback,
    clearFeedback,
    refresh,
    deleteQuiz,
    service,
  } = useQuizzes();

  const [searchQuery, setSearchQuery] = useState('');
  const [previewQuiz, setPreviewQuiz] = useState<QuizRecord | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<QuizSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      onClearExternalNotice?.();
    };
  }, [onClearExternalNotice]);

  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return quizzes;
    return quizzes.filter((quiz) => {
      return (
        quiz.title.toLowerCase().includes(query) ||
        (quiz.subject ?? '').toLowerCase().includes(query) ||
        (quiz.grade ?? '').toLowerCase().includes(query) ||
        (quiz.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [quizzes, searchQuery]);

  const handleOpenPreview = async (quizId: string) => {
    setPreviewQuiz(null);
    setPreviewError(null);
    setIsPreviewLoading(true);
    try {
      const record = await service.getQuizById(quizId);
      setPreviewQuiz(record);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل تفاصيل المسابقة من قاعدة البيانات.';
      setPreviewError(message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingQuiz) return;
    setDeleteError(null);
    try {
      await deleteQuiz(deletingQuiz.id);
      setDeletingQuiz(null);
      onQuizzesChanged?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر حذف المسابقة من قاعدة البيانات.';
      setDeleteError(message);
    }
  };

  const activeBanner =
    feedback ??
    (externalNotice ? { type: 'success' as const, message: externalNotice } : null);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              إدارة المسابقات
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">إجمالي المسابقات المحفوظة: {stats.totalQuizzes}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">إجمالي الأسئلة المضمّنة: {stats.totalQuizQuestions}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCreateQuiz}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء مسابقة جديدة</span>
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المسابقة أو المادة أو الصف..."
              aria-label="البحث في المسابقات المحفوظة"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pe-3 ps-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            />
          </div>

          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              <span>مسح البحث</span>
            </button>
          )}
        </div>
      </section>

      {activeBanner && (
        <div
          role={activeBanner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-xs font-bold ${
            activeBanner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {activeBanner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{activeBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              onClearExternalNotice?.();
            }}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-white px-6 py-12 text-center dark:border-red-900/60 dark:bg-slate-900"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="font-display mt-4 text-base font-bold text-slate-900 dark:text-white">
            تعذر تحميل المسابقات من قاعدة البيانات
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((skeleton) => (
            <div
              key={skeleton}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="font-display mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
            لا توجد مسابقات محفوظة بعد
          </h3>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
            أنشئ مسابقتك الأولى باختيار الأسئلة يدوياً أو عشوائياً من بنك الأسئلة مع تحديد
            ترتيبها وزمن كل سؤال بشكل مستقل.
          </p>
          <button
            type="button"
            onClick={onCreateQuiz}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء أول مسابقة</span>
          </button>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
            لا توجد مسابقات مطابقة لبحثك
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            جرّب كلمات بحث أخرى أو امسح مربع البحث لعرض جميع المسابقات المحفوظة.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            عرض جميع المسابقات
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuizzes.map((quiz) => {
            const metaParts = [
              quiz.subject,
              quiz.grade,
              `${quiz.questionCount} سؤالاً`,
              `المدة الكلية: ${formatDurationArabic(quiz.totalDurationSeconds)}`,
              `أُنشئت ${formatQuizDate(quiz.createdAt)}`,
            ].filter((part): part is string => Boolean(part));

            return (
              <article
                key={quiz.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {metaParts.map((part, idx) => (
                        <span
                          key={`${quiz.id}-meta-${idx}`}
                          className="tabular-nums inline-flex items-center gap-2"
                        >
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                          )}
                          <span>{part}</span>
                        </span>
                      ))}
                    </div>

                    <h3
                      onClick={() => void handleOpenPreview(quiz.id)}
                      className="font-display cursor-pointer text-base font-extrabold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                    >
                      {quiz.title}
                    </h3>

                    {quiz.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {quiz.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="tabular-nums">
                        الوقت الافتراضي للسؤال: {quiz.defaultTimeSeconds} ثانية
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenPreview(quiz.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>معاينة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditQuiz(quiz.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingQuiz(quiz);
                      }}
                      aria-label={`حذف المسابقة: ${quiz.title}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <QuizPreviewModal
        quiz={previewQuiz}
        isLoading={isPreviewLoading}
        errorMessage={previewError}
        onClose={() => {
          setPreviewQuiz(null);
          setPreviewError(null);
          setIsPreviewLoading(false);
        }}
        onEdit={(quizId) => onEditQuiz(quizId)}
      />

      <QuizDeleteConfirmModal
        quiz={deletingQuiz}
        isDeleting={isMutating}
        errorMessage={deleteError}
        onCancel={() => {
          setDeleteError(null);
          setDeletingQuiz(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

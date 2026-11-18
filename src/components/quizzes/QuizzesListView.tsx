import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Loader2,
  Play,
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
  onLaunchLive?: (quizId: string) => void;
  launchingQuizId?: string | null;
  onQuizzesChanged?: () => void;
}

export function QuizzesListView({
  externalNotice = null,
  onClearExternalNotice,
  onCreateQuiz,
  onEditQuiz,
  onLaunchLive,
  launchingQuizId = null,
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
      <section className="qc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink">
              إدارة المسابقات
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
              <span className="tabular-nums">إجمالي المسابقات المحفوظة: {stats.totalQuizzes}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">إجمالي الأسئلة المضمّنة: {stats.totalQuizQuestions}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCreateQuiz}
            className="qc-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء مسابقة جديدة</span>
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المسابقة أو المادة أو الصف..."
              aria-label="البحث في المسابقات المحفوظة"
              className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs"
            />
          </div>

          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="qc-btn-secondary inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
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
              ? 'border-success-line bg-success-soft text-success-ink'
              : 'border-danger-line bg-danger-soft text-danger-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            {activeBanner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-ink" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger-ink" />
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
            className="rounded-lg p-1 hover:bg-row-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadError ? (
        <div
          role="alert"
          className="qc-card flex flex-col items-center justify-center border-danger-line px-6 py-12 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger-line bg-danger-soft text-danger-ink">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="font-display mt-4 text-base font-bold text-ink">
            تعذر تحميل المسابقات من قاعدة البيانات
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="qc-btn-primary mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
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
              className="qc-card h-24 animate-pulse p-5"
            />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="qc-card flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-selected-line bg-selected text-accent">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h3 className="font-display mt-4 text-lg font-extrabold text-ink">
            لا توجد مسابقات محفوظة بعد
          </h3>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-muted sm:text-sm">
            أنشئ مسابقتك الأولى باختيار الأسئلة يدوياً أو عشوائياً من بنك الأسئلة مع تحديد
            ترتيبها وزمن كل سؤال بشكل مستقل.
          </p>
          <button
            type="button"
            onClick={onCreateQuiz}
            className="qc-btn-primary mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء أول مسابقة</span>
          </button>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="qc-card flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="font-display text-base font-bold text-ink">
            لا توجد مسابقات مطابقة لبحثك
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            جرّب كلمات بحث أخرى أو امسح مربع البحث لعرض جميع المسابقات المحفوظة.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="qc-btn-secondary mt-4 h-10 rounded-xl px-4 text-xs font-bold"
          >
            عرض جميع المسابقات
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuizzes.map((quiz) => {
            const lifecycleLabel =
              quiz.lifecycleStatus === 'started'
                ? 'تم تشغيلها'
                : quiz.lifecycleStatus === 'completed'
                  ? 'مكتملة'
                  : 'مسودة';
            const metaParts = [
              quiz.subject,
              quiz.grade,
              `${quiz.questionCount} سؤالاً`,
              `المدة الكلية: ${formatDurationArabic(quiz.totalDurationSeconds)}`,
              `الحالة: ${lifecycleLabel}`,
              `أُنشئت ${formatQuizDate(quiz.createdAt)}`,
            ].filter((part): part is string => Boolean(part));

            return (
              <article
                key={quiz.id}
                className="qc-card p-5 transition-colors hover:border-line-strong"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                      {metaParts.map((part, idx) => (
                        <span
                          key={`${quiz.id}-meta-${idx}`}
                          className="tabular-nums inline-flex items-center gap-2"
                        >
                          {idx > 0 && (
                            <span aria-hidden="true" className="text-line-strong">
                              ·
                            </span>
                          )}
                          <span>{part}</span>
                        </span>
                      ))}
                    </div>

                    <h3
                      onClick={() => void handleOpenPreview(quiz.id)}
                      className="font-display cursor-pointer text-base font-extrabold text-ink transition-colors hover:text-accent"
                    >
                      {quiz.title}
                    </h3>

                    {quiz.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {quiz.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <Clock className="h-3.5 w-3.5 text-ink-muted" />
                      <span className="tabular-nums">
                        الوقت الافتراضي للسؤال: {quiz.defaultTimeSeconds} ثانية
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {onLaunchLive && (
                      <button
                        type="button"
                        disabled={launchingQuizId === quiz.id || quiz.questionCount === 0}
                        onClick={() => onLaunchLive(quiz.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-success px-3 text-xs font-bold text-white transition-colors hover:bg-success-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {launchingQuizId === quiz.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>تشغيل مباشر</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleOpenPreview(quiz.id)}
                      className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>معاينة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditQuiz(quiz.id)}
                      className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold hover:border-selected-line hover:text-accent"
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-danger-line bg-danger-soft px-3 text-xs font-bold text-danger-ink transition-colors hover:brightness-95"
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
        onLaunchLive={onLaunchLive}
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

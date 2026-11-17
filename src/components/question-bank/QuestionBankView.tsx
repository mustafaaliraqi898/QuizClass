import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuestionBank } from '../../hooks/useQuestionBank';
import type {
  LinkedQuizSummary,
  QuestionDifficulty,
  QuestionPayload,
  QuestionRecord,
  QuestionType,
} from '../../types/questionBank';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { QuestionDetailsModal } from './QuestionDetailsModal';
import { QuestionFormModal } from './QuestionFormModal';
import { QuestionSyncConfirmModal } from './QuestionSyncConfirmModal';

interface QuestionBankViewProps {
  openCreateSignal?: number;
  onQuestionsChanged?: () => void;
}

const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

export function QuestionBankView({
  openCreateSignal = 0,
  onQuestionsChanged,
}: QuestionBankViewProps) {
  const {
    questions,
    facets,
    stats,
    filters,
    setFilters,
    resetFilters,
    isLoading,
    loadError,
    isMutating,
    feedback,
    setFeedback,
    clearFeedback,
    refresh,
    createQuestion,
    updateQuestion,
    syncQuestionToQuizzes,
    deleteQuestion,
    service,
  } = useQuestionBank();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [detailsQuestion, setDetailsQuestion] = useState<QuestionRecord | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState<{
    question: QuestionRecord;
    summary: LinkedQuizSummary;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (openCreateSignal > 0) {
      setEditingQuestion(null);
      setIsFormOpen(true);
    }
  }, [openCreateSignal]);

  const hasActiveFilters =
    Boolean(filters.search?.trim()) ||
    (filters.type !== undefined && filters.type !== 'all') ||
    (filters.subject !== undefined && filters.subject !== 'all') ||
    (filters.grade !== undefined && filters.grade !== 'all') ||
    (filters.topic !== undefined && filters.topic !== 'all') ||
    (filters.difficulty !== undefined && filters.difficulty !== 'all');

  const handleOpenCreate = () => {
    clearFeedback();
    setEditingQuestion(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (question: QuestionRecord) => {
    clearFeedback();
    setEditingQuestion(question);
    setIsFormOpen(true);
  };

  const handleSaveQuestion = async (payload: QuestionPayload) => {
    if (editingQuestion) {
      const updated = await updateQuestion(editingQuestion.id, payload);
      if (updated.linkedQuizSummary && updated.linkedQuizSummary.updatableQuizCount > 0) {
        setSyncError(null);
        setPendingSync({
          question: updated,
          summary: updated.linkedQuizSummary,
        });
      }
    } else {
      await createQuestion(payload);
    }
    onQuestionsChanged?.();
  };

  const handleConfirmSync = async () => {
    if (!pendingSync) return;
    setSyncError(null);
    try {
      const result = await syncQuestionToQuizzes(pendingSync.question.id);
      setPendingSync(null);
      setFeedback({
        type: 'success',
        message: `تم تعديل السؤال في بنك الأسئلة وتحديث نسخه في ${result.updatedQuizCount} ${
          result.updatedQuizCount === 1 ? 'مسابقة' : 'مسابقات'
        } بنجاح.`,
      });
      onQuestionsChanged?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحديث المسابقات المرتبطة بهذا السؤال.';
      setSyncError(message);
    }
  };

  const handleKeepCurrentSnapshots = () => {
    setSyncError(null);
    setPendingSync(null);
    setFeedback({
      type: 'success',
      message: 'تم تعديل السؤال في بنك الأسئلة بنجاح مع الاحتفاظ بالنسخ الحالية داخل المسابقات.',
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingQuestion) return;
    setDeleteError(null);
    try {
      await deleteQuestion(deletingQuestion.id);
      setDeletingQuestion(null);
      onQuestionsChanged?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر حذف السؤال من قاعدة البيانات.';
      setDeleteError(message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              بنك الأسئلة المحلي
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">إجمالي المحفوظ: {stats.totalQuestions} سؤالاً</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">اختيار من متعدد: {stats.multipleChoiceCount}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">صح أو خطأ: {stats.trueFalseCount}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة سؤال جديد</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 md:grid-cols-12 dark:border-slate-800">
          <div className="relative md:col-span-12 lg:col-span-4">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.search ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="ابحث في نص السؤال أو الموضوع..."
              aria-label="البحث في الأسئلة"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pe-3 ps-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            />
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <select
              aria-label="تصفية حسب نوع السؤال"
              value={filters.type ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as QuestionType | 'all',
                }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            >
              <option value="all">جميع الأنواع</option>
              <option value="multiple_choice">اختيار من متعدد</option>
              <option value="true_false">صح أو خطأ</option>
            </select>
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <select
              aria-label="تصفية حسب المادة"
              value={filters.subject ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, subject: e.target.value }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            >
              <option value="all">جميع المواد</option>
              {facets.subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <select
              aria-label="تصفية حسب الصف"
              value={filters.grade ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, grade: e.target.value }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            >
              <option value="all">جميع الصفوف</option>
              {facets.grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <select
              aria-label="تصفية حسب الموضوع"
              value={filters.topic ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, topic: e.target.value }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            >
              <option value="all">جميع المواضيع</option>
              {facets.topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 md:col-span-12 lg:col-span-12">
            <select
              aria-label="تصفية حسب مستوى الصعوبة"
              value={filters.difficulty ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  difficulty: e.target.value as QuestionDifficulty | 'all',
                }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none sm:w-52 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
            >
              <option value="all">كل مستويات الصعوبة</option>
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title="إعادة تعيين التصفيات"
                aria-label="إعادة تعيين التصفيات"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-xs font-bold ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
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
            تعذر تحميل الأسئلة من قاعدة البيانات
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
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-display text-base font-bold text-slate-900 dark:text-white">
              لا توجد أسئلة مطابقة لمعايير البحث والتصفية
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              جرّب تعديل كلمات البحث أو مسح عوامل التصفية لعرض جميع الأسئلة المحفوظة.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              مسح عوامل التصفية
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="font-display mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
              بنك الأسئلة فارغ حالياً
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              لم تقم بإضافة أي أسئلة بعد. ابدأ بإضافة سؤالك الأول من نوع اختيار من متعدد أو
              صح أو خطأ مع إمكانية إرفاق الصور والتصنيفات الاختيارية.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة أول سؤال</span>
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {questions.map((question) => {
            const metadataParts = [
              question.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
              question.subject,
              question.grade,
              question.topic,
              question.difficulty ? DIFFICULTY_LABELS[question.difficulty] : null,
            ].filter((part): part is string => Boolean(part));

            const hasAnyOptionImages = question.options.some((opt) => Boolean(opt.imageUrl));

            return (
              <article
                key={question.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    {question.imageUrl && (
                      <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:block dark:border-slate-700 dark:bg-slate-800">
                        <img
                          src={question.imageUrl}
                          alt="صورة مصغرة للسؤال"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {metadataParts.map((part, idx) => (
                          <span key={`${question.id}-meta-${idx}`} className="inline-flex items-center gap-2">
                            {idx > 0 && (
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                ·
                              </span>
                            )}
                            <span
                              className={
                                idx === 0
                                  ? 'font-bold text-indigo-600 dark:text-indigo-400'
                                  : undefined
                              }
                            >
                              {part}
                            </span>
                          </span>
                        ))}

                        {(question.imageUrl || hasAnyOptionImages) && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span>مرفق صور</span>
                            </span>
                          </>
                        )}
                      </div>

                      <h4
                        onClick={() => setDetailsQuestion(question)}
                        className="font-display cursor-pointer text-base font-bold leading-relaxed text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                      >
                        {question.prompt}
                      </h4>

                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {question.type === 'true_false' ? (
                          <span>
                            الإجابة الصحيحة:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {question.correctBoolean ? 'صح' : 'خطأ'}
                            </strong>
                          </span>
                        ) : (
                          <span className="tabular-nums">
                            {question.options.length} اختيارات
                            {' · '}
                            الإجابة الصحيحة:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {question.options.find((o) => o.isCorrect)?.optionText ||
                                'اختيار مصوّر'}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsQuestion(question)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>التفاصيل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(question)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingQuestion(question);
                      }}
                      aria-label={`حذف السؤال: ${question.prompt}`}
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

      <QuestionFormModal
        isOpen={isFormOpen}
        editingQuestion={editingQuestion}
        isSaving={isMutating}
        onClose={() => {
          setIsFormOpen(false);
          setEditingQuestion(null);
        }}
        onSubmit={handleSaveQuestion}
        onUploadImage={(file) => service.uploadImage(file)}
        onCleanupUnusedImage={(imagePath) => service.deleteUnusedImage(imagePath)}
      />

      <QuestionDetailsModal
        question={detailsQuestion}
        onClose={() => setDetailsQuestion(null)}
        onEdit={(q) => handleOpenEdit(q)}
        onDelete={(q) => {
          setDeleteError(null);
          setDeletingQuestion(q);
        }}
      />

      <DeleteConfirmModal
        question={deletingQuestion}
        isDeleting={isMutating}
        errorMessage={deleteError}
        onCancel={() => {
          setDeleteError(null);
          setDeletingQuestion(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <QuestionSyncConfirmModal
        pendingSync={pendingSync}
        isSyncing={isMutating}
        errorMessage={syncError}
        onKeepCurrent={handleKeepCurrentSnapshots}
        onConfirmSync={handleConfirmSync}
      />
    </div>
  );
}

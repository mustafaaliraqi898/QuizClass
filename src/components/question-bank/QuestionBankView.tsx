import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useQuestionBank } from '../../hooks/useQuestionBank';
import type {
  LinkedQuizSummary,
  QuestionDifficulty,
  QuestionPayload,
  QuestionRecord,
  QuestionType,
} from '../../types/questionBank';
import {
  downloadQuestionBankTemplate,
  type ExcelImportSummary,
  parseQuestionsFromExcel,
} from '../../utils/questionBankExcel';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { QuestionDetailsModal } from './QuestionDetailsModal';
import { QuestionFormModal } from './QuestionFormModal';
import { QuestionImportModal } from './QuestionImportModal';
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
    importQuestionsBatch,
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

  // Excel Import state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<ExcelImportSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleDownloadTemplate = () => {
    downloadQuestionBankTemplate();
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const existingPrompts = new Set(
        questions.map((q) => q.prompt.trim().toLowerCase())
      );
      const summary = parseQuestionsFromExcel(buffer, file.name, existingPrompts);
      setImportSummary(summary);
      setIsImportModalOpen(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'تعذر قراءة ملف Excel المرفق.',
      });
    }
  };

  const handleConfirmBatchImport = async (validPayloads: QuestionPayload[]) => {
    setIsImporting(true);
    try {
      await importQuestionsBatch(validPayloads);
      setIsImportModalOpen(false);
      setImportSummary(null);
      onQuestionsChanged?.();
    } finally {
      setIsImporting(false);
    }
  };

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
      <section className="qc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink">
              بنك الأسئلة المحلي
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
              <span className="tabular-nums">إجمالي المحفوظ: {stats.totalQuestions} سؤالاً</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">اختيار من متعدد: {stats.multipleChoiceCount}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">صح أو خطأ: {stats.trueFalseCount}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              data-testid="download-excel-template-btn"
              title="تنزيل قالب Excel المعتمد لإضافة الأسئلة"
              className="qc-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold whitespace-nowrap"
            >
              <Download className="h-4 w-4 text-accent" />
              <span>تنزيل قالب Excel</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerFileInput}
              data-testid="import-excel-questions-btn"
              title="استيراد مجموعة أسئلة من ملف Excel"
              className="qc-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>استيراد أسئلة من Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="qc-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة سؤال جديد</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-5 md:grid-cols-12">
          <div className="relative md:col-span-12 lg:col-span-4">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={filters.search ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="ابحث في نص السؤال أو الموضوع..."
              aria-label="البحث في الأسئلة"
              className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs"
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
              className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
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
              className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
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
              className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
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
              className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
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
              className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium sm:w-52"
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
                className="qc-btn-secondary inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
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
              ? 'border-success-line bg-success-soft text-success-ink'
              : 'border-danger-line bg-danger-soft text-danger-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-ink" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger-ink" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
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
            تعذر تحميل الأسئلة من قاعدة البيانات
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
              className="qc-card h-28 animate-pulse p-5"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        hasActiveFilters ? (
          <div className="qc-card flex flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-display text-base font-bold text-ink">
              لا توجد أسئلة مطابقة لمعايير البحث والتصفية
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              جرّب تعديل كلمات البحث أو مسح عوامل التصفية لعرض جميع الأسئلة المحفوظة.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="qc-btn-secondary mt-4 h-10 rounded-xl px-4 text-xs font-bold"
            >
              مسح عوامل التصفية
            </button>
          </div>
        ) : (
          <div className="qc-card flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-selected-line bg-selected text-accent">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="font-display mt-4 text-lg font-extrabold text-ink">
              بنك الأسئلة فارغ حالياً
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-muted sm:text-sm">
              لم تقم بإضافة أي أسئلة بعد. ابدأ بإضافة سؤالك الأول من نوع اختيار من متعدد أو
              صح أو خطأ مع إمكانية إرفاق الصور والتصنيفات الاختيارية.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="qc-btn-primary mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold"
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
                className="qc-card p-5 transition-colors hover:border-line-strong"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    {question.imageUrl && (
                      <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-input sm:block">
                        <img
                          src={question.imageUrl}
                          alt="صورة مصغرة للسؤال"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                        {metadataParts.map((part, idx) => (
                          <span key={`${question.id}-meta-${idx}`} className="inline-flex items-center gap-2">
                            {idx > 0 && (
                              <span aria-hidden="true" className="text-line-strong">
                                ·
                              </span>
                            )}
                            <span className={idx === 0 ? 'font-bold text-accent' : undefined}>
                              {part}
                            </span>
                          </span>
                        ))}

                        {(question.imageUrl || hasAnyOptionImages) && (
                          <>
                            <span aria-hidden="true" className="text-line-strong">
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1 text-ink-muted">
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span>مرفق صور</span>
                            </span>
                          </>
                        )}
                      </div>

                      <h4
                        onClick={() => setDetailsQuestion(question)}
                        className="font-display cursor-pointer text-base font-bold leading-relaxed text-ink transition-colors hover:text-accent"
                      >
                        {question.prompt}
                      </h4>

                      <div className="text-xs text-ink-muted">
                        {question.type === 'true_false' ? (
                          <span>
                            الإجابة الصحيحة:{' '}
                            <strong className="text-success-ink">
                              {question.correctBoolean ? 'صح' : 'خطأ'}
                            </strong>
                          </span>
                        ) : (
                          <span className="tabular-nums">
                            {question.options.length} اختيارات
                            {' · '}
                            الإجابة الصحيحة:{' '}
                            <strong className="text-success-ink">
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
                      className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>التفاصيل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(question)}
                      className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold hover:border-selected-line hover:text-accent"
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
        data-testid="excel-file-input"
      />

      <QuestionImportModal
        isOpen={isImportModalOpen}
        summary={importSummary}
        isSaving={isImporting}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportSummary(null);
        }}
        onSelectDifferentFile={handleTriggerFileInput}
        onConfirmImport={handleConfirmBatchImport}
      />
    </div>
  );
}

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { httpInteractiveLearningService } from '../../services/interactiveLearningService';
import { httpQuestionBankService } from '../../services/questionBankService';
import type {
  InteractiveActivityPayload,
  InteractiveActivityRecord,
} from '../../types/interactiveLearning';
import type {
  QuestionDifficulty,
  QuestionFacets,
  QuestionFilterParams,
  QuestionRecord,
  QuestionType,
} from '../../types/questionBank';
import { QuestionDetailsModal } from '../question-bank/QuestionDetailsModal';
import { DIFFICULTY_LABELS } from '../quizzes/quizFormatters';
import { moveQuestionIdInOrder } from './interactiveLearningLogic';

interface ActivityBuilderViewProps {
  editingActivityId?: string | null;
  onStartActivity: (activity: InteractiveActivityRecord) => void;
  onSavedOnly: (activity: InteractiveActivityRecord, wasEditing: boolean) => void;
  onCancel: () => void;
  onOpenQuestionBank?: () => void;
}

export function ActivityBuilderView({
  editingActivityId = null,
  onStartActivity,
  onSavedOnly,
  onCancel,
  onOpenQuestionBank,
}: ActivityBuilderViewProps) {
  const isEditing = Boolean(editingActivityId);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [autoFullscreen, setAutoFullscreen] = useState(false);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedQuestionsMap, setSelectedQuestionsMap] = useState<
    Record<string, QuestionRecord>
  >({});

  const [filters, setFilters] = useState<QuestionFilterParams>({
    search: '',
    type: 'all',
    subject: 'all',
    grade: 'all',
    topic: 'all',
    difficulty: 'all',
  });

  const [bankQuestions, setBankQuestions] = useState<QuestionRecord[]>([]);
  const [bankFacets, setBankFacets] = useState<QuestionFacets>({
    subjects: [],
    grades: [],
    topics: [],
  });
  const [totalBankCount, setTotalBankCount] = useState(0);
  const [isBankLoading, setIsBankLoading] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(isEditing);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRecord | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<'save' | 'start' | null>(null);

  // Load existing activity if editing
  useEffect(() => {
    if (!editingActivityId) {
      setIsInitialLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsInitialLoading(true);
    setInitialError(null);

    httpInteractiveLearningService
      .getActivityById(editingActivityId, { signal: controller.signal })
      .then((activity) => {
        setTitle(activity.title);
        setSubject(activity.subject ?? '');
        setGrade(activity.grade ?? '');
        setAutoFullscreen(activity.autoFullscreen);
        const ids: string[] = [];
        const map: Record<string, QuestionRecord> = {};
        for (const q of activity.questions) {
          ids.push(q.id);
          map[q.id] = q;
        }
        setSelectedQuestionIds(ids);
        setSelectedQuestionsMap(map);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setInitialError(
          error instanceof Error ? error.message : 'تعذر تحميل بيانات النشاط التعليمي.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [editingActivityId]);

  const loadBankQuestions = useCallback(async (signal?: AbortSignal) => {
    setIsBankLoading(true);
    setBankError(null);
    try {
      const response = await httpQuestionBankService.listQuestions(filters, { signal });
      setBankQuestions(response.questions);
      setBankFacets(response.facets);
      setTotalBankCount(response.stats.totalQuestions);
      setSelectedQuestionsMap((prev) => {
        const next = { ...prev };
        for (const q of response.questions) {
          next[q.id] = q;
        }
        return next;
      });
    } catch (error) {
      if (signal?.aborted) return;
      setBankError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل الأسئلة من بنك الأسئلة المحلي.'
      );
    } finally {
      if (!signal?.aborted) {
        setIsBankLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadBankQuestions(controller.signal);
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadBankQuestions]);

  const selectedSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);

  const selectedQuestions = useMemo(
    () =>
      selectedQuestionIds
        .map((id) => selectedQuestionsMap[id])
        .filter((q): q is QuestionRecord => Boolean(q)),
    [selectedQuestionIds, selectedQuestionsMap]
  );

  const toggleQuestionSelection = (question: QuestionRecord) => {
    setSubmitError(null);
    setSelectedQuestionsMap((prev) => ({ ...prev, [question.id]: question }));
    setSelectedQuestionIds((prev) =>
      prev.includes(question.id)
        ? prev.filter((id) => id !== question.id)
        : [...prev, question.id]
    );
  };

  const selectAllVisible = () => {
    setSubmitError(null);
    setSelectedQuestionsMap((prev) => {
      const next = { ...prev };
      for (const q of bankQuestions) {
        next[q.id] = q;
      }
      return next;
    });
    setSelectedQuestionIds((prev) => {
      const existing = new Set(prev);
      const additions = bankQuestions
        .map((q) => q.id)
        .filter((id) => !existing.has(id));
      return [...prev, ...additions];
    });
  };

  const clearAllSelected = () => {
    setSelectedQuestionIds([]);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setSelectedQuestionIds((prev) => moveQuestionIdInOrder(prev, index, direction));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setSelectedQuestionIds((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(draggedIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const persistAndHandle = async (mode: 'save' | 'start') => {
    setSubmitError(null);
    if (selectedQuestionIds.length === 0) {
      setSubmitError('يرجى تحديد سؤال واحد على الأقل من بنك الأسئلة قبل المتابعة.');
      return;
    }

    const trimmedTitle = title.replace(/\s+/g, ' ').trim();
    if (mode === 'save' && trimmedTitle.length < 2) {
      setSubmitError('يرجى كتابة عنوان واضح للنشاط التعليمي (حرفان على الأقل) لحفظه.');
      return;
    }

    const resolvedTitle =
      trimmedTitle.length >= 2
        ? trimmedTitle
        : `نشاط صفي (${selectedQuestionIds.length} أسئلة)`;

    const inferredSubject =
      subject.trim() ||
      selectedQuestions.find((q) => q.subject)?.subject ||
      null;
    const inferredGrade =
      grade.trim() ||
      selectedQuestions.find((q) => q.grade)?.grade ||
      null;

    const payload: InteractiveActivityPayload = {
      title: resolvedTitle,
      subject: inferredSubject,
      grade: inferredGrade,
      autoFullscreen,
      questionIds: selectedQuestionIds,
    };

    setIsSubmitting(mode);
    try {
      const saved =
        isEditing && editingActivityId
          ? await httpInteractiveLearningService.updateActivity(editingActivityId, payload)
          : await httpInteractiveLearningService.createActivity(payload);

      if (mode === 'start') {
        onStartActivity(saved);
      } else {
        onSavedOnly(saved, isEditing);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'تعذر حفظ النشاط التعليمي.'
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="qc-card flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="mt-3 text-sm font-bold text-ink-muted">
          جارٍ تحميل بيانات النشاط التعليمي...
        </p>
      </div>
    );
  }

  if (initialError) {
    return (
      <div className="rounded-2xl border border-danger-line bg-danger-soft p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-danger" />
        <p className="mt-2 text-sm font-bold text-danger-ink">{initialError}</p>
        <button
          type="button"
          onClick={onCancel}
          className="qc-btn-secondary mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
        >
          العودة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="qc-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة للأنشطة</span>
          </button>
          <div>
            <h2 className="font-display text-lg font-extrabold text-ink">
              {isEditing ? 'تعديل النشاط التعليمي' : 'إنشاء نشاط تعليمي جديد'}
            </h2>
            <p className="text-xs text-ink-muted">
              اختر الأسئلة الحقيقية من بنك الأسئلة ورتّبها للعرض التفاعلي على السبورة الذكية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting !== null || selectedQuestionIds.length === 0}
            onClick={() => void persistAndHandle('save')}
            className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isSubmitting === 'save' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>حفظ النشاط</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting !== null || selectedQuestionIds.length === 0}
            onClick={() => void persistAndHandle('start')}
            className="qc-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isSubmitting === 'start' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>بدء النشاط على السبورة</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-danger-line bg-danger-soft px-5 py-3.5 text-xs font-bold text-danger-ink"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Activity Title & Display Options */}
      <section className="qc-card p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <label
              htmlFor="interactive-activity-title"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              عنوان النشاط التعليمي
            </label>
            <input
              id="interactive-activity-title"
              type="text"
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة الكسور والأعداد النسبية..."
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm font-bold placeholder:font-normal"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="interactive-activity-subject"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              المادة (اختياري)
            </label>
            <input
              id="interactive-activity-subject"
              type="text"
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="تُعبأ تلقائياً أو يدوياً"
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm font-medium"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="interactive-activity-grade"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              الصف (اختياري)
            </label>
            <input
              id="interactive-activity-grade"
              type="text"
              maxLength={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="مثال: الخامس"
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm font-medium"
            />
          </div>

          <div className="flex items-end md:col-span-2">
            <label className="qc-btn-secondary flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-bold">
              <input
                type="checkbox"
                checked={autoFullscreen}
                onChange={(e) => setAutoFullscreen(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
              />
              <Maximize2 className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">ملء الشاشة</span>
            </label>
          </div>
        </div>
      </section>

      {/* Main Split Workspace: Question Bank Picker + Selected Order Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left/Start 7 Columns: Real Question Bank Picker */}
        <section className="qc-card space-y-4 p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-extrabold text-ink">
                اختيار الأسئلة من بنك الأسئلة
              </h3>
              <p className="tabular-nums text-xs text-ink-muted">
                إجمالي الأسئلة المتاحة: {totalBankCount}
              </p>
            </div>

            {bankQuestions.length > 0 && (
              <button
                type="button"
                onClick={selectAllVisible}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-selected-line bg-selected px-3.5 text-xs font-extrabold text-accent transition-opacity hover:opacity-85 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>تحديد جميع الظاهر ({bankQuestions.length})</span>
              </button>
            )}
          </div>

          {/* Search & Dynamic Facet Filters */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative sm:col-span-2 lg:col-span-3">
              <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={filters.search ?? ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="ابحث في نص السؤال أو المادة أو الموضوع..."
                className="qc-input h-11 w-full rounded-xl ps-10 pe-3.5 text-sm"
              />
            </div>

            <select
              aria-label="تصفية حسب نوع السؤال"
              value={filters.type ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as QuestionType | 'all',
                }))
              }
              className="qc-input h-10 rounded-xl px-3 text-xs font-bold"
            >
              <option value="all">جميع الأنواع</option>
              <option value="multiple_choice">اختيار من متعدد</option>
              <option value="true_false">صح أو خطأ</option>
            </select>

            <select
              aria-label="تصفية حسب المادة"
              value={filters.subject ?? 'all'}
              onChange={(e) => setFilters((prev) => ({ ...prev, subject: e.target.value }))}
              className="qc-input h-10 rounded-xl px-3 text-xs font-bold"
            >
              <option value="all">جميع المواد</option>
              {bankFacets.subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية حسب الصف"
              value={filters.grade ?? 'all'}
              onChange={(e) => setFilters((prev) => ({ ...prev, grade: e.target.value }))}
              className="qc-input h-10 rounded-xl px-3 text-xs font-bold"
            >
              <option value="all">جميع الصفوف</option>
              {bankFacets.grades.map((gr) => (
                <option key={gr} value={gr}>
                  {gr}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية حسب الموضوع"
              value={filters.topic ?? 'all'}
              onChange={(e) => setFilters((prev) => ({ ...prev, topic: e.target.value }))}
              className="qc-input h-10 rounded-xl px-3 text-xs font-bold"
            >
              <option value="all">جميع الموضوعات</option>
              {bankFacets.topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية حسب الصعوبة"
              value={filters.difficulty ?? 'all'}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  difficulty: e.target.value as QuestionDifficulty | 'all',
                }))
              }
              className="qc-input h-10 rounded-xl px-3 text-xs font-bold"
            >
              <option value="all">جميع المستويات</option>
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>

            <button
              type="button"
              onClick={() =>
                setFilters({
                  search: '',
                  type: 'all',
                  subject: 'all',
                  grade: 'all',
                  topic: 'all',
                  difficulty: 'all',
                })
              }
              className="qc-btn-secondary h-10 rounded-xl px-3 text-xs font-bold"
            >
              مسح التصفيات
            </button>
          </div>

          {/* Bank Question List */}
          {isBankLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : bankError ? (
            <div className="rounded-xl border border-danger-line bg-danger-soft p-4 text-center text-xs font-bold text-danger-ink">
              <p>{bankError}</p>
              <button
                type="button"
                onClick={() => void loadBankQuestions()}
                className="mt-2 inline-flex items-center gap-1 text-accent underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          ) : bankQuestions.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface-subtle p-8 text-center">
              <p className="text-sm font-bold text-ink">
                {totalBankCount === 0
                  ? 'بنك الأسئلة فارغ حالياً. أضف أسئلة حقيقية أولاً لاستخدامها في التعلم التفاعلي.'
                  : 'لا توجد أسئلة تطابق معايير البحث الحالية.'}
              </p>
              {totalBankCount === 0 && onOpenQuestionBank && (
                <button
                  type="button"
                  onClick={onOpenQuestionBank}
                  className="qc-btn-primary mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
                >
                  فتح بنك الأسئلة
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[540px] space-y-2.5 overflow-y-auto pe-1">
              {bankQuestions.map((q) => {
                const isSelected = selectedSet.has(q.id);
                const metaParts = [
                  q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
                  q.subject,
                  q.grade,
                  q.topic,
                  q.difficulty ? DIFFICULTY_LABELS[q.difficulty] : null,
                ].filter((part): part is string => Boolean(part));

                return (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                      isSelected
                        ? 'border-selected-line bg-selected'
                        : 'border-line bg-surface-subtle hover:border-line-strong'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleQuestionSelection(q)}
                      aria-label={isSelected ? `إزالة السؤال: ${q.prompt}` : `اختيار السؤال: ${q.prompt}`}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-line-strong bg-surface text-transparent hover:border-selected-line'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => toggleQuestionSelection(q)}
                    >
                      <p className="font-display text-sm font-bold leading-relaxed text-ink">
                        {q.prompt}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                        {metaParts.map((part, idx) => (
                          <span key={`${q.id}-${idx}`} className="inline-flex items-center gap-1.5">
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>{part}</span>
                          </span>
                        ))}
                        {q.imageUrl && (
                          <span className="inline-flex items-center gap-1 text-accent">
                            <span aria-hidden="true">·</span>
                            <ImageIcon className="h-3 w-3" />
                            <span>يحتوي صورة</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(q)}
                      aria-label={`معاينة السؤال: ${q.prompt}`}
                      className="qc-btn-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:text-accent"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right/End 5 Columns: Selected Questions Order & Preview */}
        <section className="qc-card flex flex-col space-y-4 p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-extrabold text-ink">
                أسئلة النشاط المختارة ({selectedQuestions.length})
              </h3>
              <p className="text-xs text-ink-muted">
                رتّب الأسئلة بالسحب أو الأسهم بالترتيب الذي سيظهر على السبورة.
              </p>
            </div>
            {selectedQuestions.length > 0 && (
              <button
                type="button"
                onClick={clearAllSelected}
                className="text-xs font-bold text-danger hover:underline"
              >
                مسح الكل
              </button>
            )}
          </div>

          {selectedQuestions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-subtle p-8 text-center">
              <p className="text-sm font-bold text-ink">
                لم يتم اختيار أسئلة بعد
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                اضغط على أي سؤال من قائمة بنك الأسئلة لإضافته إلى النشاط التفاعلي.
              </p>
            </div>
          ) : (
            <div className="max-h-[540px] space-y-2.5 overflow-y-auto pe-1">
              {selectedQuestions.map((q, index) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 transition-colors ${
                    dragOverIndex === index
                      ? 'border-primary bg-selected'
                      : 'border-line bg-surface-subtle'
                  }`}
                >
                  <span
                    className="cursor-grab text-ink-muted hover:text-ink"
                    aria-hidden="true"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>

                  <span className="tabular-nums flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-xs font-black text-white">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xs sm:text-sm font-bold text-ink">
                      {q.prompt}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ'}
                      {q.subject ? ` · ${q.subject}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label={`تحريك السؤال ${index + 1} لأعلى`}
                      className="qc-btn-secondary flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted disabled:opacity-35"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === selectedQuestions.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label={`تحريك السؤال ${index + 1} لأسفل`}
                      className="qc-btn-secondary flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted disabled:opacity-35"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(q)}
                      aria-label={`معاينة السؤال ${index + 1}`}
                      className="qc-btn-secondary flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleQuestionSelection(q)}
                      aria-label={`حذف السؤال ${index + 1} من النشاط`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger-line bg-danger-soft text-danger-ink transition-opacity hover:opacity-85"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <QuestionDetailsModal
        question={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
      />
    </div>
  );
}

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { httpQuestionBankService } from '../../services/questionBankService';
import { httpQuizService } from '../../services/quizService';
import type {
  QuestionDifficulty,
  QuestionFacets,
  QuestionFilterParams,
  QuestionRecord,
  QuestionType,
} from '../../types/questionBank';
import type {
  QuizPayload,
  QuizQuestionInput,
  QuizQuestionSnapshotOption,
  QuizRecord,
} from '../../types/quiz';
import { QuestionDetailsModal } from '../question-bank/QuestionDetailsModal';
import { DIFFICULTY_LABELS, formatDurationArabic } from './quizFormatters';

type SelectionMode = 'manual' | 'random' | 'combined';

interface DraftQuizQuestion {
  clientKey: string;
  sourceKind: 'bank_question' | 'existing_snapshot';
  sourceQuestionId: string | null;
  quizQuestionId: string | null;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  correctBoolean: boolean | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  timeLimitSeconds: number;
  options: Array<{
    id: string;
    optionText: string | null;
    imageUrl: string | null;
    isCorrect: boolean;
  }>;
}

interface CreateQuizViewProps {
  editingQuizId?: string | null;
  onSaved: (savedQuiz: QuizRecord, isEditing: boolean) => void;
  onCancel: () => void;
  onOpenQuestionBank?: () => void;
}

const DEFAULT_TIME_PRESETS = [15, 20, 30, 45, 60, 90];

function mapBankQuestionToDraft(
  q: QuestionRecord,
  defaultTimeSeconds: number
): DraftQuizQuestion {
  return {
    clientKey: `bank:${q.id}`,
    sourceKind: 'bank_question',
    sourceQuestionId: q.id,
    quizQuestionId: null,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    correctBoolean: q.correctBoolean,
    subject: q.subject,
    grade: q.grade,
    topic: q.topic,
    difficulty: q.difficulty,
    timeLimitSeconds: defaultTimeSeconds,
    options: q.options.map((o) => ({
      id: o.id,
      optionText: o.optionText,
      imageUrl: o.imageUrl,
      isCorrect: o.isCorrect,
    })),
  };
}

function mapSnapshotToDraft(
  snap: QuizRecord['questions'][number]
): DraftQuizQuestion {
  return {
    clientKey: `snap:${snap.id}`,
    sourceKind: 'existing_snapshot',
    sourceQuestionId: snap.sourceQuestionId,
    quizQuestionId: snap.id,
    type: snap.type,
    prompt: snap.prompt,
    imageUrl: snap.imageUrl,
    correctBoolean: snap.correctBoolean,
    subject: snap.subject,
    grade: snap.grade,
    topic: snap.topic,
    difficulty: snap.difficulty,
    timeLimitSeconds: snap.timeLimitSeconds,
    options: snap.options.map((o: QuizQuestionSnapshotOption) => ({
      id: o.id,
      optionText: o.optionText,
      imageUrl: o.imageUrl,
      isCorrect: o.isCorrect,
    })),
  };
}

export function CreateQuizView({
  editingQuizId = null,
  onSaved,
  onCancel,
  onOpenQuestionBank,
}: CreateQuizViewProps) {
  const isEditing = Boolean(editingQuizId);

  // Quiz header fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [defaultTimeSeconds, setDefaultTimeSeconds] = useState<number>(30);

  // Editing load state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(isEditing);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  // Selected questions in the quiz
  const [selectedQuestions, setSelectedQuestions] = useState<DraftQuizQuestion[]>([]);
  const [expandedDraftKeys, setExpandedDraftKeys] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Selection mode & Bank state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('manual');

  // Manual browser filters & data
  const [manualFilters, setManualFilters] = useState<QuestionFilterParams>({
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
  const [bankTotalCount, setBankTotalCount] = useState<number>(0);
  const [isBankLoading, setIsBankLoading] = useState<boolean>(true);
  const [bankError, setBankError] = useState<string | null>(null);
  const [stagedManualIds, setStagedManualIds] = useState<string[]>([]);
  const [previewBankQuestion, setPreviewBankQuestion] = useState<QuestionRecord | null>(null);

  // Random selection filters & availability
  const [randomFilters, setRandomFilters] = useState<QuestionFilterParams>({
    search: '',
    type: 'all',
    subject: 'all',
    grade: 'all',
    topic: 'all',
    difficulty: 'all',
  });
  const [randomCountInput, setRandomCountInput] = useState<string>('5');
  const [randomAvailableCount, setRandomAvailableCount] = useState<number | null>(null);
  const [isRandomCountLoading, setIsRandomCountLoading] = useState<boolean>(false);
  const [isRandomDrawing, setIsRandomDrawing] = useState<boolean>(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomSuccessNotice, setRandomSuccessNotice] = useState<string | null>(null);

  // Summary Preview & Save state
  const [isSummaryStep, setIsSummaryStep] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing quiz if editing
  const loadEditingQuiz = useCallback(async () => {
    if (!editingQuizId) {
      setTitle('');
      setSubject('');
      setGrade('');
      setDescription('');
      setDefaultTimeSeconds(30);
      setSelectedQuestions([]);
      setStagedManualIds([]);
      setIsSummaryStep(false);
      setValidationError(null);
      setSaveError(null);
      setInitialLoadError(null);
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);
    setInitialLoadError(null);
    setIsSummaryStep(false);
    setValidationError(null);
    setSaveError(null);

    try {
      const record = await httpQuizService.getQuizById(editingQuizId);
      setTitle(record.title);
      setSubject(record.subject ?? '');
      setGrade(record.grade ?? '');
      setDescription(record.description ?? '');
      setDefaultTimeSeconds(record.defaultTimeSeconds);
      setSelectedQuestions(record.questions.map(mapSnapshotToDraft));
      setStagedManualIds([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات المسابقة المطلوب تعديلها.';
      setInitialLoadError(message);
    } finally {
      setIsInitialLoading(false);
    }
  }, [editingQuizId]);

  useEffect(() => {
    void loadEditingQuiz();
  }, [loadEditingQuiz]);

  // Load Question Bank items for manual/combined selection & facets
  const loadBankQuestions = useCallback(
    async (signal?: AbortSignal) => {
      setIsBankLoading(true);
      setBankError(null);
      try {
        const res = await httpQuestionBankService.listQuestions(manualFilters, { signal });
        setBankQuestions(res.questions);
        setBankFacets(res.facets);
        setBankTotalCount(res.stats.totalQuestions);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الأسئلة من بنك الأسئلة المحلي.';
        setBankError(message);
      } finally {
        setIsBankLoading(false);
      }
    },
    [manualFilters]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBankQuestions(controller.signal);
    return () => controller.abort();
  }, [loadBankQuestions]);

  const alreadyIncludedBankIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of selectedQuestions) {
      if (item.sourceQuestionId) {
        set.add(item.sourceQuestionId);
      }
    }
    return set;
  }, [selectedQuestions]);

  // Keep stagedManualIds pruned of questions already added to the quiz
  useEffect(() => {
    setStagedManualIds((prev) => prev.filter((id) => !alreadyIncludedBankIdSet.has(id)));
  }, [alreadyIncludedBankIdSet]);

  const excludeIdsForRandom = useMemo(() => {
    const set = new Set<string>(alreadyIncludedBankIdSet);
    if (selectionMode === 'combined') {
      for (const id of stagedManualIds) {
        set.add(id);
      }
    }
    return Array.from(set);
  }, [alreadyIncludedBankIdSet, selectionMode, stagedManualIds]);

  // Live random availability check
  const refreshRandomAvailability = useCallback(
    async (signal?: AbortSignal) => {
      setIsRandomCountLoading(true);
      setRandomError(null);
      try {
        const res = await httpQuizService.previewOrDrawRandom(
          {
            filters: randomFilters,
            excludeQuestionIds: excludeIdsForRandom,
            draw: false,
          },
          { signal }
        );
        setRandomAvailableCount(res.availableCount);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر فحص عدد الأسئلة المتاحة للاختيار العشوائي.';
        setRandomError(message);
        setRandomAvailableCount(null);
      } finally {
        setIsRandomCountLoading(false);
      }
    },
    [randomFilters, excludeIdsForRandom]
  );

  useEffect(() => {
    if (selectionMode !== 'random' && selectionMode !== 'combined') return;
    const controller = new AbortController();
    void refreshRandomAvailability(controller.signal);
    return () => controller.abort();
  }, [selectionMode, refreshRandomAvailability]);

  const safeDefaultTime = useMemo(() => {
    if (!Number.isFinite(defaultTimeSeconds)) return 30;
    return Math.min(600, Math.max(5, Math.round(defaultTimeSeconds)));
  }, [defaultTimeSeconds]);

  const totalQuizDurationSeconds = useMemo(
    () =>
      selectedQuestions.reduce(
        (sum, q) => sum + (Number.isFinite(q.timeLimitSeconds) ? q.timeLimitSeconds : 0),
        0
      ),
    [selectedQuestions]
  );

  const toggleManualCheckbox = (questionId: string) => {
    if (alreadyIncludedBankIdSet.has(questionId)) return;
    setStagedManualIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const selectableFilteredBankIds = useMemo(
    () =>
      bankQuestions
        .filter((q) => !alreadyIncludedBankIdSet.has(q.id))
        .map((q) => q.id),
    [bankQuestions, alreadyIncludedBankIdSet]
  );

  const allSelectableChecked =
    selectableFilteredBankIds.length > 0 &&
    selectableFilteredBankIds.every((id) => stagedManualIds.includes(id));

  const handleToggleSelectAllVisible = () => {
    if (allSelectableChecked) {
      const visibleSet = new Set(selectableFilteredBankIds);
      setStagedManualIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setStagedManualIds((prev) =>
        Array.from(new Set([...prev, ...selectableFilteredBankIds]))
      );
    }
  };

  const handleAddStagedManualQuestions = () => {
    if (stagedManualIds.length === 0) return;
    const stagedSet = new Set(stagedManualIds);
    const toAdd = bankQuestions
      .filter((q) => stagedSet.has(q.id) && !alreadyIncludedBankIdSet.has(q.id))
      .map((q) => mapBankQuestionToDraft(q, safeDefaultTime));

    if (toAdd.length === 0) return;
    setSelectedQuestions((prev) => [...prev, ...toAdd]);
    setStagedManualIds([]);
    setValidationError(null);
  };

  const parsedRandomCount = Number.parseInt(randomCountInput, 10);
  const randomCountValidationMessage = useMemo(() => {
    if (randomCountInput.trim().length === 0) {
      return 'يرجى إدخال عدد الأسئلة المطلوب سحبها.';
    }
    if (!Number.isInteger(parsedRandomCount) || parsedRandomCount < 1) {
      return 'يجب أن يكون عدد الأسئلة رقماً صحيحاً (1 على الأقل).';
    }
    if (randomAvailableCount !== null && randomAvailableCount === 0) {
      return 'لا توجد أسئلة متاحة مطابقة لهذه الشروط أو غير مضافة مسبقاً.';
    }
    if (randomAvailableCount !== null && parsedRandomCount > randomAvailableCount) {
      return `العدد المطلوب (${parsedRandomCount}) أكبر من عدد الأسئلة المتاحة (${randomAvailableCount}).`;
    }
    return null;
  }, [randomCountInput, parsedRandomCount, randomAvailableCount]);

  const handleDrawRandom = async (includeStagedManualFirst: boolean) => {
    setRandomError(null);
    setRandomSuccessNotice(null);

    const stagedToAdd = includeStagedManualFirst
      ? bankQuestions
          .filter(
            (q) =>
              stagedManualIds.includes(q.id) && !alreadyIncludedBankIdSet.has(q.id)
          )
          .map((q) => mapBankQuestionToDraft(q, safeDefaultTime))
      : [];

    if (randomCountValidationMessage) {
      setRandomError(randomCountValidationMessage);
      return;
    }

    setIsRandomDrawing(true);
    try {
      const response = await httpQuizService.previewOrDrawRandom({
        filters: randomFilters,
        excludeQuestionIds: excludeIdsForRandom,
        count: parsedRandomCount,
        draw: true,
      });

      const drawnDrafts = response.questions
        .filter((q) => !alreadyIncludedBankIdSet.has(q.id))
        .map((q) => mapBankQuestionToDraft(q, safeDefaultTime));

      setSelectedQuestions((prev) => {
        const existingKeys = new Set(prev.map((item) => item.sourceQuestionId).filter(Boolean));
        const merged = [...prev];
        for (const item of [...stagedToAdd, ...drawnDrafts]) {
          if (item.sourceQuestionId && existingKeys.has(item.sourceQuestionId)) continue;
          if (item.sourceQuestionId) existingKeys.add(item.sourceQuestionId);
          merged.push(item);
        }
        return merged;
      });

      if (includeStagedManualFirst) {
        setStagedManualIds([]);
      }
      setValidationError(null);
      setRandomSuccessNotice(
        includeStagedManualFirst && stagedToAdd.length > 0
          ? `تمت إضافة ${stagedToAdd.length} سؤالاً يدوياً وسحب ${drawnDrafts.length} سؤالاً عشوائياً دون تكرار.`
          : `تم سحب وإضافة ${drawnDrafts.length} سؤالاً عشوائياً إلى المسابقة.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر سحب الأسئلة عشوائياً.';
      setRandomError(message);
    } finally {
      setIsRandomDrawing(false);
    }
  };

  // Reordering helpers
  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= selectedQuestions.length ||
      toIndex >= selectedQuestions.length
    ) {
      return;
    }
    setSelectedQuestions((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: DragEvent<HTMLElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveQuestion(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveDraftQuestion = (clientKey: string) => {
    setSelectedQuestions((prev) => prev.filter((item) => item.clientKey !== clientKey));
  };

  const handleQuestionTimeChange = (clientKey: string, rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    setSelectedQuestions((prev) =>
      prev.map((item) =>
        item.clientKey === clientKey
          ? {
              ...item,
              timeLimitSeconds: Number.isNaN(parsed) ? 0 : parsed,
            }
          : item
      )
    );
  };

  const handleApplyDefaultTimeToAll = () => {
    setSelectedQuestions((prev) =>
      prev.map((item) => ({
        ...item,
        timeLimitSeconds: safeDefaultTime,
      }))
    );
  };

  const validateBeforeSummary = (): string | null => {
    if (title.trim().length === 0) {
      return 'يرجى إدخال اسم المسابقة قبل المتابعة إلى المعاينة.';
    }
    if (title.trim().length > 200) {
      return 'اسم المسابقة يتجاوز الحد الأقصى المسموح به (200 حرفاً).';
    }
    if (!Number.isInteger(defaultTimeSeconds) || defaultTimeSeconds < 5 || defaultTimeSeconds > 600) {
      return 'الوقت الافتراضي للإجابة يجب أن يكون رقماً صحيحاً بين 5 و 600 ثانية.';
    }
    if (selectedQuestions.length === 0) {
      return 'يرجى اختيار سؤال واحد على الأقل من بنك الأسئلة لإضافته إلى المسابقة.';
    }
    for (let i = 0; i < selectedQuestions.length; i++) {
      const t = selectedQuestions[i].timeLimitSeconds;
      if (!Number.isInteger(t) || t < 5 || t > 600) {
        return `وقت السؤال رقم ${i + 1} يجب أن يكون رقماً صحيحاً بين 5 و 600 ثانية.`;
      }
    }
    return null;
  };

  const handleProceedToSummary = () => {
    const err = validateBeforeSummary();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setIsSummaryStep(true);
  };

  const handleSaveQuiz = async () => {
    const err = validateBeforeSummary();
    if (err) {
      setValidationError(err);
      setIsSummaryStep(false);
      return;
    }

    const questionInputs: QuizQuestionInput[] = selectedQuestions.map((item) => {
      if (item.sourceKind === 'existing_snapshot' && item.quizQuestionId) {
        return {
          kind: 'existing_snapshot',
          quizQuestionId: item.quizQuestionId,
          timeLimitSeconds: item.timeLimitSeconds,
        };
      }
      return {
        kind: 'bank_question',
        sourceQuestionId: item.sourceQuestionId ?? '',
        timeLimitSeconds: item.timeLimitSeconds,
      };
    });

    const payload: QuizPayload = {
      title: title.trim(),
      subject: subject.trim() || null,
      grade: grade.trim() || null,
      description: description.trim() || null,
      defaultTimeSeconds,
      questions: questionInputs,
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      const saved =
        isEditing && editingQuizId
          ? await httpQuizService.updateQuiz(editingQuizId, payload)
          : await httpQuizService.createQuiz(payload);
      onSaved(saved, isEditing);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر حفظ المسابقة في قاعدة البيانات المحلية.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="qc-card flex flex-col items-center justify-center px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="mt-3 text-sm font-bold text-ink-muted">
          جارٍ تحميل بيانات المسابقة للتعديل...
        </p>
      </div>
    );
  }

  if (initialLoadError) {
    return (
      <div
        role="alert"
        className="qc-card flex flex-col items-center justify-center border-danger-line px-6 py-12 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger-line bg-danger-soft text-danger-ink">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="font-display mt-4 text-base font-bold text-ink">
          تعذر فتح المسابقة للتعديل
        </h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
          {initialLoadError}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadEditingQuiz()}
            className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة المحاولة</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="qc-btn-secondary h-10 rounded-xl px-4 text-xs font-bold"
          >
            العودة للمسابقات
          </button>
        </div>
      </div>
    );
  }

  if (isSummaryStep) {
    return (
      <div className="space-y-6">
        <section className="qc-card p-6">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold text-ink">
                معاينة المسابقة قبل الحفظ
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                راجع تفاصيل المسابقة وترتيب الأسئلة والأزمنة قبل حفظ نسخة مستقلة في قاعدة البيانات.
              </p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsSummaryStep(false)}
              className="qc-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-50"
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة للتعديل</span>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface-subtle p-4">
              <p className="text-xs font-bold text-ink-muted">اسم المسابقة</p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink">
                {title.trim()}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle p-4">
              <p className="text-xs font-bold text-ink-muted">المادة والصف</p>
              <p className="mt-1 text-sm font-bold text-ink">
                {subject.trim() || grade.trim()
                  ? [subject.trim(), grade.trim()].filter(Boolean).join(' · ')
                  : 'غير محدد'}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle p-4">
              <p className="text-xs font-bold text-ink-muted">عدد الأسئلة</p>
              <p className="tabular-nums mt-1 font-display text-lg font-extrabold text-accent">
                {selectedQuestions.length} سؤالاً
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle p-4">
              <p className="text-xs font-bold text-ink-muted">المدة الإجمالية</p>
              <p className="tabular-nums mt-1 font-display text-lg font-extrabold text-ink">
                {formatDurationArabic(totalQuizDurationSeconds)}
              </p>
            </div>
          </div>

          {description.trim() && (
            <div className="mt-4 rounded-xl border border-line bg-surface-subtle p-4 text-xs leading-relaxed text-ink-muted">
              <span className="font-bold text-ink">الوصف: </span>
              {description.trim()}
            </div>
          )}

          {saveError && (
            <div
              role="alert"
              className="mt-5 flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft p-4 text-xs font-bold text-danger-ink"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <h3 className="font-display text-sm font-bold text-ink">
              قائمة الأسئلة المرتبة ({selectedQuestions.length})
            </h3>

            {selectedQuestions.map((q, index) => {
              const meta = [
                q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
                q.subject,
                q.grade,
                q.topic,
                q.difficulty ? DIFFICULTY_LABELS[q.difficulty] : null,
              ].filter((part): part is string => Boolean(part));

              return (
                <article
                  key={q.clientKey}
                  className="rounded-xl border border-line bg-surface-subtle p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                      <span className="tabular-nums font-extrabold text-accent">
                        {index + 1}.
                      </span>
                      {meta.map((part, idx) => (
                        <span key={`${q.clientKey}-sum-${idx}`} className="inline-flex items-center gap-2">
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>{part}</span>
                        </span>
                      ))}
                    </div>
                    <span className="tabular-nums inline-flex items-center gap-1 text-xs font-bold text-ink-muted">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{q.timeLimitSeconds} ثانية</span>
                    </span>
                  </div>

                  <p className="mt-2 font-display text-sm font-bold text-ink">
                    {q.prompt}
                  </p>

                  {q.imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
                      <img
                        src={q.imageUrl}
                        alt={`صورة السؤال ${index + 1}`}
                        referrerPolicy="no-referrer"
                        className="max-h-40 w-full object-contain"
                      />
                    </div>
                  )}

                  {q.type === 'true_false' ? (
                    <p className="mt-2 text-xs font-bold text-success-ink">
                      الإجابة الصحيحة: {q.correctBoolean ? 'صح' : 'خطأ'}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                            opt.isCorrect
                              ? 'border-success-line bg-success-soft font-bold text-success-ink'
                              : 'border-line bg-surface text-ink'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="tabular-nums text-ink-muted">{optIdx + 1}.</span>
                            {opt.optionText && <span className="truncate">{opt.optionText}</span>}
                            {opt.imageUrl && (
                              <img
                                src={opt.imageUrl}
                                alt={`صورة الاختيار ${optIdx + 1}`}
                                referrerPolicy="no-referrer"
                                className="h-8 w-8 rounded border border-line object-cover"
                              />
                            )}
                          </div>
                          {opt.isCorrect && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-ink" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsSummaryStep(false)}
              className="qc-btn-secondary h-11 rounded-xl px-5 text-xs font-bold disabled:opacity-50"
            >
              العودة للتعديل
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveQuiz()}
              className="qc-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>
                {isSaving
                  ? 'جارٍ الحفظ...'
                  : isEditing
                    ? 'حفظ التعديلات'
                    : 'حفظ المسابقة'}
              </span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Basic Info */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink">
              {isEditing ? 'تعديل المسابقة' : 'إنشاء مسابقة جديدة'}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {isEditing
                ? 'عدّل تفاصيل المسابقة أو أضف وأعد ترتيب الأسئلة دون التأثير على بنك الأسئلة الأصلي.'
                : 'حدّد بيانات المسابقة ثم اختر الأسئلة يدوياً أو عشوائياً أو ادمج بينهما.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="qc-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold whitespace-nowrap shrink-0"
          >
            <span>إلغاء والعودة للمسابقات</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <label
              htmlFor="quiz-title-input"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              اسم المسابقة <span className="text-danger">*</span>
            </label>
            <input
              id="quiz-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="مثال: مراجعة قوانين الحركة والسرعة"
              maxLength={200}
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="quiz-subject-input"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              المادة <span className="font-normal text-ink-muted">(اختياري)</span>
            </label>
            <input
              id="quiz-subject-input"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: الفيزياء"
              maxLength={120}
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="quiz-grade-input"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              الصف <span className="font-normal text-ink-muted">(اختياري)</span>
            </label>
            <input
              id="quiz-grade-input"
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="مثال: الصف العاشر"
              maxLength={120}
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </div>

          <div className="md:col-span-7">
            <label
              htmlFor="quiz-desc-input"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              وصف المسابقة <span className="font-normal text-ink-muted">(اختياري)</span>
            </label>
            <input
              id="quiz-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملاحظات مختصرة عن أهداف المسابقة أو محتواها..."
              maxLength={1000}
              className="qc-input h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </div>

          <div className="md:col-span-5">
            <label
              htmlFor="quiz-default-time-input"
              className="mb-1.5 block text-xs font-bold text-ink"
            >
              الوقت الافتراضي للإجابة (بالثواني)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="quiz-default-time-input"
                type="number"
                min={5}
                max={600}
                value={defaultTimeSeconds || ''}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setDefaultTimeSeconds(Number.isNaN(val) ? 0 : val);
                }}
                className="qc-input tabular-nums h-11 w-24 rounded-xl px-3 text-sm font-bold"
              />
              <div className="flex flex-wrap items-center gap-1">
                {DEFAULT_TIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDefaultTimeSeconds(preset)}
                    className={`tabular-nums h-8 rounded-lg border px-2.5 text-xs font-bold transition-colors ${
                      defaultTimeSeconds === preset
                        ? 'border-selected-line bg-selected text-accent'
                        : 'border-line bg-surface-subtle text-ink-muted hover:bg-row-hover hover:text-ink'
                    }`}
                  >
                    {preset}ث
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Question Selection Method */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">
              إضافة أسئلة من بنك الأسئلة
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              اختر أسلوب الانتقاء المناسب: يدوي، عشوائي، أو الدمج بينهما دون تكرار.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="طريقة اختيار الأسئلة"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface-subtle p-1"
          >
            {(
              [
                { id: 'manual', label: 'الاختيار اليدوي', icon: SlidersHorizontal },
                { id: 'random', label: 'الاختيار العشوائي', icon: Shuffle },
                { id: 'combined', label: 'الدمج (يدوي + عشوائي)', icon: Layers },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = selectionMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectionMode(tab.id);
                    setRandomError(null);
                    setRandomSuccessNotice(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-selected text-accent shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual / Combined Browser */}
        {(selectionMode === 'manual' || selectionMode === 'combined') && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-bold text-ink">
                {selectionMode === 'combined'
                  ? '1. استعراض وتحديد الأسئلة يدوياً'
                  : 'استعراض الأسئلة المحفوظة في بنك الأسئلة'}
              </h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="tabular-nums">المتاح في البنك: {bankTotalCount}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums font-bold text-accent">
                  المحدد للإضافة: {stagedManualIds.length}
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
              <div className="relative md:col-span-6 lg:col-span-4">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={manualFilters.search ?? ''}
                  onChange={(e) =>
                    setManualFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="ابحث في نص السؤال أو الموضوع..."
                  aria-label="البحث في أسئلة البنك"
                  className="qc-input h-10 w-full rounded-xl pe-3 ps-9 text-xs"
                />
              </div>

              <div className="md:col-span-3 lg:col-span-2">
                <select
                  aria-label="تصفية حسب النوع"
                  value={manualFilters.type ?? 'all'}
                  onChange={(e) =>
                    setManualFilters((prev) => ({
                      ...prev,
                      type: e.target.value as QuestionType | 'all',
                    }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="multiple_choice">اختيار من متعدد</option>
                  <option value="true_false">صح أو خطأ</option>
                </select>
              </div>

              <div className="md:col-span-3 lg:col-span-2">
                <select
                  aria-label="تصفية حسب المادة"
                  value={manualFilters.subject ?? 'all'}
                  onChange={(e) =>
                    setManualFilters((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل المواد</option>
                  {bankFacets.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية حسب الصف"
                  value={manualFilters.grade ?? 'all'}
                  onChange={(e) =>
                    setManualFilters((prev) => ({ ...prev, grade: e.target.value }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل الصفوف</option>
                  {bankFacets.grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية حسب الصعوبة"
                  value={manualFilters.difficulty ?? 'all'}
                  onChange={(e) =>
                    setManualFilters((prev) => ({
                      ...prev,
                      difficulty: e.target.value as QuestionDifficulty | 'all',
                    }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل المستويات</option>
                  <option value="easy">سهل</option>
                  <option value="medium">متوسط</option>
                  <option value="hard">صعب</option>
                </select>
              </div>

              {bankFacets.topics.length > 0 && (
                <div className="md:col-span-4 lg:col-span-3">
                  <select
                    aria-label="تصفية حسب الموضوع"
                    value={manualFilters.topic ?? 'all'}
                    onChange={(e) =>
                      setManualFilters((prev) => ({ ...prev, topic: e.target.value }))
                    }
                    className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                  >
                    <option value="all">كل المواضيع</option>
                    {bankFacets.topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {bankError ? (
              <div
                role="alert"
                className="flex flex-col items-center justify-center rounded-xl border border-danger-line bg-danger-soft p-6 text-center"
              >
                <p className="text-xs font-bold text-danger-ink">{bankError}</p>
                <button
                  type="button"
                  onClick={() => void loadBankQuestions()}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-danger px-3.5 text-xs font-bold text-white transition-colors hover:bg-danger-hover"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : isBankLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl border border-line bg-surface-subtle"
                  />
                ))}
              </div>
            ) : bankTotalCount === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface-subtle px-6 py-10 text-center">
                <p className="font-display text-sm font-bold text-ink">
                  بنك الأسئلة فارغ حالياً
                </p>
                <p className="mt-1 max-w-md text-xs text-ink-muted">
                  أضف أسئلة في قسم بنك الأسئلة أولاً لتتمكن من إضافتها إلى مسابقتك.
                </p>
                {onOpenQuestionBank && (
                  <button
                    type="button"
                    onClick={onOpenQuestionBank}
                    className="qc-btn-primary mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>الذهاب إلى بنك الأسئلة</span>
                  </button>
                )}
              </div>
            ) : bankQuestions.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface-subtle px-6 py-8 text-center">
                <p className="text-xs font-bold text-ink-muted">
                  لا توجد أسئلة مطابقة لمعايير البحث الحالية.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectableFilteredBankIds.length === 0}
                      onClick={handleToggleSelectAllVisible}
                      className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold disabled:opacity-40"
                    >
                      <span>
                        {allSelectableChecked ? 'إلغاء تحديد الظاهر' : 'تحديد الكل الظاهر'}
                      </span>
                    </button>

                    {stagedManualIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStagedManualIds([])}
                        className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-ink-muted transition-colors hover:text-ink"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>إلغاء التحديد</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={stagedManualIds.length === 0}
                    onClick={handleAddStagedManualQuestions}
                    className="qc-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="tabular-nums">
                      إضافة المحدد للمسابقة ({stagedManualIds.length})
                    </span>
                  </button>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto pe-1">
                  {bankQuestions.map((question) => {
                    const alreadyAdded = alreadyIncludedBankIdSet.has(question.id);
                    const isChecked = stagedManualIds.includes(question.id);
                    const meta = [
                      question.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
                      question.subject,
                      question.grade,
                      question.topic,
                      question.difficulty ? DIFFICULTY_LABELS[question.difficulty] : null,
                    ].filter((part): part is string => Boolean(part));

                    return (
                      <div
                        key={question.id}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                          alreadyAdded
                            ? 'border-success-line bg-success-soft'
                            : isChecked
                              ? 'border-selected-line bg-selected'
                              : 'border-line bg-surface-subtle hover:border-line-strong'
                        }`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            disabled={alreadyAdded}
                            checked={alreadyAdded || isChecked}
                            onChange={() => toggleManualCheckbox(question.id)}
                            aria-label={`تحديد السؤال: ${question.prompt}`}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-line-strong disabled:opacity-60"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                              {meta.map((part, idx) => (
                                <span
                                  key={`${question.id}-bmeta-${idx}`}
                                  className="inline-flex items-center gap-2"
                                >
                                  {idx > 0 && <span aria-hidden="true">·</span>}
                                  <span>{part}</span>
                                </span>
                              ))}
                              {question.imageUrl && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" />
                                    <span>صورة</span>
                                  </span>
                                </>
                              )}
                              {alreadyAdded && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-bold text-success-ink">
                                    مُضاف للمسابقة
                                  </span>
                                </>
                              )}
                            </div>

                            <p className="text-sm font-bold leading-snug text-ink">
                              {question.prompt}
                            </p>
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => setPreviewBankQuestion(question)}
                          aria-label={`معاينة السؤال: ${question.prompt}`}
                          className="qc-btn-secondary inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>معاينة</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Random / Combined Random Addition */}
        {(selectionMode === 'random' || selectionMode === 'combined') && (
          <div
            className={`${
              selectionMode === 'combined'
                ? 'mt-6 border-t border-line pt-6'
                : 'mt-5'
            } space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-bold text-ink">
                {selectionMode === 'combined'
                  ? '2. سحب أسئلة عشوائية إضافية (مع استبعاد الأسئلة المختارة يدوياً)'
                  : 'تحديد شروط السحب العشوائي من بنك الأسئلة'}
              </h4>
              <div className="tabular-nums text-xs font-bold text-ink-muted">
                {isRandomCountLoading ? (
                  <span>جارٍ حساب الأسئلة المتاحة...</span>
                ) : randomAvailableCount !== null ? (
                  <span>
                    الأسئلة المتاحة للسحب:{' '}
                    <strong className="text-accent">{randomAvailableCount}</strong> سؤالاً
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية العشوائي حسب النوع"
                  value={randomFilters.type ?? 'all'}
                  onChange={(e) =>
                    setRandomFilters((prev) => ({
                      ...prev,
                      type: e.target.value as QuestionType | 'all',
                    }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="multiple_choice">اختيار من متعدد</option>
                  <option value="true_false">صح أو خطأ</option>
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية العشوائي حسب المادة"
                  value={randomFilters.subject ?? 'all'}
                  onChange={(e) =>
                    setRandomFilters((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل المواد</option>
                  {bankFacets.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية العشوائي حسب الصف"
                  value={randomFilters.grade ?? 'all'}
                  onChange={(e) =>
                    setRandomFilters((prev) => ({ ...prev, grade: e.target.value }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل الصفوف</option>
                  {bankFacets.grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية العشوائي حسب الموضوع"
                  value={randomFilters.topic ?? 'all'}
                  onChange={(e) =>
                    setRandomFilters((prev) => ({ ...prev, topic: e.target.value }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل المواضيع</option>
                  {bankFacets.topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <select
                  aria-label="تصفية العشوائي حسب الصعوبة"
                  value={randomFilters.difficulty ?? 'all'}
                  onChange={(e) =>
                    setRandomFilters((prev) => ({
                      ...prev,
                      difficulty: e.target.value as QuestionDifficulty | 'all',
                    }))
                  }
                  className="qc-input h-10 w-full rounded-xl px-3 text-xs font-medium"
                >
                  <option value="all">كل المستويات</option>
                  <option value="easy">سهل</option>
                  <option value="medium">متوسط</option>
                  <option value="hard">صعب</option>
                </select>
              </div>

              <div className="md:col-span-4 lg:col-span-2">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, randomAvailableCount ?? 200)}
                  value={randomCountInput}
                  onChange={(e) => {
                    setRandomCountInput(e.target.value);
                    setRandomError(null);
                    setRandomSuccessNotice(null);
                  }}
                  aria-label="عدد الأسئلة العشوائية"
                  placeholder="العدد"
                  className="qc-input tabular-nums h-10 w-full rounded-xl px-3 text-xs font-bold"
                />
              </div>
            </div>

            {randomCountValidationMessage && randomAvailableCount !== null && (
              <p className="text-xs font-bold text-warning-ink">
                {randomCountValidationMessage}
              </p>
            )}

            {randomError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft p-3 text-xs font-bold text-danger-ink"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{randomError}</span>
              </div>
            )}

            {randomSuccessNotice && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft p-3 text-xs font-bold text-success-ink"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{randomSuccessNotice}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectionMode === 'combined' && stagedManualIds.length > 0 ? (
                <button
                  type="button"
                  disabled={
                    isRandomDrawing ||
                    isRandomCountLoading ||
                    Boolean(randomCountValidationMessage)
                  }
                  onClick={() => void handleDrawRandom(true)}
                  className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isRandomDrawing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                  <span className="tabular-nums">
                    إضافة اليدوي ({stagedManualIds.length}) وسحب {parsedRandomCount || 0} عشوائياً
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    isRandomDrawing ||
                    isRandomCountLoading ||
                    Boolean(randomCountValidationMessage)
                  }
                  onClick={() => void handleDrawRandom(false)}
                  className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isRandomDrawing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  <span>سحب وإضافة الأسئلة عشوائياً</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Selected Questions Ordered List & Timing */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">
              أسئلة المسابقة المختارة ({selectedQuestions.length})
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              اسحب الأسئلة لإعادة ترتيبها أو عدّل وقت كل سؤال بشكل مستقل.
              {selectedQuestions.length > 0 && (
                <span className="tabular-nums font-bold text-ink">
                  {' · '}المدة الكلية: {formatDurationArabic(totalQuizDurationSeconds)}
                </span>
              )}
            </p>
          </div>

          {selectedQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleApplyDefaultTimeToAll}
              className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold whitespace-nowrap shrink-0"
            >
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span className="tabular-nums">
                تطبيق الوقت الافتراضي ({safeDefaultTime} ث) على الكل
              </span>
            </button>
          )}
        </div>

        {selectedQuestions.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line-strong bg-surface-subtle px-6 py-10 text-center">
            <p className="font-display text-sm font-bold text-ink">
              لم تتم إضافة أي أسئلة للمسابقة بعد
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              استخدم قسم «إضافة أسئلة من بنك الأسئلة» أعلاه لاختيار أسئلة يدوياً أو سحبها عشوائياً.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {selectedQuestions.map((item, index) => {
              const isExpanded = Boolean(expandedDraftKeys[item.clientKey]);
              const isDropTarget = dragOverIndex === index && draggedIndex !== index;
              const meta = [
                item.type === 'multiple_choice' ? 'اختيار من متعدد' : 'صح أو خطأ',
                item.subject,
                item.grade,
                item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : null,
              ].filter((part): part is string => Boolean(part));

              return (
                <article
                  key={item.clientKey}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl border p-4 transition-colors ${
                    isDropTarget
                      ? 'border-selected-line bg-selected'
                      : 'border-line bg-surface-subtle'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className="mt-1 flex cursor-grab items-center gap-1 text-ink-muted active:cursor-grabbing"
                        title="اسحب لإعادة الترتيب"
                      >
                        <GripVertical className="h-4 w-4" />
                        <span className="tabular-nums font-display text-sm font-extrabold text-accent">
                          {index + 1}
                        </span>
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={`صورة مصغرة للسؤال ${index + 1}`}
                          referrerPolicy="no-referrer"
                          className="hidden h-14 w-16 shrink-0 rounded-lg border border-line object-cover sm:block"
                        />
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                          {meta.map((part, idx) => (
                            <span
                              key={`${item.clientKey}-m-${idx}`}
                              className="inline-flex items-center gap-2"
                            >
                              {idx > 0 && <span aria-hidden="true">·</span>}
                              <span>{part}</span>
                            </span>
                          ))}
                        </div>
                        <p className="font-display text-sm font-bold text-ink">
                          {item.prompt}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-input px-2.5 py-1">
                        <Clock className="h-3.5 w-3.5 text-ink-muted" />
                        <input
                          type="number"
                          min={5}
                          max={600}
                          aria-label={`وقت السؤال رقم ${index + 1} بالثواني`}
                          value={item.timeLimitSeconds || ''}
                          onChange={(e) =>
                            handleQuestionTimeChange(item.clientKey, e.target.value)
                          }
                          className="tabular-nums w-14 bg-transparent text-center text-xs font-bold text-ink focus:outline-none"
                        />
                        <span className="text-xs text-ink-muted">ث</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveQuestion(index, index - 1)}
                          aria-label={`نقل السؤال ${index + 1} للأعلى`}
                          className="qc-btn-secondary flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-35"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedQuestions.length - 1}
                          onClick={() => moveQuestion(index, index + 1)}
                          aria-label={`نقل السؤال ${index + 1} للأسفل`}
                          className="qc-btn-secondary flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-35"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDraftKeys((prev) => ({
                            ...prev,
                            [item.clientKey]: !prev[item.clientKey],
                          }))
                        }
                        className="qc-btn-secondary inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        <span>{isExpanded ? 'إخفاء' : 'تفاصيل'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveDraftQuestion(item.clientKey)}
                        aria-label={`إزالة السؤال ${index + 1} من المسابقة`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-danger-line bg-danger-soft px-2.5 text-xs font-bold text-danger-ink transition-colors hover:brightness-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>إزالة</span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={`صورة السؤال ${index + 1}`}
                          referrerPolicy="no-referrer"
                          className="max-h-48 rounded-lg border border-line object-contain"
                        />
                      )}
                      {item.type === 'true_false' ? (
                        <p className="text-xs font-bold text-success-ink">
                          الإجابة الصحيحة: {item.correctBoolean ? 'صح' : 'خطأ'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {item.options.map((opt, optIdx) => (
                            <div
                              key={opt.id}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                                opt.isCorrect
                                  ? 'border-success-line bg-success-soft font-bold text-success-ink'
                                  : 'border-line bg-surface text-ink'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="tabular-nums text-ink-muted">{optIdx + 1}.</span>
                                {opt.optionText && <span>{opt.optionText}</span>}
                                {opt.imageUrl && (
                                  <img
                                    src={opt.imageUrl}
                                    alt={`صورة الاختيار ${optIdx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="h-8 w-8 rounded border border-line object-cover"
                                  />
                                )}
                              </div>
                              {opt.isCorrect && (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-ink" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft p-3.5 text-xs font-bold text-danger-ink"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={onCancel}
            className="qc-btn-secondary h-11 rounded-xl px-5 text-xs font-bold"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleProceedToSummary}
            className="qc-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold"
          >
            <Eye className="h-4 w-4" />
            <span>معاينة قبل الحفظ</span>
          </button>
        </div>
      </section>

      <QuestionDetailsModal
        question={previewBankQuestion}
        onClose={() => setPreviewBankQuestion(null)}
      />
    </div>
  );
}

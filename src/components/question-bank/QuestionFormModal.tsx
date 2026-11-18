import { CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  QuestionDifficulty,
  QuestionPayload,
  QuestionRecord,
  QuestionType,
  UploadedMediaAsset,
} from '../../types/questionBank';
import { ImageUploadField } from './ImageUploadField';

interface OptionDraft {
  key: string;
  optionText: string;
  imagePath: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

interface QuestionFormModalProps {
  isOpen: boolean;
  editingQuestion: QuestionRecord | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: QuestionPayload) => Promise<void>;
  onUploadImage: (file: File) => Promise<UploadedMediaAsset>;
  onCleanupUnusedImage: (imagePath: string) => Promise<void>;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function createEmptyOptions(): OptionDraft[] {
  return [0, 1, 2, 3].map((idx) => ({
    key: `opt-${idx}-${Date.now()}`,
    optionText: '',
    imagePath: null,
    imageUrl: null,
    isCorrect: false,
  }));
}

export function QuestionFormModal({
  isOpen,
  editingQuestion,
  isSaving,
  onClose,
  onSubmit,
  onUploadImage,
  onCleanupUnusedImage,
}: QuestionFormModalProps) {
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [prompt, setPrompt] = useState('');
  const [questionImagePath, setQuestionImagePath] = useState<string | null>(null);
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionDraft[]>(createEmptyOptions);
  const [correctBoolean, setCorrectBoolean] = useState<boolean | null>(true);

  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | ''>('');

  const [formError, setFormError] = useState<string | null>(null);

  // Track newly uploaded images in this editing session so cancelling/replacing cleans them up safely
  const newlyUploadedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    newlyUploadedPathsRef.current.clear();
    setFormError(null);

    if (editingQuestion) {
      setQuestionType(editingQuestion.type);
      setPrompt(editingQuestion.prompt);
      setQuestionImagePath(editingQuestion.imagePath);
      setQuestionImageUrl(editingQuestion.imageUrl);
      setSubject(editingQuestion.subject ?? '');
      setGrade(editingQuestion.grade ?? '');
      setTopic(editingQuestion.topic ?? '');
      setDifficulty(editingQuestion.difficulty ?? '');

      if (editingQuestion.type === 'true_false') {
        setCorrectBoolean(editingQuestion.correctBoolean ?? true);
        setOptions(createEmptyOptions());
      } else {
        setCorrectBoolean(true);
        const mapped = editingQuestion.options.map((opt, idx) => ({
          key: opt.id || `opt-${idx}-${Date.now()}`,
          optionText: opt.optionText ?? '',
          imagePath: opt.imagePath,
          imageUrl: opt.imageUrl,
          isCorrect: opt.isCorrect,
        }));
        setOptions(mapped.length >= 2 ? mapped : createEmptyOptions());
      }
    } else {
      setQuestionType('multiple_choice');
      setPrompt('');
      setQuestionImagePath(null);
      setQuestionImageUrl(null);
      setOptions(createEmptyOptions());
      setCorrectBoolean(true);
      setSubject('');
      setGrade('');
      setTopic('');
      setDifficulty('');
    }
  }, [isOpen, editingQuestion]);

  const handleCancel = useCallback(async () => {
    if (isSaving) return;
    const pendingUploads = Array.from(newlyUploadedPathsRef.current);
    newlyUploadedPathsRef.current.clear();
    for (const path of pendingUploads) {
      void onCleanupUnusedImage(path).catch(() => {});
    }
    onClose();
  }, [isSaving, onCleanupUnusedImage, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        void handleCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSaving, handleCancel]);

  if (!isOpen) return null;

  const trackAndUpload = async (file: File): Promise<UploadedMediaAsset> => {
    const asset = await onUploadImage(file);
    newlyUploadedPathsRef.current.add(asset.imagePath);
    return asset;
  };

  const cleanupIfSessionUpload = (previousPath: string | null) => {
    if (previousPath && newlyUploadedPathsRef.current.has(previousPath)) {
      newlyUploadedPathsRef.current.delete(previousPath);
      void onCleanupUnusedImage(previousPath).catch(() => {});
    }
  };

  const handleSetCorrectOption = (targetKey: string) => {
    setOptions((prev) =>
      prev.map((opt) => ({
        ...opt,
        isCorrect: opt.key === targetKey,
      }))
    );
  };

  const handleOptionTextChange = (targetKey: string, value: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.key === targetKey ? { ...opt, optionText: value } : opt))
    );
  };

  const handleOptionImageChange = (
    targetKey: string,
    nextPath: string | null,
    nextUrl: string | null,
    previousPath: string | null
  ) => {
    cleanupIfSessionUpload(previousPath);
    setOptions((prev) =>
      prev.map((opt) =>
        opt.key === targetKey ? { ...opt, imagePath: nextPath, imageUrl: nextUrl } : opt
      )
    );
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [
      ...prev,
      {
        key: `opt-${prev.length}-${Date.now()}`,
        optionText: '',
        imagePath: null,
        imageUrl: null,
        isCorrect: false,
      },
    ]);
  };

  const handleRemoveOption = (targetKey: string) => {
    if (options.length <= 2) return;
    const removed = options.find((opt) => opt.key === targetKey);
    if (removed?.imagePath) {
      cleanupIfSessionUpload(removed.imagePath);
    }
    setOptions((prev) => prev.filter((opt) => opt.key !== targetKey));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setFormError('يرجى إدخال نص السؤال قبل الحفظ.');
      return;
    }

    if (questionType === 'true_false') {
      if (correctBoolean === null) {
        setFormError('يرجى تحديد الإجابة الصحيحة (صح أو خطأ).');
        return;
      }
    } else {
      for (let i = 0; i < options.length; i += 1) {
        const opt = options[i];
        if (!opt.optionText.trim() && !opt.imagePath) {
          setFormError(
            `الاختيار (${OPTION_LETTERS[i] ?? i + 1}) فارغ؛ يرجى كتابة نص أو إرفاق صورة.`
          );
          return;
        }
      }

      const correctCount = options.filter((opt) => opt.isCorrect).length;
      if (correctCount !== 1) {
        setFormError('يرجى تحديد إجابة صحيحة واحدة فقط قبل حفظ السؤال.');
        return;
      }
    }

    const payload: QuestionPayload = {
      type: questionType,
      prompt: trimmedPrompt,
      imagePath: questionImagePath,
      correctBoolean: questionType === 'true_false' ? correctBoolean : null,
      subject: subject.trim() || null,
      grade: grade.trim() || null,
      topic: topic.trim() || null,
      difficulty: difficulty || null,
      options:
        questionType === 'multiple_choice'
          ? options.map((opt) => ({
              optionText: opt.optionText.trim() || null,
              imagePath: opt.imagePath,
              isCorrect: opt.isCorrect,
            }))
          : [],
    };

    try {
      await onSubmit(payload);
      // Saved successfully — prevent cleanup of committed uploads
      newlyUploadedPathsRef.current.clear();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر حفظ السؤال في قاعدة البيانات.';
      setFormError(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-form-title"
    >
      <div
        className="fixed inset-0 bg-backdrop backdrop-blur-xs"
        onClick={() => void handleCancel()}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-modal shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3
              id="question-form-title"
              className="font-display text-lg font-extrabold text-ink"
            >
              {editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              يُحفظ السؤال والصور المرتبطة به مباشرة في قاعدة البيانات المحلية
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleCancel()}
            aria-label="إغلاق النموذج"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-danger-line bg-danger-soft p-3.5 text-xs font-bold text-danger-ink"
              >
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink">نوع السؤال</label>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      id: 'multiple_choice',
                      title: 'اختيار من متعدد',
                      desc: 'خيارات نصية أو مصورة مع إجابة صحيحة واحدة',
                    },
                    {
                      id: 'true_false',
                      title: 'صح أو خطأ',
                      desc: 'تقرير صحة أو خطأ العبارة بسرعة',
                    },
                  ] as const
                ).map((item) => {
                  const active = questionType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setQuestionType(item.id);
                      }}
                      className={`rounded-xl border p-3.5 text-start transition-colors ${
                        active
                          ? 'border-primary bg-selected text-ink dark:border-icon-soft'
                          : 'border-line bg-input text-ink-muted hover:bg-row-hover hover:text-ink'
                      }`}
                    >
                      <span className="font-display block text-sm font-bold text-ink">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="question-prompt-input"
                className="block text-xs font-bold text-ink"
              >
                نص السؤال <span className="text-danger">*</span>
              </label>
              <textarea
                id="question-prompt-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="اكتب نص السؤال بوضوح هنا..."
                className="qc-input w-full rounded-xl p-3.5 text-sm"
              />

              <ImageUploadField
                label="إرفاق صورة للسؤال (اختياري)"
                imagePath={questionImagePath}
                imageUrl={questionImageUrl}
                onUpload={trackAndUpload}
                onChange={(nextPath, nextUrl, prevPath) => {
                  cleanupIfSessionUpload(prevPath);
                  setQuestionImagePath(nextPath);
                  setQuestionImageUrl(nextUrl);
                }}
              />
            </div>

            {questionType === 'multiple_choice' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-ink">
                      الاختيارات وتحديد الإجابة الصحيحة <span className="text-danger">*</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      يمكنك إدخال نص، أو صورة، أو الجمع بين النص والصورة لكل اختيار، مع تحديد
                      إجابة صحيحة واحدة فقط.
                    </p>
                  </div>

                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="qc-btn-secondary inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة اختيار</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div
                      key={opt.key}
                      className={`rounded-xl border p-4 transition-colors ${
                        opt.isCorrect
                          ? 'border-success-line bg-success-soft'
                          : 'border-line bg-surface-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(opt.key)}
                          className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                            opt.isCorrect
                              ? 'bg-success text-white'
                              : 'border border-line bg-surface text-ink-muted hover:border-success-line hover:text-success-ink'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {opt.isCorrect
                              ? `الاختيار (${OPTION_LETTERS[idx] ?? idx + 1}) · الإجابة الصحيحة`
                              : `تعيين (${OPTION_LETTERS[idx] ?? idx + 1}) كإجابة صحيحة`}
                          </span>
                        </button>

                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(opt.key)}
                            aria-label={`حذف الاختيار ${OPTION_LETTERS[idx] ?? idx + 1}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger-ink"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>إزالة</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <input
                          type="text"
                          value={opt.optionText}
                          onChange={(e) => handleOptionTextChange(opt.key, e.target.value)}
                          placeholder={`نص الاختيار ${OPTION_LETTERS[idx] ?? idx + 1} (اختياري عند إرفاق صورة)...`}
                          className="qc-input h-10 w-full rounded-xl px-3 text-sm"
                        />

                        <ImageUploadField
                          compact
                          label={`إرفاق صورة للاختيار ${OPTION_LETTERS[idx] ?? idx + 1}`}
                          imagePath={opt.imagePath}
                          imageUrl={opt.imageUrl}
                          onUpload={trackAndUpload}
                          onChange={(nextPath, nextUrl, prevPath) =>
                            handleOptionImageChange(opt.key, nextPath, nextUrl, prevPath)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-ink">
                  الإجابة الصحيحة <span className="text-danger">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: true, label: 'صح' },
                    { value: false, label: 'خطأ' },
                  ].map((choice) => {
                    const active = correctBoolean === choice.value;
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() => setCorrectBoolean(choice.value)}
                        className={`flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-extrabold transition-colors ${
                          active
                            ? 'border-success bg-success-soft text-success-ink'
                            : 'border-line bg-input text-ink-muted hover:bg-row-hover hover:text-ink'
                        }`}
                      >
                        {active && <CheckCircle2 className="h-4 w-4 text-success-ink" />}
                        <span className="font-display">{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-5">
              <div className="mb-3">
                <p className="text-xs font-bold text-ink">التصنيفات (اختياري بالكامل)</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  تساعدك على تنظيم بنك الأسئلة وتصفيتها لاحقاً، ويمكنك الحفظ دون تعبئتها.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="q-subject"
                    className="mb-1 block text-xs font-medium text-ink-muted"
                  >
                    المادة الدراسية
                  </label>
                  <input
                    id="q-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: الفيزياء"
                    className="qc-input h-10 w-full rounded-xl px-3 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-grade"
                    className="mb-1 block text-xs font-medium text-ink-muted"
                  >
                    الصف الدراسي
                  </label>
                  <input
                    id="q-grade"
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="مثال: الصف العاشر"
                    className="qc-input h-10 w-full rounded-xl px-3 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-topic"
                    className="mb-1 block text-xs font-medium text-ink-muted"
                  >
                    الموضوع
                  </label>
                  <input
                    id="q-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="مثال: قوانين الحركة"
                    className="qc-input h-10 w-full rounded-xl px-3 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-difficulty"
                    className="mb-1 block text-xs font-medium text-ink-muted"
                  >
                    مستوى الصعوبة
                  </label>
                  <select
                    id="q-difficulty"
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as QuestionDifficulty | '')
                    }
                    className="qc-input h-10 w-full rounded-xl px-3 text-xs"
                  >
                    <option value="">غير محدد</option>
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-subtle px-6 py-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCancel()}
              className="qc-btn-secondary h-10 rounded-xl px-4 text-xs font-bold disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="qc-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-5 text-xs font-bold disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {isSaving
                  ? 'جارٍ الحفظ...'
                  : editingQuestion
                    ? 'حفظ التعديلات'
                    : 'حفظ السؤال'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        void handleCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

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

  const handleCancel = async () => {
    if (isSaving) return;
    const pendingUploads = Array.from(newlyUploadedPathsRef.current);
    newlyUploadedPathsRef.current.clear();
    for (const path of pendingUploads) {
      void onCleanupUnusedImage(path).catch(() => {});
    }
    onClose();
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
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
        onClick={() => void handleCancel()}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h3
              id="question-form-title"
              className="font-display text-lg font-extrabold text-slate-900 dark:text-white"
            >
              {editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              يُحفظ السؤال والصور المرتبطة به مباشرة في قاعدة البيانات المحلية
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleCancel()}
            aria-label="إغلاق النموذج"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                نوع السؤال
              </label>
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
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-display block text-sm font-bold">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
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
                className="block text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                نص السؤال <span className="text-red-600">*</span>
              </label>
              <textarea
                id="question-prompt-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="اكتب نص السؤال بوضوح هنا..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
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
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      الاختيارات وتحديد الإجابة الصحيحة <span className="text-red-600">*</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      يمكنك إدخال نص، أو صورة، أو الجمع بين النص والصورة لكل اختيار، مع تحديد
                      إجابة صحيحة واحدة فقط.
                    </p>
                  </div>

                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(opt.key)}
                          className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                            opt.isCorrect
                              ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-600'
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
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
                          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
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
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  الإجابة الصحيحة <span className="text-red-600">*</span>
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
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {active && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                        <span className="font-display">{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="mb-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  التصنيفات (اختياري بالكامل)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  تساعدك على تنظيم بنك الأسئلة وتصفيتها لاحقاً، ويمكنك الحفظ دون تعبئتها.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="q-subject"
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    المادة الدراسية
                  </label>
                  <input
                    id="q-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: الفيزياء"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-grade"
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    الصف الدراسي
                  </label>
                  <input
                    id="q-grade"
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="مثال: الصف العاشر"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-topic"
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    الموضوع
                  </label>
                  <input
                    id="q-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="مثال: قوانين الحركة"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="q-difficulty"
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    مستوى الصعوبة
                  </label>
                  <select
                    id="q-difficulty"
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as QuestionDifficulty | '')
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
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

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCancel()}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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

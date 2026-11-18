import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  HelpCircle,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { QuestionPayload } from '../../types/questionBank';
import type { ExcelImportSummary, ParsedQuestionRow } from '../../utils/questionBankExcel';

export interface QuestionImportModalProps {
  isOpen: boolean;
  summary: ExcelImportSummary | null;
  isSaving: boolean;
  onClose: () => void;
  onSelectDifferentFile: () => void;
  onConfirmImport: (validPayloads: QuestionPayload[]) => Promise<void>;
}

type FilterViewMode = 'all' | 'valid' | 'errors';

export function QuestionImportModal({
  isOpen,
  summary,
  isSaving,
  onClose,
  onSelectDifferentFile,
  onConfirmImport,
}: QuestionImportModalProps) {
  const [filterMode, setFilterMode] = useState<FilterViewMode>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !summary) return null;

  const {
    fileName,
    totalRows,
    validCount,
    errorCount,
    warningCount,
    multipleChoiceCount,
    trueFalseCount,
    duplicateCount,
    rows,
    validPayloads,
    fatalError,
  } = summary;

  const filteredRows = rows.filter((r) => {
    if (filterMode === 'valid') return r.isValid;
    if (filterMode === 'errors') return !r.isValid;
    return true;
  });

  const handleConfirm = async () => {
    if (validPayloads.length === 0 || isSaving) return;
    setErrorMessage(null);
    try {
      await onConfirmImport(validPayloads);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'تعذر استيراد الأسئلة إلى قاعدة البيانات.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
    >
      <div
        className="fixed inset-0 bg-backdrop backdrop-blur-xs transition-opacity"
        onClick={!isSaving ? onClose : undefined}
      />

      <div className="qc-card relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl shadow-2xl border border-line">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-surface/90 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-selected text-accent">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 id="import-modal-title" className="font-display text-lg font-extrabold text-ink">
                معاينة استيراد الأسئلة من Excel
              </h2>
              <p className="text-xs text-ink-muted">الملف: {fileName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="إغلاق نافذة المعاينة"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-row-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-xs font-bold text-danger-ink"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {fatalError ? (
            <div className="rounded-2xl border border-danger-line bg-danger-soft p-6 text-center space-y-3">
              <XCircle className="mx-auto h-12 w-12 text-danger" />
              <h3 className="font-display text-base font-bold text-danger-ink">{fatalError}</h3>
              <p className="text-xs text-ink-muted">
                يرجى التأكد من اختيار ملف Excel سليم تم تنزيله من القالب الرسمي لـ QuizClass، وتعبئته
                وفق التعليمات.
              </p>
              <button
                type="button"
                onClick={onSelectDifferentFile}
                className="qc-btn-primary mt-2 inline-flex h-10 items-center gap-2 rounded-xl px-5 text-xs font-bold"
              >
                <FileUp className="h-4 w-4" />
                <span>اختيار ملف آخر</span>
              </button>
            </div>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-line bg-surface p-4 text-start">
                  <span className="block text-xs font-medium text-ink-muted">إجمالي المقروء</span>
                  <span className="tabular-nums font-display mt-1 block text-2xl font-black text-ink">
                    {totalRows}
                  </span>
                  <span className="text-[11px] text-ink-muted">صفاً داخل الملف</span>
                </div>

                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-start dark:border-emerald-800 dark:bg-emerald-950/30">
                  <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    جاهز للاستيراد
                  </span>
                  <span className="tabular-nums font-display mt-1 block text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {validCount}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {multipleChoiceCount} اختيار · {trueFalseCount} صح/خطأ
                  </span>
                </div>

                <div
                  className={`rounded-2xl border p-4 text-start ${
                    errorCount > 0
                      ? 'border-red-300 bg-red-50/70 dark:border-red-800 dark:bg-red-950/30'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`block text-xs font-bold ${
                      errorCount > 0 ? 'text-red-800 dark:text-red-300' : 'text-ink-muted'
                    }`}
                  >
                    صفوف بها أخطاء
                  </span>
                  <span
                    className={`tabular-nums font-display mt-1 block text-2xl font-black ${
                      errorCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-ink'
                    }`}
                  >
                    {errorCount}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {errorCount > 0 ? 'سيتم تخطيها تلقائياً' : 'لا توجد أخطاء'}
                  </span>
                </div>

                <div className="rounded-2xl border border-warning-line bg-warning-soft p-4 text-start">
                  <span className="block text-xs font-bold text-warning-ink">تنبيهات وتكرار</span>
                  <span className="tabular-nums font-display mt-1 block text-2xl font-black text-warning-ink">
                    {duplicateCount}
                  </span>
                  <span className="text-[11px] text-warning-ink">
                    {duplicateCount > 0 ? 'أسئلة مكررة (مسموح استيرادها)' : 'لا توجد تكرارات'}
                  </span>
                </div>
              </div>

              {/* Warning/Info Banners */}
              {errorCount > 0 && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-2xl border border-warning-line bg-warning-soft p-4 text-xs font-medium text-warning-ink"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-bold">
                      يحتوي الملف على {errorCount} {errorCount === 1 ? 'صف' : 'صفوف'} به أخطاء
                      بيانات.
                    </p>
                    <p className="mt-0.5 opacity-90">
                      يمكنك تأكيد استيراد الأسئلة الصالحة ({validCount} سؤالاً) الآن مع تخطي الصفوف
                      غير الصالحة، أو إلغاء العملية وتعديل ملف Excel ثم إعادة اختياره.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-line bg-input p-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      filterMode === 'all'
                        ? 'bg-selected text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    الكل ({totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('valid')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      filterMode === 'valid'
                        ? 'bg-selected text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    الصحيحة فقط ({validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('errors')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      filterMode === 'errors'
                        ? 'bg-selected text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    الأخطاء فقط ({errorCount})
                  </button>
                </div>

                <div className="text-xs text-ink-muted">
                  عرض {filteredRows.length} من أصل {totalRows} صفاً
                </div>
              </div>

              {/* Preview Rows Table */}
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full border-collapse text-start text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface-subtle font-bold text-ink-muted">
                      <th className="p-3 text-start w-16">الصف</th>
                      <th className="p-3 text-start w-28">النوع</th>
                      <th className="p-3 text-start min-w-[220px]">نص السؤال</th>
                      <th className="p-3 text-start min-w-[180px]">الخيارات / الإجابة</th>
                      <th className="p-3 text-start w-32">التصنيف</th>
                      <th className="p-3 text-start min-w-[200px]">حالة الفحص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-ink-muted">
                          لا توجد عناصر مطابقة للتصفية المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr
                          key={`excel-row-${row.rowNumber}`}
                          className={
                            !row.isValid
                              ? 'bg-red-50/40 dark:bg-red-950/15'
                              : row.warnings.length > 0
                                ? 'bg-amber-50/30 dark:bg-amber-950/10'
                                : undefined
                          }
                        >
                          <td className="tabular-nums p-3 font-mono font-bold text-ink-muted">
                            #{row.rowNumber}
                          </td>

                          <td className="p-3">
                            {row.type === 'multiple_choice' ? (
                              <span className="inline-flex rounded-lg bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                                اختيار من متعدد
                              </span>
                            ) : row.type === 'true_false' ? (
                              <span className="inline-flex rounded-lg bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
                                صح أو خطأ
                              </span>
                            ) : (
                              <span className="inline-flex rounded-lg bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-200">
                                غير معروف
                              </span>
                            )}
                          </td>

                          <td className="p-3 font-medium text-ink max-w-sm">
                            <p className="line-clamp-2 leading-relaxed" title={row.prompt}>
                              {row.prompt || (
                                <span className="text-red-600 dark:text-red-400 italic">
                                  (فارغ)
                                </span>
                              )}
                            </p>
                          </td>

                          <td className="p-3 text-[11px]">
                            {row.type === 'multiple_choice' ? (
                              <div className="space-y-1">
                                <span className="font-bold text-ink-muted">
                                  {row.options.length} خيارات:
                                </span>
                                <div className="space-y-0.5">
                                  {row.options.map((opt, idx) => {
                                    const isCorrect = idx + 1 === row.correctOptionIndex;
                                    return (
                                      <div
                                        key={idx}
                                        className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${
                                          isCorrect
                                            ? 'bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                                            : 'text-ink-muted'
                                        }`}
                                      >
                                        <span className="tabular-nums font-mono text-[10px]">
                                          {idx + 1}.
                                        </span>
                                        <span className="truncate">{opt}</span>
                                        {isCorrect && (
                                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : row.type === 'true_false' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-ink-muted font-bold">الإجابة:</span>
                                <span
                                  className={`rounded-md px-2 py-0.5 font-bold ${
                                    row.correctBoolean
                                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                                      : 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200'
                                  }`}
                                >
                                  {row.correctBoolean ? 'صح' : 'خطأ'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>

                          <td className="p-3 text-[11px] text-ink-muted">
                            <div className="space-y-0.5">
                              {row.subject && (
                                <span className="block truncate font-bold text-ink">
                                  {row.subject}
                                </span>
                              )}
                              {row.grade && <span className="block truncate">{row.grade}</span>}
                              <span className="inline-block rounded bg-surface-subtle px-1.5 py-0.5 font-bold">
                                {row.difficulty === 'easy'
                                  ? 'سهل'
                                  : row.difficulty === 'hard'
                                    ? 'صعب'
                                    : 'متوسط'}
                              </span>
                            </div>
                          </td>

                          <td className="p-3">
                            {row.isValid ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>جاهز للاستيراد</span>
                                </div>
                                {row.warnings.map((w, wIdx) => (
                                  <p
                                    key={wIdx}
                                    className="text-[11px] font-medium text-amber-700 dark:text-amber-400"
                                  >
                                    ⚠️ {w}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
                                  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                  <span>خطأ في البيانات</span>
                                </div>
                                <ul className="space-y-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                                  {row.errors.map((err, eIdx) => (
                                    <li key={eIdx}>• {err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/90 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectDifferentFile}
              disabled={isSaving}
              className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold"
            >
              <FileUp className="h-4 w-4" />
              <span>اختيار ملف آخر</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="qc-btn-secondary inline-flex h-11 items-center rounded-xl px-5 text-xs font-bold"
            >
              إلغاء
            </button>

            {!fatalError && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={validCount === 0 || isSaving}
                className="qc-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جارٍ الاستيراد...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>تأكيد الاستيراد ({validCount} سؤالاً)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

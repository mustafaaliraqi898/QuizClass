import { AlertTriangle, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import type { TeacherLiveSessionDetails } from '../../types/liveSession';

interface LiveSessionConflictModalProps {
  existingSession: TeacherLiveSessionDetails | null;
  isResolving?: boolean;
  errorMessage?: string | null;
  onResumeExisting: (session: TeacherLiveSessionDetails) => void;
  onReplaceSession: (session: TeacherLiveSessionDetails) => void;
  onCancel: () => void;
}

export function LiveSessionConflictModal({
  existingSession,
  isResolving = false,
  errorMessage = null,
  onResumeExisting,
  onReplaceSession,
  onCancel,
}: LiveSessionConflictModalProps) {
  if (!existingSession) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-conflict-modal-title"
    >
      <div
        className="fixed inset-0 bg-backdrop backdrop-blur-xs"
        onClick={isResolving ? undefined : onCancel}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-modal p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="live-conflict-modal-title"
                className="font-display text-base font-extrabold text-ink"
              >
                توجد جلسة مباشرة نشطة لهذه المسابقة
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                لا يمكن تشغيل جلستين متعارضتين لنفس المسابقة في الوقت نفسه.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isResolving}
            onClick={onCancel}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-row-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-surface-subtle p-4 text-xs">
          <p className="font-display font-bold text-ink">
            {existingSession.quizTitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-ink-muted">
            <span className="tabular-nums font-bold">رمز الدخول: {existingSession.pinCode}</span>
            <span aria-hidden="true">·</span>
            <span>
              الحالة:{' '}
              {existingSession.status === 'running' ? 'قيد التشغيل' : 'في انتظار الطلاب'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              المنضمون: {existingSession.participantCount}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-xs font-bold text-danger-ink"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isResolving}
            onClick={() => onResumeExisting(existingSession)}
            className="qc-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" />
            <span>فتح الجلسة النشطة الحالية</span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={() => onReplaceSession(existingSession)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 text-xs font-bold text-warning-ink transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {isResolving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>إلغاء الجلسة السابقة وبدء جلسة جديدة</span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={onCancel}
            className="qc-btn-secondary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-xs font-bold disabled:opacity-60"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StudentFeedbackBannerData } from './studentFeedbackLogic';

interface StudentAnswerFeedbackBannerProps {
  banner: StudentFeedbackBannerData | null;
  onDismissed?: (dedupKey: string) => void;
  holdMs?: number;
}

const ENTER_DURATION_MS = 360;
const EXIT_DURATION_MS = 340;

export function StudentAnswerFeedbackBanner({
  banner,
  onDismissed,
  holdMs = 3200,
}: StudentAnswerFeedbackBannerProps) {
  const [renderedBanner, setRenderedBanner] = useState<StudentFeedbackBannerData | null>(banner);
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const onDismissedRef = useRef(onDismissed);

  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);

  const bannerKey = banner?.dedupKey ?? null;

  useEffect(() => {
    if (!banner || !bannerKey) {
      setRenderedBanner(null);
      return;
    }

    setRenderedBanner(banner);
    setPhase('entering');

    const enterTimer = window.setTimeout(() => {
      setPhase('visible');
    }, ENTER_DURATION_MS);

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting');
    }, ENTER_DURATION_MS + holdMs);

    const hideTimer = window.setTimeout(() => {
      setRenderedBanner(null);
      onDismissedRef.current?.(bannerKey);
    }, ENTER_DURATION_MS + holdMs + EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerKey, holdMs]);

  if (!renderedBanner) {
    return null;
  }

  const isCorrect = renderedBanner.kind === 'correct';
  const isWrong = renderedBanner.kind === 'wrong';

  const containerStyle = isCorrect
    ? 'border-emerald-300 bg-emerald-600 text-white shadow-emerald-950/30 dark:border-emerald-400 dark:bg-emerald-600'
    : isWrong
      ? 'border-red-300 bg-red-600 text-white shadow-red-950/30 dark:border-red-400 dark:bg-red-600'
      : 'border-amber-300 bg-amber-500 text-[#292929] shadow-amber-950/25 dark:border-amber-400 dark:bg-amber-500';

  const animClass = phase === 'exiting' ? 'qc-feedback-slide-out' : 'qc-feedback-slide-in';

  return (
    <div
      aria-live="polite"
      role="status"
      data-testid="student-feedback-banner"
      data-feedback-kind={renderedBanner.kind}
      data-feedback-phase={phase}
      className="pointer-events-none fixed inset-x-0 top-20 z-50 px-3 sm:px-4"
    >
      <div
        className={`pointer-events-auto mx-auto w-full max-w-md rounded-2xl border-2 px-4 py-3.5 shadow-2xl ${containerStyle} ${animClass}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isCorrect || isWrong ? 'bg-white/20 text-white' : 'bg-[#292929]/15 text-[#292929]'
            }`}
          >
            {isCorrect ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : isWrong ? (
              <XCircle className="h-7 w-7" />
            ) : (
              <Clock className="h-7 w-7" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-black leading-tight">
                {renderedBanner.title}
              </p>

              {isCorrect && renderedBanner.pointsAwarded !== null && (
                <span className="tabular-nums shrink-0 rounded-full bg-white/25 px-3 py-0.5 text-xs font-black text-white">
                  +{renderedBanner.pointsAwarded} نقطة
                </span>
              )}
            </div>

            {isCorrect && renderedBanner.subtitle && (
              <p className="text-sm font-extrabold text-emerald-50">
                {renderedBanner.subtitle}
              </p>
            )}

            {!isCorrect && renderedBanner.correctAnswerText && (
              <div
                className={`mt-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold ${
                  isWrong
                    ? 'bg-[#292929]/20 text-white'
                    : 'bg-[#292929]/15 text-[#292929]'
                }`}
              >
                <span className="opacity-85">الإجابة الصحيحة: </span>
                <span className="font-display font-black">
                  {renderedBanner.correctAnswerText}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

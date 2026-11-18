import {
  Award,
  CheckCircle2,
  Crown,
  HelpCircle,
  Medal,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TeacherLiveSessionDetails } from '../../types/liveSession';
import { AnimatedFullBodyAvatar } from './AnimatedFullBodyAvatar';
import { buildPodiumPlan } from './podiumUtils';

interface LiveFinalResultsViewProps {
  session: TeacherLiveSessionDetails;
  onLaunchNewSession: () => void;
  onBackToQuizzes: () => void;
}

const REVEAL_DELAYS_MS = [450, 1350, 2250] as const;

const CONFETTI_PIECES = [
  { leftClass: 'left-[5%]', colorClass: 'bg-warning', sizeClass: 'h-3 w-2 rounded-sm', delayClass: '', alt: false },
  { leftClass: 'left-[11%]', colorClass: 'bg-primary', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[17%]', colorClass: 'bg-success', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-300', alt: false },
  { leftClass: 'left-[24%]', colorClass: 'bg-danger', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: true },
  { leftClass: 'left-[31%]', colorClass: 'bg-icon-soft', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: false },
  { leftClass: 'left-[38%]', colorClass: 'bg-[#E5B85C]', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: true },
  { leftClass: 'left-[45%]', colorClass: 'bg-primary', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-100', alt: false },
  { leftClass: 'left-[53%]', colorClass: 'bg-danger', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-300', alt: true },
  { leftClass: 'left-[60%]', colorClass: 'bg-success', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-500', alt: false },
  { leftClass: 'left-[67%]', colorClass: 'bg-warning', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[75%]', colorClass: 'bg-icon-soft', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: false },
  { leftClass: 'left-[82%]', colorClass: 'bg-[#E5B85C]', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: true },
  { leftClass: 'left-[89%]', colorClass: 'bg-success', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: false },
  { leftClass: 'left-[95%]', colorClass: 'bg-primary', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-1000', alt: true },
] as const;

export function LiveFinalResultsView({
  session,
  onLaunchNewSession,
  onBackToQuizzes,
}: LiveFinalResultsViewProps) {
  const leaderboard = session.finalResults ?? [];
  const podiumPlan = useMemo(() => buildPodiumPlan(leaderboard), [leaderboard]);

  const [revealStage, setRevealStage] = useState<number>(0);
  const [replayNonce, setReplayNonce] = useState<number>(0);

  const participantAvatarMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of session.participants) {
      map.set(p.id, p.avatarId);
    }
    return map;
  }, [session.participants]);

  useEffect(() => {
    setRevealStage(0);
    if (podiumPlan.revealSequenceSteps.length === 0) {
      return;
    }

    const timers = podiumPlan.revealSequenceSteps.map((targetStep, index) => {
      const delay = REVEAL_DELAYS_MS[index] ?? 450 + index * 900;
      return window.setTimeout(() => {
        setRevealStage((prev) => Math.max(prev, targetStep));
      }, delay);
    });

    return () => {
      for (const id of timers) {
        window.clearTimeout(id);
      }
    };
  }, [podiumPlan.revealSequenceSteps, replayNonce, session.id]);

  const championRevealed = revealStage >= 3 && leaderboard.length > 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 text-ink shadow-sm sm:p-10">
        {/* Stage Spotlight Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-warning/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        />

        {/* Confetti Shower when 1st Place Champion Arrives */}
        {championRevealed && (
          <div
            aria-hidden="true"
            data-testid="podium-confetti"
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-80 overflow-hidden"
          >
            {CONFETTI_PIECES.map((piece, idx) => (
              <span
                key={idx}
                className={`${piece.alt ? 'quizclass-confetti-alt' : 'quizclass-confetti'} ${piece.delayClass} absolute top-0 ${piece.leftClass} ${piece.sizeClass} ${piece.colorClass}`}
              />
            ))}
          </div>
        )}

        {/* Header & Teacher Controls */}
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-warning-line bg-warning-soft px-3.5 py-1 text-xs font-black text-warning-ink">
              <Sparkles className="h-4 w-4 text-warning" />
              <span>
                {leaderboard.length === 0
                  ? 'انتهت المسابقة'
                  : championRevealed
                    ? 'احتفالية تتويج أبطال المسابقة!'
                    : 'جارٍ تقديم أبطال منصة التتويج...'}
              </span>
            </div>

            <h2 className="font-display text-2xl font-black text-ink sm:text-4xl">
              {session.quizTitle}
            </h2>

            <p className="tabular-nums text-xs font-bold text-ink-muted sm:text-sm">
              {session.questionCount} سؤالاً مسجلاً · {leaderboard.length} مشاركاً · رمز الجلسة:{' '}
              {session.pinCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {leaderboard.length > 0 && (
              <button
                type="button"
                onClick={() => setReplayNonce((n) => n + 1)}
                className="qc-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-extrabold whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>إعادة الاحتفال</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLaunchNewSession}
              className="qc-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-xs font-extrabold shadow-xs whitespace-nowrap sm:text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>تشغيل جلسة جديدة</span>
            </button>
            <button
              type="button"
              onClick={onBackToQuizzes}
              className="qc-btn-secondary inline-flex h-11 items-center justify-center rounded-2xl px-4 text-xs font-extrabold whitespace-nowrap"
            >
              العودة إلى المسابقات
            </button>
          </div>
        </div>

        {/* Empty Session State (0 Participants) */}
        {leaderboard.length === 0 ? (
          <div
            data-testid="podium-empty-state"
            className="relative z-10 mt-10 flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-subtle px-6 py-16 text-center"
          >
            <Users className="h-12 w-12 text-ink-muted" />
            <p className="font-display mt-3 text-lg font-extrabold text-ink">
              لم يشارك أي طالب في هذه الجلسة
            </p>
            <p className="mt-1 text-xs font-bold text-ink-muted">
              يمكنك تشغيل جلسة جديدة ودعوة الطلاب باستخدام رمز PIN جديد.
            </p>
          </div>
        ) : (
          <div className="relative z-10 mt-10 space-y-8">
            {/* Animated Stepped Podium Stage */}
            <div
              data-testid="podium-stage"
              data-reveal-stage={revealStage}
              className="rounded-3xl border border-line bg-surface-subtle px-4 pt-8 pb-6 sm:px-8 sm:pt-10"
            >
              <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 sm:flex-row sm:items-end sm:gap-5">
                {podiumPlan.slots.map((slot) => {
                  const { entry, displayRank } = slot;
                  const isRevealed = revealStage >= slot.revealAtStep;
                  const resolvedAvatarId =
                    entry.avatarId ?? participantAvatarMap.get(entry.participantId);
                  const entranceClass =
                    displayRank === 3
                      ? 'qc-enter-run-in'
                      : displayRank === 2
                        ? 'qc-enter-hop-in'
                        : 'qc-enter-hero-leap';

                  return (
                    <div
                      key={`${entry.participantId}-${replayNonce}`}
                      data-testid={`podium-slot-${displayRank}`}
                      data-revealed={isRevealed ? 'true' : 'false'}
                      className={`flex w-full max-w-[230px] flex-col items-center ${slot.visualOrderClass}`}
                    >
                      {/* Animated Character + Stable Grounded Nameplate */}
                      <div className="flex min-h-[210px] w-full flex-col items-center justify-end pb-3 sm:min-h-[235px]">
                        {isRevealed ? (
                          <div className={`flex w-full flex-col items-center ${entranceClass}`}>
                            {/* Rank Badge Pill above character */}
                            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-black text-ink shadow-xs">
                              {displayRank === 1 ? (
                                <Crown className="h-3.5 w-3.5 text-warning" />
                              ) : displayRank === 2 ? (
                                <Medal className="h-3.5 w-3.5 text-accent" />
                              ) : (
                                <Award className="h-3.5 w-3.5 text-[#B56D3B] dark:text-[#DF9F70]" />
                              )}
                              <span className="tabular-nums">المركز {entry.rankPosition}</span>
                            </div>

                            {/* Articulated Full-Body Cartoon Character */}
                            <div className="relative flex items-end justify-center py-1">
                              <AnimatedFullBodyAvatar
                                avatarId={resolvedAvatarId}
                                celebration={slot.celebrationStyle}
                                size={displayRank === 1 ? 'xl' : 'lg'}
                                showCrown={displayRank === 1}
                                animated={true}
                              />
                            </div>

                            {/* Crisp Unobstructed Student Name & Score Plate */}
                            <div
                              className={`mt-1 w-full rounded-2xl border px-3 py-2 text-center shadow-sm ${
                                displayRank === 1
                                  ? 'border-warning-line bg-warning-soft text-ink'
                                  : displayRank === 2
                                    ? 'border-selected-line bg-selected text-ink'
                                    : 'border-[#DF9F70] bg-[#FBF2EA] text-ink dark:border-[#8C5630] dark:bg-[#3A2E25]'
                              }`}
                            >
                              <h3 className="font-display truncate text-base font-black text-ink sm:text-lg">
                                {entry.displayName}
                              </h3>
                              <p
                                className={`tabular-nums font-display text-lg font-black sm:text-xl ${
                                  displayRank === 1
                                    ? 'text-warning-ink'
                                    : displayRank === 2
                                      ? 'text-accent'
                                      : 'text-[#8C4D22] dark:text-[#ECC29E]'
                                }`}
                              >
                                {entry.totalScore}{' '}
                                <span className="text-xs font-bold text-ink-muted">نقطة</span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div
                            aria-hidden="true"
                            className="flex flex-col items-center justify-center gap-2 pb-4 opacity-50"
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-muted">
                              <Trophy className="h-5 w-5" />
                            </div>
                            <span className="text-[11px] font-bold text-ink-muted">
                              في انتظار الإعلان...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Physical Stepped Pedestal */}
                      <div
                        className={`flex w-full flex-col items-center justify-between rounded-t-2xl border-x-2 border-t-4 bg-gradient-to-b px-3 py-3 shadow-md ${slot.pedestalHeightClass} ${slot.pedestalToneClass}`}
                      >
                        <span className="tabular-nums font-display text-2xl leading-none font-black sm:text-3xl">
                          {entry.rankPosition}
                        </span>
                        {isRevealed ? (
                          <div className="flex items-center justify-center gap-2.5 text-[11px] font-extrabold opacity-95">
                            <span className="tabular-nums">{entry.correctCount} صحيح</span>
                            <span>·</span>
                            <span className="tabular-nums">{entry.wrongCount} خطأ</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-extrabold opacity-80">
                            المركز {entry.rankPosition}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ranked List for Remaining Participants (Rank 4+) */}
            {podiumPlan.remainingParticipants.length > 0 && (
              <div
                data-testid="podium-remaining-list"
                className="qc-card overflow-hidden text-ink"
              >
                <div className="flex items-center justify-between border-b border-line p-4">
                  <h3 className="font-display text-sm font-extrabold text-ink">
                    بقية المشاركين ({podiumPlan.remainingParticipants.length})
                  </h3>
                  <span className="text-xs font-bold text-ink-muted">
                    إجمالي المشاركين: {leaderboard.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm">
                    <thead className="border-b border-line bg-surface-subtle text-xs font-extrabold text-ink-muted">
                      <tr>
                        <th className="px-4 py-3.5 text-start">الترتيب</th>
                        <th className="px-4 py-3.5 text-start">اسم الطالب والشخصية</th>
                        <th className="px-4 py-3.5 text-center">إجمالي النقاط</th>
                        <th className="px-4 py-3.5 text-center">الإجابات الصحيحة</th>
                        <th className="px-4 py-3.5 text-center">الإجابات الخاطئة</th>
                        <th className="px-4 py-3.5 text-center">غير المجابة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-surface">
                      {podiumPlan.remainingParticipants.map((entry) => {
                        const resolvedAvatarId =
                          entry.avatarId ?? participantAvatarMap.get(entry.participantId);
                        return (
                          <tr
                            key={entry.participantId}
                            className="transition-colors hover:bg-row-hover"
                          >
                            <td className="px-4 py-3.5">
                              <span className="tabular-nums inline-flex h-8 w-8 items-center justify-center rounded-lg bg-selected font-display text-xs font-black text-accent">
                                {entry.rankPosition}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle">
                                  <AnimatedFullBodyAvatar
                                    avatarId={resolvedAvatarId}
                                    size="sm"
                                    animated={false}
                                  />
                                </div>
                                <span className="font-display font-bold text-ink">
                                  {entry.displayName}
                                </span>
                              </div>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center font-display font-black text-accent">
                              {entry.totalScore}
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-success-ink">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{entry.correctCount}</span>
                              </span>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-danger-ink">
                                <XCircle className="h-3.5 w-3.5" />
                                <span>{entry.wrongCount}</span>
                              </span>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-ink-muted">
                                <HelpCircle className="h-3.5 w-3.5" />
                                <span>{entry.unansweredCount}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

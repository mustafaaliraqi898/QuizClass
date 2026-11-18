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
  { leftClass: 'left-[5%]', colorClass: 'bg-amber-400', sizeClass: 'h-3 w-2 rounded-sm', delayClass: '', alt: false },
  { leftClass: 'left-[11%]', colorClass: 'bg-indigo-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[17%]', colorClass: 'bg-emerald-400', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-300', alt: false },
  { leftClass: 'left-[24%]', colorClass: 'bg-pink-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: true },
  { leftClass: 'left-[31%]', colorClass: 'bg-sky-400', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: false },
  { leftClass: 'left-[38%]', colorClass: 'bg-amber-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: true },
  { leftClass: 'left-[45%]', colorClass: 'bg-violet-500', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-100', alt: false },
  { leftClass: 'left-[53%]', colorClass: 'bg-rose-500', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-300', alt: true },
  { leftClass: 'left-[60%]', colorClass: 'bg-emerald-500', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-500', alt: false },
  { leftClass: 'left-[67%]', colorClass: 'bg-yellow-300', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-150', alt: true },
  { leftClass: 'left-[75%]', colorClass: 'bg-indigo-400', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-700', alt: false },
  { leftClass: 'left-[82%]', colorClass: 'bg-pink-400', sizeClass: 'h-3 w-2 rounded-sm', delayClass: 'delay-200', alt: true },
  { leftClass: 'left-[89%]', colorClass: 'bg-teal-400', sizeClass: 'h-2.5 w-2.5 rounded-full', delayClass: 'delay-500', alt: false },
  { leftClass: 'left-[95%]', colorClass: 'bg-amber-400', sizeClass: 'h-3 w-1.5 rounded-sm', delayClass: 'delay-1000', alt: true },
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
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-6 sm:p-10 text-white shadow-2xl dark:border-indigo-900/70">
        {/* Stage Spotlight Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl"
        />

        {/* Confetti Shower when 1st Place Champion Arrives */}
        {championRevealed && (
          <div
            aria-hidden="true"
            data-testid="podium-confetti"
            className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden z-20"
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
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3.5 py-1 text-xs font-black text-amber-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>
                {leaderboard.length === 0
                  ? 'انتهت المسابقة'
                  : championRevealed
                    ? 'احتفالية تتويج أبطال المسابقة!'
                    : 'جارٍ تقديم أبطال منصة التتويج...'}
              </span>
            </div>

            <h2 className="font-display text-2xl font-black text-white sm:text-4xl">
              {session.quizTitle}
            </h2>

            <p className="tabular-nums text-xs font-bold text-indigo-200 sm:text-sm">
              {session.questionCount} سؤالاً مسجلاً · {leaderboard.length} مشاركاً · رمز الجلسة:{' '}
              {session.pinCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {leaderboard.length > 0 && (
              <button
                type="button"
                onClick={() => setReplayNonce((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-extrabold text-white backdrop-blur-sm transition-colors hover:bg-white/20 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>إعادة الاحتفال</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLaunchNewSession}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 text-xs sm:text-sm font-extrabold text-white transition-all hover:bg-indigo-400 shadow-lg shadow-indigo-950/50 whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4" />
              <span>تشغيل جلسة جديدة</span>
            </button>
            <button
              type="button"
              onClick={onBackToQuizzes}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-600 bg-slate-800/80 px-4 text-xs font-extrabold text-slate-100 transition-colors hover:bg-slate-700 whitespace-nowrap"
            >
              العودة إلى المسابقات
            </button>
          </div>
        </div>

        {/* Empty Session State (0 Participants) */}
        {leaderboard.length === 0 ? (
          <div
            data-testid="podium-empty-state"
            className="relative z-10 mt-10 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur-sm"
          >
            <Users className="h-12 w-12 text-indigo-300/60" />
            <p className="font-display mt-3 text-lg font-extrabold text-white">
              لم يشارك أي طالب في هذه الجلسة
            </p>
            <p className="mt-1 text-xs font-bold text-indigo-200/80">
              يمكنك تشغيل جلسة جديدة ودعوة الطلاب باستخدام رمز PIN جديد.
            </p>
          </div>
        ) : (
          <div className="relative z-10 mt-10 space-y-8">
            {/* Animated Stepped Podium Stage */}
            <div
              data-testid="podium-stage"
              data-reveal-stage={revealStage}
              className="rounded-3xl border border-white/10 bg-slate-950/45 px-4 pt-8 pb-6 sm:px-8 sm:pt-10 backdrop-blur-sm"
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
                      <div className="flex min-h-[210px] sm:min-h-[235px] w-full flex-col items-center justify-end pb-3">
                        {isRevealed ? (
                          <div className={`flex w-full flex-col items-center ${entranceClass}`}>
                            {/* Rank Badge Pill above character */}
                            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black text-white shadow-sm backdrop-blur-sm">
                              {displayRank === 1 ? (
                                <Crown className="h-3.5 w-3.5 text-amber-300" />
                              ) : displayRank === 2 ? (
                                <Medal className="h-3.5 w-3.5 text-slate-200" />
                              ) : (
                                <Award className="h-3.5 w-3.5 text-orange-300" />
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
                              className={`mt-1 w-full rounded-2xl border px-3 py-2 text-center shadow-lg ${
                                displayRank === 1
                                  ? 'border-amber-300/70 bg-amber-400/20 text-white'
                                  : displayRank === 2
                                    ? 'border-slate-300/50 bg-slate-200/15 text-white'
                                    : 'border-orange-300/50 bg-orange-400/15 text-white'
                              }`}
                            >
                              <h3 className="font-display truncate text-base sm:text-lg font-black text-white">
                                {entry.displayName}
                              </h3>
                              <p className="tabular-nums font-display text-lg sm:text-xl font-black text-amber-200">
                                {entry.totalScore}{' '}
                                <span className="text-xs font-bold text-indigo-100">نقطة</span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div
                            aria-hidden="true"
                            className="flex flex-col items-center justify-center gap-2 pb-4 opacity-40"
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-indigo-300/60 text-indigo-200">
                              <Trophy className="h-5 w-5" />
                            </div>
                            <span className="text-[11px] font-bold text-indigo-200">
                              في انتظار الإعلان...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Physical Stepped Pedestal */}
                      <div
                        className={`flex w-full flex-col items-center justify-between rounded-t-2xl border-t-4 border-x-2 bg-gradient-to-b px-3 py-3 shadow-xl ${slot.pedestalHeightClass} ${slot.pedestalToneClass}`}
                      >
                        <span className="tabular-nums font-display text-2xl sm:text-3xl font-black leading-none">
                          {entry.rankPosition}
                        </span>
                        {isRevealed ? (
                          <div className="flex items-center justify-center gap-2.5 text-[11px] font-extrabold opacity-95">
                            <span className="tabular-nums">{entry.correctCount} صحيح</span>
                            <span>·</span>
                            <span className="tabular-nums">{entry.wrongCount} خطأ</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-extrabold opacity-75">
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
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                    بقية المشاركين ({podiumPlan.remainingParticipants.length})
                  </h3>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    إجمالي المشاركين: {leaderboard.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3.5 text-start">الترتيب</th>
                        <th className="px-4 py-3.5 text-start">اسم الطالب والشخصية</th>
                        <th className="px-4 py-3.5 text-center">إجمالي النقاط</th>
                        <th className="px-4 py-3.5 text-center">الإجابات الصحيحة</th>
                        <th className="px-4 py-3.5 text-center">الإجابات الخاطئة</th>
                        <th className="px-4 py-3.5 text-center">غير المجابة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {podiumPlan.remainingParticipants.map((entry) => {
                        const resolvedAvatarId =
                          entry.avatarId ?? participantAvatarMap.get(entry.participantId);
                        return (
                          <tr
                            key={entry.participantId}
                            className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-3.5">
                              <span className="tabular-nums inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-display text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                {entry.rankPosition}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                                  <AnimatedFullBodyAvatar
                                    avatarId={resolvedAvatarId}
                                    size="sm"
                                    animated={false}
                                  />
                                </div>
                                <span className="font-display font-bold text-slate-900 dark:text-white">
                                  {entry.displayName}
                                </span>
                              </div>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center font-display font-black text-indigo-700 dark:text-indigo-300">
                              {entry.totalScore}
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{entry.correctCount}</span>
                              </span>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-red-700 dark:text-red-300">
                                <XCircle className="h-3.5 w-3.5" />
                                <span>{entry.wrongCount}</span>
                              </span>
                            </td>
                            <td className="tabular-nums px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
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

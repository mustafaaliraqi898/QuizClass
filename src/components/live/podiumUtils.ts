import type { AvatarCelebrationStyle } from '../../data/studentAvatars';
import type { FinalLeaderboardEntry } from '../../types/liveSession';

export type PodiumEntranceMode = 'run-in' | 'hop-in' | 'hero-leap';

export interface PodiumSlot {
  entry: FinalLeaderboardEntry;
  displayRank: 1 | 2 | 3;
  visualOrderClass: string;
  pedestalHeightClass: string;
  pedestalToneClass: string;
  entranceMode: PodiumEntranceMode;
  celebrationStyle: AvatarCelebrationStyle;
  revealAtStep: number;
}

export interface PodiumPlan {
  slots: PodiumSlot[];
  remainingParticipants: FinalLeaderboardEntry[];
  revealSequenceSteps: number[];
}

const RANK_CELEBRATION_FALLBACK: Record<1 | 2 | 3, AvatarCelebrationStyle> = {
  1: 'victory',
  2: 'clap',
  3: 'wave',
};

/**
 * يبني خطة عرض منصة التتويج اعتماداً على الترتيب الفعلي المعتمد من الخادم دون أي إعادة فرز أو إنشاء مراكز وهمية.
 * يدعم 0، 1، 2، 3، أو أكثر من المشاركين مع الحفاظ الكامل على قواعد كسر التعادل والنتائج الحقيقية.
 */
export function buildPodiumPlan(leaderboard: FinalLeaderboardEntry[]): PodiumPlan {
  if (!leaderboard || leaderboard.length === 0) {
    return {
      slots: [],
      remainingParticipants: [],
      revealSequenceSteps: [],
    };
  }

  const top = leaderboard.slice(0, 3);
  const remainingParticipants = leaderboard.slice(3);

  const first = top[0];
  const second = top[1];
  const third = top[2];

  const slots: PodiumSlot[] = [];

  if (second) {
    slots.push({
      entry: second,
      displayRank: 2,
      visualOrderClass: 'order-2 sm:order-1',
      pedestalHeightClass: 'h-24 sm:h-28',
      pedestalToneClass:
        'from-slate-300 via-slate-200 to-slate-400 border-slate-300 text-slate-900 dark:from-slate-700 dark:via-slate-600 dark:to-slate-800 dark:border-slate-500 dark:text-slate-100',
      entranceMode: 'hop-in',
      celebrationStyle: RANK_CELEBRATION_FALLBACK[2],
      revealAtStep: 2,
    });
  }

  if (first) {
    slots.push({
      entry: first,
      displayRank: 1,
      visualOrderClass: 'order-1 sm:order-2',
      pedestalHeightClass: 'h-32 sm:h-40',
      pedestalToneClass:
        'from-amber-400 via-yellow-300 to-amber-500 border-amber-300 text-amber-950 dark:from-amber-500 dark:via-yellow-400 dark:to-amber-600 dark:border-amber-400 dark:text-slate-950',
      entranceMode: 'hero-leap',
      celebrationStyle: RANK_CELEBRATION_FALLBACK[1],
      revealAtStep: 3,
    });
  }

  if (third) {
    slots.push({
      entry: third,
      displayRank: 3,
      visualOrderClass: 'order-3',
      pedestalHeightClass: 'h-16 sm:h-20',
      pedestalToneClass:
        'from-orange-400 via-amber-500 to-orange-600 border-orange-300 text-white dark:from-orange-700 dark:via-amber-700 dark:to-orange-900 dark:border-orange-500 dark:text-orange-50',
      entranceMode: 'run-in',
      celebrationStyle: RANK_CELEBRATION_FALLBACK[3],
      revealAtStep: 1,
    });
  }

  // ترتيب الظهور الفعلي حسب عدد المشاركين: الثالث (1) ثم الثاني (2) ثم الأول (3)
  const revealSequenceSteps: number[] = [];
  if (third) revealSequenceSteps.push(1);
  if (second) revealSequenceSteps.push(2);
  if (first) revealSequenceSteps.push(3);

  return {
    slots,
    remainingParticipants,
    revealSequenceSteps,
  };
}

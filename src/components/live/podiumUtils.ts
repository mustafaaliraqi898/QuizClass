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
        'from-[#E3E7EE] via-[#F2F4F8] to-[#C8D1DF] border-[#AFC5E3] text-[#292929] dark:from-[#4C5664] dark:via-[#5E6A7C] dark:to-[#3E4652] dark:border-[#8EACD0] dark:text-[#F0EDE9]',
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
        'from-[#F2C96B] via-[#FCE192] to-[#D4891C] border-[#E5B85C] text-[#292929] dark:from-[#C78524] dark:via-[#E0A43E] dark:to-[#9C6314] dark:border-[#E5B85C] dark:text-[#201F22]',
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
        'from-[#D99A6C] via-[#E8B389] to-[#B56D3B] border-[#DF9F70] text-[#292929] dark:from-[#8C5630] dark:via-[#A4673D] dark:to-[#6E4122] dark:border-[#BA7D52] dark:text-[#F0EDE9]',
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

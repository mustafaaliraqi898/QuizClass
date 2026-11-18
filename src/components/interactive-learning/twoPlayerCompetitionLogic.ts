import type { InteractiveLearningQuestion } from '../../types/interactiveLearning';
import {
  hasActiveSelection,
  isSelectionCorrectForQuestion,
  type SmartboardSelection,
} from './interactiveLearningLogic';

export type InteractiveLaunchMode = 'standard' | 'two_player';

export interface TwoPlayerConfig {
  p1Name: string;
  p1AvatarId: string;
  p2Name: string;
  p2AvatarId: string;
  roundDurationSeconds: number;
}

export type TwoPlayerRoundPhase = 'answering' | 'time_up' | 'revealed';
export type TwoPlayerQuestionOutcome = 'correct' | 'wrong' | 'unanswered';

export interface TwoPlayerRoundState {
  phase: TwoPlayerRoundPhase;
  p1Selection: SmartboardSelection;
  p2Selection: SmartboardSelection;
  p1Outcome: TwoPlayerQuestionOutcome | null;
  p2Outcome: TwoPlayerQuestionOutcome | null;
  p1PointsEarned: number;
  p2PointsEarned: number;
  p1Score: number;
  p2Score: number;
  p1CorrectCount: number;
  p2CorrectCount: number;
  p1WrongCount: number;
  p2WrongCount: number;
  p1UnansweredCount: number;
  p2UnansweredCount: number;
}

export interface TwoPlayerSessionState {
  currentIndex: number;
  roundState: TwoPlayerRoundState;
  completed: boolean;
  timeLeft: number;
  isPaused: boolean;
  roundDurationSeconds: number;
}

export const POINTS_PER_CORRECT_ANSWER = 10;
export const DEFAULT_TWO_PLAYER_DURATION_SECONDS = 20;

export const DEFAULT_TWO_PLAYER_CONFIG: TwoPlayerConfig = {
  p1Name: 'الطالب الأول',
  p1AvatarId: 'avatar_robot',
  p2Name: 'الطالب الثاني',
  p2AvatarId: 'avatar_cat',
  roundDurationSeconds: DEFAULT_TWO_PLAYER_DURATION_SECONDS,
};

function createEmptySelection(): SmartboardSelection {
  return {
    selectedOptionId: null,
    selectedBoolean: null,
  };
}

export function normalizePlayerName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function createInitialTwoPlayerSession(
  roundDurationSeconds = DEFAULT_TWO_PLAYER_DURATION_SECONDS
): TwoPlayerSessionState {
  const safeDuration = Math.max(5, Math.round(roundDurationSeconds));
  return {
    currentIndex: 0,
    roundState: {
      phase: 'answering',
      p1Selection: createEmptySelection(),
      p2Selection: createEmptySelection(),
      p1Outcome: null,
      p2Outcome: null,
      p1PointsEarned: 0,
      p2PointsEarned: 0,
      p1Score: 0,
      p2Score: 0,
      p1CorrectCount: 0,
      p2CorrectCount: 0,
      p1WrongCount: 0,
      p2WrongCount: 0,
      p1UnansweredCount: 0,
      p2UnansweredCount: 0,
    },
    completed: false,
    timeLeft: safeDuration,
    isPaused: false,
    roundDurationSeconds: safeDuration,
  };
}

export function selectPlayerChoiceInRound(
  state: TwoPlayerRoundState,
  player: 1 | 2,
  choice: { selectedOptionId?: string | null; selectedBoolean?: boolean | null }
): TwoPlayerRoundState {
  // يسمح بالاختيار أو تعديله فقط أثناء سريان المؤقت وقبل انتهاء الوقت أو كشف النتيجة
  if (state.phase !== 'answering') {
    return state;
  }

  const nextSelection: SmartboardSelection = {
    selectedOptionId:
      typeof choice.selectedOptionId === 'string' ? choice.selectedOptionId : null,
    selectedBoolean:
      typeof choice.selectedBoolean === 'boolean' ? choice.selectedBoolean : null,
  };

  if (!hasActiveSelection(nextSelection)) {
    return state;
  }

  if (player === 1) {
    return {
      ...state,
      p1Selection: nextSelection,
    };
  }

  return {
    ...state,
    p2Selection: nextSelection,
  };
}

export function toggleTwoPlayerPause(session: TwoPlayerSessionState): TwoPlayerSessionState {
  if (session.completed || session.roundState.phase !== 'answering') {
    return session;
  }
  return {
    ...session,
    isPaused: !session.isPaused,
  };
}

export function tickTwoPlayerTimer(session: TwoPlayerSessionState): TwoPlayerSessionState {
  if (
    session.completed ||
    session.isPaused ||
    session.roundState.phase !== 'answering'
  ) {
    return session;
  }

  if (session.timeLeft <= 1) {
    // عند انتهاء المؤقت يتم إقفال الاختيارات والانتقال إلى حالة time_up دون كشف الإجابة الصحيحة
    return {
      ...session,
      timeLeft: 0,
      isPaused: false,
      roundState: {
        ...session.roundState,
        phase: 'time_up',
      },
    };
  }

  return {
    ...session,
    timeLeft: session.timeLeft - 1,
  };
}

export function areBothPlayersAnswered(state: TwoPlayerRoundState): boolean {
  return hasActiveSelection(state.p1Selection) && hasActiveSelection(state.p2Selection);
}

export function canRevealTwoPlayerRound(state: TwoPlayerRoundState): boolean {
  if (state.phase === 'revealed') {
    return false;
  }
  if (state.phase === 'time_up') {
    return true;
  }
  if (state.phase === 'answering') {
    // يمكن إنهاء السؤال وكشف الإجابة مبكراً إذا اختار كلا الطالبين إجابة
    return areBothPlayersAnswered(state);
  }
  return false;
}

export function revealTwoPlayerRound(
  state: TwoPlayerRoundState,
  question: InteractiveLearningQuestion
): TwoPlayerRoundState {
  // لا يتم الكشف إذا كان مكشوفاً بالفعل، أو إذا كان الوقت ما زال سارياً ولم يجب الطالبان بعد
  if (state.phase === 'revealed' || !canRevealTwoPlayerRound(state)) {
    return state;
  }

  const p1Answered = hasActiveSelection(state.p1Selection);
  const p2Answered = hasActiveSelection(state.p2Selection);

  const p1Outcome: TwoPlayerQuestionOutcome = !p1Answered
    ? 'unanswered'
    : isSelectionCorrectForQuestion(question, state.p1Selection)
      ? 'correct'
      : 'wrong';

  const p2Outcome: TwoPlayerQuestionOutcome = !p2Answered
    ? 'unanswered'
    : isSelectionCorrectForQuestion(question, state.p2Selection)
      ? 'correct'
      : 'wrong';

  const p1PointsEarned = p1Outcome === 'correct' ? POINTS_PER_CORRECT_ANSWER : 0;
  const p2PointsEarned = p2Outcome === 'correct' ? POINTS_PER_CORRECT_ANSWER : 0;

  return {
    ...state,
    phase: 'revealed',
    p1Outcome,
    p2Outcome,
    p1PointsEarned,
    p2PointsEarned,
    p1Score: state.p1Score + p1PointsEarned,
    p2Score: state.p2Score + p2PointsEarned,
    p1CorrectCount: state.p1CorrectCount + (p1Outcome === 'correct' ? 1 : 0),
    p2CorrectCount: state.p2CorrectCount + (p2Outcome === 'correct' ? 1 : 0),
    p1WrongCount: state.p1WrongCount + (p1Outcome === 'wrong' ? 1 : 0),
    p2WrongCount: state.p2WrongCount + (p2Outcome === 'wrong' ? 1 : 0),
    p1UnansweredCount: state.p1UnansweredCount + (p1Outcome === 'unanswered' ? 1 : 0),
    p2UnansweredCount: state.p2UnansweredCount + (p2Outcome === 'unanswered' ? 1 : 0),
  };
}

export function navigateTwoPlayerSession(
  session: TwoPlayerSessionState,
  targetIndex: number,
  totalQuestions: number
): TwoPlayerSessionState {
  if (totalQuestions <= 0) {
    return createInitialTwoPlayerSession(session.roundDurationSeconds);
  }

  if (targetIndex >= totalQuestions) {
    return {
      ...session,
      completed: true,
      isPaused: false,
    };
  }

  const clamped = Math.max(0, Math.min(targetIndex, totalQuestions - 1));
  return {
    currentIndex: clamped,
    roundState: {
      ...session.roundState,
      phase: 'answering',
      p1Selection: createEmptySelection(),
      p2Selection: createEmptySelection(),
      p1Outcome: null,
      p2Outcome: null,
      p1PointsEarned: 0,
      p2PointsEarned: 0,
    },
    completed: false,
    timeLeft: session.roundDurationSeconds,
    isPaused: false,
    roundDurationSeconds: session.roundDurationSeconds,
  };
}

export interface TwoPlayerWinnerSummary {
  result: 'p1' | 'p2' | 'tie';
  winnerName: string | null;
}

export function determineTwoPlayerWinner(
  roundState: TwoPlayerRoundState,
  p1Name: string,
  p2Name: string
): TwoPlayerWinnerSummary {
  if (roundState.p1Score > roundState.p2Score) {
    return { result: 'p1', winnerName: p1Name };
  }
  if (roundState.p2Score > roundState.p1Score) {
    return { result: 'p2', winnerName: p2Name };
  }
  return { result: 'tie', winnerName: null };
}

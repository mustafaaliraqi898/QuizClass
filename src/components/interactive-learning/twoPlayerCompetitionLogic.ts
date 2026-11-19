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

export interface TwoPlayerQuestionOptionOrder {
  p1OptionIds: string[];
  p2OptionIds: string[];
}

export interface TwoPlayerSessionState {
  currentIndex: number;
  roundState: TwoPlayerRoundState;
  completed: boolean;
  timeLeft: number;
  isPaused: boolean;
  roundDurationSeconds: number;
  optionOrdersByQuestion: Record<string, TwoPlayerQuestionOptionOrder>;
}

export const POINTS_PER_CORRECT_ANSWER = 10;
export const DEFAULT_TWO_PLAYER_DURATION_SECONDS = 20;
const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

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

function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function hasSameOptionIds(
  optionIds: readonly string[],
  options: InteractiveLearningQuestion['options']
): boolean {
  if (optionIds.length !== options.length) return false;
  const set = new Set(options.map((o) => o.id));
  return optionIds.every((id) => set.has(id));
}

export function createQuestionOptionOrder(
  question: InteractiveLearningQuestion,
  rng: () => number = Math.random
): TwoPlayerQuestionOptionOrder {
  if (question.type !== 'multiple_choice' || question.options.length === 0) {
    return { p1OptionIds: [], p2OptionIds: [] };
  }

  const originalIds = question.options.map((opt) => opt.id);
  if (originalIds.length === 1) {
    return {
      p1OptionIds: [...originalIds],
      p2OptionIds: [...originalIds],
    };
  }

  const p1OptionIds = shuffleArray(originalIds, rng);
  let p2OptionIds = shuffleArray(originalIds, rng);

  // ضمان اختلاف ترتيب الطالب الثاني عن الطالب الأول عندما يكون هناك خياران أو أكثر
  for (let attempt = 0; attempt < 6 && arraysEqual(p1OptionIds, p2OptionIds); attempt++) {
    p2OptionIds = shuffleArray(originalIds, rng);
  }

  if (arraysEqual(p1OptionIds, p2OptionIds)) {
    p2OptionIds = [...p2OptionIds];
    const first = p2OptionIds[0];
    p2OptionIds[0] = p2OptionIds[1];
    p2OptionIds[1] = first;
  }

  return { p1OptionIds, p2OptionIds };
}

export function ensureQuestionOptionOrderInMap(
  existingMap: Record<string, TwoPlayerQuestionOptionOrder> | undefined,
  question: InteractiveLearningQuestion | null | undefined,
  rng: () => number = Math.random
): Record<string, TwoPlayerQuestionOptionOrder> {
  const safeMap = existingMap ?? {};
  if (!question || question.type !== 'multiple_choice' || question.options.length === 0) {
    return safeMap;
  }

  const existing = safeMap[question.id];
  if (
    existing &&
    hasSameOptionIds(existing.p1OptionIds, question.options) &&
    hasSameOptionIds(existing.p2OptionIds, question.options)
  ) {
    // الحفاظ على الترتيب المثبت مسبقاً لنفس السؤال دون إعادة خلط
    return safeMap;
  }

  return {
    ...safeMap,
    [question.id]: createQuestionOptionOrder(question, rng),
  };
}

export function getOrderedOptionsForPlayer(
  question: InteractiveLearningQuestion,
  optionIds?: readonly string[]
): InteractiveLearningQuestion['options'] {
  if (question.type !== 'multiple_choice' || !optionIds || optionIds.length === 0) {
    return question.options;
  }

  const optionById = new Map(question.options.map((opt) => [opt.id, opt] as const));
  const ordered: InteractiveLearningQuestion['options'] = [];
  const usedIds = new Set<string>();

  for (const id of optionIds) {
    const found = optionById.get(id);
    if (found && !usedIds.has(id)) {
      ordered.push(found);
      usedIds.add(id);
    }
  }

  for (const opt of question.options) {
    if (!usedIds.has(opt.id)) {
      ordered.push(opt);
    }
  }

  return ordered;
}

export function extractTwoPlayerCorrectAnswerText(
  question: InteractiveLearningQuestion,
  orderedOptions?: InteractiveLearningQuestion['options']
): string | null {
  if (question.type === 'true_false') {
    if (question.correctBoolean === true) return 'صح';
    if (question.correctBoolean === false) return 'خطأ';
    return null;
  }

  if (question.type === 'multiple_choice') {
    const list = orderedOptions && orderedOptions.length > 0 ? orderedOptions : question.options;
    const idx = list.findIndex((opt) => opt.isCorrect);
    if (idx === -1) return null;
    const opt = list[idx];
    const cleanText = opt.optionText?.trim();
    if (cleanText) {
      return `${OPTION_LETTERS[idx] ?? idx + 1}. ${cleanText}`;
    }
    return `الخيار ${OPTION_LETTERS[idx] ?? idx + 1}`;
  }

  return null;
}

export function normalizePlayerName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function createInitialTwoPlayerSession(
  roundDurationSeconds = DEFAULT_TWO_PLAYER_DURATION_SECONDS,
  questions?: InteractiveLearningQuestion[],
  rng: () => number = Math.random
): TwoPlayerSessionState {
  const safeDuration = Math.max(5, Math.round(roundDurationSeconds));
  const optionOrdersByQuestion = ensureQuestionOptionOrderInMap({}, questions?.[0], rng);

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
    optionOrdersByQuestion,
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

export function getPlayerOrderedOptionsForSession(
  session: TwoPlayerSessionState,
  question: InteractiveLearningQuestion,
  player: 1 | 2
): InteractiveLearningQuestion['options'] {
  const order = session.optionOrdersByQuestion?.[question.id];
  if (!order) {
    return question.options;
  }
  return getOrderedOptionsForPlayer(
    question,
    player === 1 ? order.p1OptionIds : order.p2OptionIds
  );
}

export function navigateTwoPlayerSession(
  session: TwoPlayerSessionState,
  targetIndex: number,
  totalQuestions: number,
  questions?: InteractiveLearningQuestion[],
  rng: () => number = Math.random
): TwoPlayerSessionState {
  if (totalQuestions <= 0) {
    return createInitialTwoPlayerSession(session.roundDurationSeconds, questions, rng);
  }

  if (targetIndex >= totalQuestions) {
    return {
      ...session,
      completed: true,
      isPaused: false,
    };
  }

  const clamped = Math.max(0, Math.min(targetIndex, totalQuestions - 1));
  const nextOptionOrdersByQuestion = ensureQuestionOptionOrderInMap(
    session.optionOrdersByQuestion,
    questions?.[clamped],
    rng
  );

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
    optionOrdersByQuestion: nextOptionOrdersByQuestion,
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

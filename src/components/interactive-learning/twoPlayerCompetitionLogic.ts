import type { InteractiveLearningQuestion } from '../../types/interactiveLearning';
import { isSelectionCorrectForQuestion, type SmartboardSelection } from './interactiveLearningLogic';

export interface TwoPlayerRoundState {
  p1Selection: SmartboardSelection;
  p2Selection: SmartboardSelection;
  p1Score: number;
  p2Score: number;
  p1CorrectCount: number;
  p2CorrectCount: number;
  p1WrongCount: number;
  p2WrongCount: number;
  status: 'playing' | 'revealed';
}

export interface TwoPlayerSessionState {
  currentIndex: number;
  roundState: TwoPlayerRoundState;
  completed: boolean;
  timeLeft: number;
  isPaused: boolean;
}

export function createInitialTwoPlayerSession(defaultTimeSeconds = 25): TwoPlayerSessionState {
  return {
    currentIndex: 0,
    roundState: {
      p1Selection: { selectedOptionId: null, selectedBoolean: null },
      p2Selection: { selectedOptionId: null, selectedBoolean: null },
      p1Score: 0,
      p2Score: 0,
      p1CorrectCount: 0,
      p2CorrectCount: 0,
      p1WrongCount: 0,
      p2WrongCount: 0,
      status: 'playing',
    },
    completed: false,
    timeLeft: defaultTimeSeconds,
    isPaused: false,
  };
}

export function selectPlayerChoiceInRound(
  state: TwoPlayerRoundState,
  player: 1 | 2,
  choice: { selectedOptionId?: string | null; selectedBoolean?: boolean | null }
): TwoPlayerRoundState {
  if (state.status === 'revealed') {
    return state;
  }

  const nextSelection: SmartboardSelection = {
    selectedOptionId:
      typeof choice.selectedOptionId === 'string' ? choice.selectedOptionId : null,
    selectedBoolean:
      typeof choice.selectedBoolean === 'boolean' ? choice.selectedBoolean : null,
  };

  if (player === 1) {
    return {
      ...state,
      p1Selection: nextSelection,
    };
  } else {
    return {
      ...state,
      p2Selection: nextSelection,
    };
  }
}

export function revealTwoPlayerRound(
  state: TwoPlayerRoundState,
  question: InteractiveLearningQuestion
): TwoPlayerRoundState {
  if (state.status === 'revealed') {
    return state;
  }

  const p1Correct = isSelectionCorrectForQuestion(question, state.p1Selection);
  const p2Correct = isSelectionCorrectForQuestion(question, state.p2Selection);

  let p1Points = 0;
  let p2Points = 0;
  let p1CorrInc = 0;
  let p1WrongInc = 0;
  let p2CorrInc = 0;
  let p2WrongInc = 0;

  if (state.p1Selection.selectedOptionId !== null || state.p1Selection.selectedBoolean !== null) {
    if (p1Correct) {
      p1Points = 10;
      p1CorrInc = 1;
    } else {
      p1WrongInc = 1;
    }
  }

  if (state.p2Selection.selectedOptionId !== null || state.p2Selection.selectedBoolean !== null) {
    if (p2Correct) {
      p2Points = 10;
      p2CorrInc = 1;
    } else {
      p2WrongInc = 1;
    }
  }

  return {
    ...state,
    status: 'revealed',
    p1Score: state.p1Score + p1Points,
    p2Score: state.p2Score + p2Points,
    p1CorrectCount: state.p1CorrectCount + p1CorrInc,
    p2CorrectCount: state.p2CorrectCount + p2CorrInc,
    p1WrongCount: state.p1WrongCount + p1WrongInc,
    p2WrongCount: state.p2WrongCount + p2WrongInc,
  };
}

export function navigateTwoPlayerSession(
  session: TwoPlayerSessionState,
  targetIndex: number,
  totalQuestions: number,
  defaultTimeSeconds = 25
): TwoPlayerSessionState {
  if (targetIndex >= totalQuestions) {
    return {
      ...session,
      completed: true,
    };
  }

  const clamped = Math.max(0, Math.min(targetIndex, totalQuestions - 1));
  return {
    currentIndex: clamped,
    roundState: {
      p1Selection: { selectedOptionId: null, selectedBoolean: null },
      p2Selection: { selectedOptionId: null, selectedBoolean: null },
      p1Score: session.roundState.p1Score,
      p2Score: session.roundState.p2Score,
      p1CorrectCount: session.roundState.p1CorrectCount,
      p2CorrectCount: session.roundState.p2CorrectCount,
      p1WrongCount: session.roundState.p1WrongCount,
      p2WrongCount: session.roundState.p2WrongCount,
      status: 'playing',
    },
    completed: false,
    timeLeft: defaultTimeSeconds,
    isPaused: false,
  };
}

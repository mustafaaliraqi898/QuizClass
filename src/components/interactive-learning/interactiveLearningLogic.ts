import type { InteractiveLearningQuestion } from '../../types/interactiveLearning';

export type SmartboardAnswerStatus =
  | 'idle'
  | 'selected'
  | 'checked_correct'
  | 'checked_wrong'
  | 'revealed';

export interface SmartboardSelection {
  selectedOptionId: string | null;
  selectedBoolean: boolean | null;
}

export interface SmartboardQuestionState {
  currentIndex: number;
  selection: SmartboardSelection;
  status: SmartboardAnswerStatus;
  completedSession: boolean;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export function createInitialSmartboardState(): SmartboardQuestionState {
  return {
    currentIndex: 0,
    selection: {
      selectedOptionId: null,
      selectedBoolean: null,
    },
    status: 'idle',
    completedSession: false,
  };
}

export function hasActiveSelection(selection: SmartboardSelection): boolean {
  return selection.selectedOptionId !== null || selection.selectedBoolean !== null;
}

export function selectSmartboardChoice(
  state: SmartboardQuestionState,
  choice: { selectedOptionId?: string | null; selectedBoolean?: boolean | null }
): SmartboardQuestionState {
  // يمكن تغيير الاختيار قبل التحقق من الإجابة أو كشفها، ولا يتغير بعد التقييم إلا بإعادة المحاولة
  if (
    state.status === 'checked_correct' ||
    state.status === 'checked_wrong' ||
    state.status === 'revealed'
  ) {
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

  return {
    ...state,
    selection: nextSelection,
    status: 'selected',
  };
}

export function isSelectionCorrectForQuestion(
  question: InteractiveLearningQuestion,
  selection: SmartboardSelection
): boolean {
  if (question.type === 'true_false') {
    return (
      typeof selection.selectedBoolean === 'boolean' &&
      question.correctBoolean !== null &&
      selection.selectedBoolean === question.correctBoolean
    );
  }

  if (question.type === 'multiple_choice' && selection.selectedOptionId) {
    return question.options.some(
      (opt) => opt.id === selection.selectedOptionId && opt.isCorrect
    );
  }

  return false;
}

export function verifySmartboardAnswer(
  state: SmartboardQuestionState,
  question: InteractiveLearningQuestion
): SmartboardQuestionState {
  if (!hasActiveSelection(state.selection)) {
    return state;
  }
  if (state.status === 'revealed') {
    return state;
  }

  const correct = isSelectionCorrectForQuestion(question, state.selection);
  return {
    ...state,
    status: correct ? 'checked_correct' : 'checked_wrong',
  };
}

export function revealSmartboardCorrectAnswer(
  state: SmartboardQuestionState
): SmartboardQuestionState {
  return {
    ...state,
    status: 'revealed',
  };
}

export function retrySmartboardQuestion(
  state: SmartboardQuestionState
): SmartboardQuestionState {
  return {
    ...state,
    selection: {
      selectedOptionId: null,
      selectedBoolean: null,
    },
    status: 'idle',
  };
}

export function navigateSmartboardQuestion(
  state: SmartboardQuestionState,
  targetIndex: number,
  totalQuestions: number
): SmartboardQuestionState {
  if (totalQuestions <= 0) {
    return createInitialSmartboardState();
  }

  if (targetIndex >= totalQuestions) {
    return {
      ...state,
      completedSession: true,
    };
  }

  const clampedIndex = Math.max(0, Math.min(targetIndex, totalQuestions - 1));
  return {
    currentIndex: clampedIndex,
    selection: {
      selectedOptionId: null,
      selectedBoolean: null,
    },
    status: 'idle',
    completedSession: false,
  };
}

export function extractSmartboardCorrectAnswerText(
  question: InteractiveLearningQuestion
): string | null {
  if (question.type === 'true_false') {
    if (question.correctBoolean === true) return 'صح';
    if (question.correctBoolean === false) return 'خطأ';
    return null;
  }

  if (question.type === 'multiple_choice') {
    const idx = question.options.findIndex((opt) => opt.isCorrect);
    if (idx === -1) return null;
    const opt = question.options[idx];
    const cleanText = opt.optionText?.trim();
    if (cleanText) {
      return `${OPTION_LETTERS[idx] ?? idx + 1}. ${cleanText}`;
    }
    return `الخيار ${OPTION_LETTERS[idx] ?? idx + 1}`;
  }

  return null;
}

export function extractRealQuestionExplanation(
  question: InteractiveLearningQuestion
): string | null {
  if (typeof question.explanation !== 'string') return null;
  const trimmed = question.explanation.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function moveQuestionIdInOrder(
  ids: string[],
  index: number,
  direction: 'up' | 'down'
): string[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= ids.length || targetIndex < 0 || targetIndex >= ids.length) {
    return ids;
  }
  const copy = [...ids];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIndex, 0, moved);
  return copy;
}

import type {
  StudentLiveSessionState,
  StudentQuestionResultView,
} from '../../types/liveSession';

export type StudentFeedbackKind = 'correct' | 'wrong' | 'timeout';

export interface StudentFeedbackBannerData {
  dedupKey: string;
  sessionQuestionId: string;
  kind: StudentFeedbackKind;
  title: string;
  subtitle: string | null;
  pointsAwarded: number | null;
  correctAnswerText: string | null;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

/**
 * يستخرج نص الإجابة الصحيحة الفعلي من بيانات السؤال المعتمدة من الخادم فقط دون أي تخمين أو افتراض.
 */
export function extractActualCorrectAnswerText(
  questionResult: StudentQuestionResultView
): string | null {
  if (questionResult.type === 'true_false') {
    if (questionResult.correctBoolean === true) return 'صح';
    if (questionResult.correctBoolean === false) return 'خطأ';
    return null;
  }

  if (questionResult.type === 'multiple_choice') {
    const idx = questionResult.options.findIndex(
      (opt) =>
        opt.isCorrect ||
        (questionResult.correctOptionId !== null && opt.id === questionResult.correctOptionId)
    );
    if (idx === -1) return null;
    const matched = questionResult.options[idx];
    const cleanText = matched.optionText?.trim();
    if (cleanText) {
      return cleanText;
    }
    return `الخيار ${OPTION_LETTERS[idx] ?? idx + 1}`;
  }

  return null;
}

/**
 * يبني بيانات شريط التغذية الراجعة للطالب بناءً على نتيجة الخادم المعتمدة فقط.
 * لا يُرجع أي شريط قبل انتهاء الإجابة ووصول مرحلة question_results، ولا يعرضه عند الانضمام المتأخر أثناء عرض النتائج أو عند انتهاء المسابقة.
 */
export function buildStudentFeedbackBannerData(
  state: StudentLiveSessionState | null | undefined
): StudentFeedbackBannerData | null {
  if (!state) return null;
  const { session, questionResult } = state;

  if (
    session.status !== 'running' ||
    session.currentPhase !== 'question_results' ||
    !questionResult ||
    questionResult.joinedMidResult
  ) {
    return null;
  }

  const dedupKey = `${session.sessionId}:${questionResult.sessionQuestionId}`;
  const { myResult } = questionResult;

  if (myResult.answered && myResult.isCorrect) {
    return {
      dedupKey,
      sessionQuestionId: questionResult.sessionQuestionId,
      kind: 'correct',
      title: 'إجابة صحيحة!',
      subtitle: 'أحسنت!',
      pointsAwarded: typeof myResult.pointsAwarded === 'number' ? myResult.pointsAwarded : null,
      correctAnswerText: null,
    };
  }

  const actualCorrectAnswer = extractActualCorrectAnswerText(questionResult);

  if (myResult.answered && !myResult.isCorrect) {
    return {
      dedupKey,
      sessionQuestionId: questionResult.sessionQuestionId,
      kind: 'wrong',
      title: 'إجابة خاطئة!',
      subtitle: null,
      pointsAwarded: null,
      correctAnswerText: actualCorrectAnswer,
    };
  }

  return {
    dedupKey,
    sessionQuestionId: questionResult.sessionQuestionId,
    kind: 'timeout',
    title: 'انتهى الوقت!',
    subtitle: null,
    pointsAwarded: null,
    correctAnswerText: actualCorrectAnswer,
  };
}

/**
 * يتحقق مما إذا كان ينبغي إطلاق شريط التغذية الراجعة دون تكرار أو عرض نتيجة قديمة منقضية.
 */
export function shouldDisplayFeedbackBanner(
  candidate: StudentFeedbackBannerData | null,
  shownKeys: ReadonlySet<string>,
  remainingMs: number | null
): candidate is StudentFeedbackBannerData {
  if (!candidate) return false;
  if (shownKeys.has(candidate.dedupKey)) return false;
  if (remainingMs !== null && remainingMs <= 250) return false;
  return true;
}

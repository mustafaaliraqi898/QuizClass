import type { LiveAdvanceMode, LiveScoringMode } from './liveSession';
import type { QuestionDifficulty, QuestionType } from './questionBank';

export interface ArchivedSessionSummary {
  id: string;
  liveSessionId: string;
  quizId: string | null;
  quizTitle: string;
  quizSubject: string | null;
  quizGrade: string | null;
  pinCode: string;
  status: 'completed';
  scoringMode: LiveScoringMode;
  advanceMode: LiveAdvanceMode;
  allowAnswerChange: boolean;
  allowLateJoin: boolean;
  questionIntroSeconds: number;
  autoAdvanceSeconds: number;
  fullScreenMode: boolean;
  questionCount: number;
  participantCount: number;
  startedAt: string | null;
  endedAt: string | null;
  archivedAt: string;
}

export interface ArchivedParticipantRecord {
  id: string;
  archiveId: string;
  sourceParticipantId: string | null;
  displayName: string;
  avatarId: string;
  totalScore: number;
  rankPosition: number | null;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracyPercent: number | null;
  totalResponseTimeMs: number;
  joinedAt: string | null;
}

export interface ArchivedResultSessionDetails {
  session: ArchivedSessionSummary;
  participants: ArchivedParticipantRecord[];
}

export interface ArchivedQuestionOption {
  id: string;
  optionOrder: number;
  optionText: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

export type ArchivedAnswerOutcome = 'correct' | 'wrong' | 'unanswered';

export interface ArchivedParticipantQuestionBreakdown {
  archiveQuestionId: string;
  questionOrder: number;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  points: number;
  timeLimitSeconds: number;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  options: ArchivedQuestionOption[];
  correctBoolean: boolean | null;
  correctOptionId: string | null;
  correctOptionText: string | null;
  correctOptionImageUrl: string | null;
  outcome: ArchivedAnswerOutcome;
  selectedOptionId: string | null;
  selectedOptionText: string | null;
  selectedOptionImageUrl: string | null;
  selectedBoolean: boolean | null;
  pointsAwarded: number;
  responseTimeMs: number | null;
  answeredAt: string | null;
}

export interface ArchivedParticipantDetailsResponse {
  session: ArchivedSessionSummary;
  participant: ArchivedParticipantRecord;
  questions: ArchivedParticipantQuestionBreakdown[];
}

export interface ArchivedResultsFilterParams {
  search?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'newest' | 'oldest';
}

export interface ArchivedResultsListResponse {
  archives: ArchivedSessionSummary[];
  totalCount: number;
}

import type {
  QuestionDifficulty,
  QuestionFilterParams,
  QuestionRecord,
  QuestionType,
} from './questionBank';

export interface QuizQuestionSnapshotOption {
  id: string;
  quizQuestionId: string;
  optionOrder: number;
  optionText: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

export interface QuizQuestionSnapshot {
  id: string;
  quizId: string;
  sourceQuestionId: string | null;
  questionOrder: number;
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  imageUrl: string | null;
  correctBoolean: boolean | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  timeLimitSeconds: number;
  options: QuizQuestionSnapshotOption[];
}

export type QuizLifecycleStatus = 'draft' | 'started' | 'completed';

export interface QuizSummary {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  description: string | null;
  defaultTimeSeconds: number;
  lifecycleStatus: QuizLifecycleStatus;
  questionCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizRecord extends QuizSummary {
  questions: QuizQuestionSnapshot[];
}

export interface QuizStats {
  totalQuizzes: number;
  totalQuizQuestions: number;
}

export interface QuizListResponse {
  quizzes: QuizSummary[];
  stats: QuizStats;
}

export type QuizQuestionInput =
  | {
      kind: 'bank_question';
      sourceQuestionId: string;
      timeLimitSeconds: number;
    }
  | {
      kind: 'existing_snapshot';
      quizQuestionId: string;
      timeLimitSeconds: number;
    };

export interface QuizPayload {
  title: string;
  subject?: string | null;
  grade?: string | null;
  description?: string | null;
  defaultTimeSeconds: number;
  questions: QuizQuestionInput[];
}

export interface RandomSelectionRequest {
  filters?: QuestionFilterParams;
  excludeQuestionIds?: string[];
  count?: number;
  draw?: boolean;
}

export interface RandomSelectionResponse {
  availableCount: number;
  questions: QuestionRecord[];
}

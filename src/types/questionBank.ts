export type QuestionType = 'multiple_choice' | 'true_false';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOptionInput {
  id?: string;
  optionText: string | null;
  imagePath: string | null;
  isCorrect: boolean;
}

export interface QuestionOption extends QuestionOptionInput {
  id: string;
  questionId: string;
  optionOrder: number;
  imageUrl: string | null;
}

export interface QuestionPayload {
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  correctBoolean: boolean | null;
  subject?: string | null;
  grade?: string | null;
  topic?: string | null;
  difficulty?: QuestionDifficulty | null;
  options?: QuestionOptionInput[];
}

export interface QuestionRecord {
  id: string;
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  imageUrl: string | null;
  correctBoolean: boolean | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  options: QuestionOption[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionFilterParams {
  search?: string;
  type?: QuestionType | 'all';
  subject?: string;
  grade?: string;
  topic?: string;
  difficulty?: QuestionDifficulty | 'all';
}

export interface QuestionFacets {
  subjects: string[];
  grades: string[];
  topics: string[];
}

export interface QuestionBankStats {
  totalQuestions: number;
  multipleChoiceCount: number;
  trueFalseCount: number;
  subjectCount: number;
}

export interface QuestionBankListResponse {
  questions: QuestionRecord[];
  facets: QuestionFacets;
  stats: QuestionBankStats;
}

export interface UploadedMediaAsset {
  imagePath: string;
  imageUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LinkedQuizBrief {
  id: string;
  title: string;
}

export interface LinkedQuizSummary {
  updatableQuizCount: number;
  lockedQuizCount: number;
  updatableQuizzes: LinkedQuizBrief[];
}

export interface QuestionUpdateResult extends QuestionRecord {
  linkedQuizSummary?: LinkedQuizSummary;
}

export interface QuestionSyncResponse {
  questionId: string;
  updatedQuizCount: number;
  updatedQuizQuestionCount: number;
  skippedLockedQuizCount: number;
  updatedQuizIds: string[];
}

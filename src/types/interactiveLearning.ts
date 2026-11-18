import type { QuestionRecord } from './questionBank';

export interface InteractiveLearningQuestion extends QuestionRecord {
  explanation?: string | null;
}

export interface InteractiveActivitySummary {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  autoFullscreen: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InteractiveActivityRecord extends InteractiveActivitySummary {
  questions: InteractiveLearningQuestion[];
}

export interface InteractiveActivityPayload {
  title: string;
  subject?: string | null;
  grade?: string | null;
  autoFullscreen?: boolean;
  questionIds: string[];
}

export interface InteractiveActivityListResponse {
  activities: InteractiveActivitySummary[];
}

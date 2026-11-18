import type { QuizSummary } from './quiz';

export type NavSectionId =
  | 'dashboard'
  | 'question-bank'
  | 'create-quiz'
  | 'quizzes'
  | 'live-session'
  | 'interactive-learning'
  | 'reports'
  | 'settings';

export type ThemeMode = 'light' | 'dark';

export type QuizMode = 'live' | 'individual';

export type QuizStatus = 'completed' | 'ready' | 'draft';

export interface NavItem {
  id: NavSectionId;
  label: string;
  description: string;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: number | null;
  unitLabel: string;
  detailText: string;
  accentTone: 'indigo' | 'emerald' | 'sky' | 'amber';
  dataSource: 'database' | 'preview';
  hasError?: boolean;
}

export interface QuickShortcut {
  id: string;
  title: string;
  subtitle: string;
  targetSection: NavSectionId;
  accentTone: 'indigo' | 'emerald' | 'violet' | 'sky';
  contextNote?: string;
}

export interface RecentQuizItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  mode: QuizMode;
  questionCount: number;
  participantCount: number;
  averageScore: number | null;
  dateLabel: string;
  status: QuizStatus;
  pinCode: string;
}

export interface TeacherProfile {
  name: string;
  role: string;
  school: string;
  avatarPath: string;
}

export interface DashboardSnapshot {
  isPreviewData: boolean;
  teacher: TeacherProfile;
  metrics: DashboardMetric[];
  recentQuizzes: QuizSummary[];
  quizzesError: string | null;
}

export interface ModuleRoadmapInfo {
  id: Exclude<NavSectionId, 'dashboard' | 'settings' | 'live-session' | 'interactive-learning'>;
  title: string;
  subtitle: string;
  phaseNote: string;
  plannedCapabilities: {
    title: string;
    detail: string;
  }[];
  architectureHint: string;
}

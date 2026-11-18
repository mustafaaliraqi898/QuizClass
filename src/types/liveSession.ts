export type LiveSessionStatus = 'waiting' | 'running' | 'completed' | 'cancelled';

export type ParticipantConnectionStatus = 'connected' | 'disconnected';

export type LiveQuestionPhase =
  | 'lobby'
  | 'question_intro'
  | 'answering'
  | 'question_results'
  | 'final_results';

export type LiveAdvanceMode = 'auto' | 'manual';

export type LiveScoringMode = 'speed_and_accuracy' | 'accuracy_only';

export interface LiveSessionSettings {
  questionIntroSeconds: number;
  advanceMode: LiveAdvanceMode;
  autoAdvanceSeconds: number;
  allowAnswerChange: boolean;
  allowLateJoin: boolean;
  scoringMode: LiveScoringMode;
  fullScreenMode: boolean;
}

export interface NetworkAddressOption {
  interfaceName: string;
  ip: string;
  port: number;
  joinUrl: string;
  qrDataUrl: string;
  isPrimary: boolean;
  isVirtual: boolean;
  label: string;
}

export interface LiveSessionParticipant {
  id: string;
  sessionId: string;
  displayName: string;
  avatarId: string;
  connectionStatus: ParticipantConnectionStatus;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalResponseTimeMs: number;
  rankPosition: number | null;
  joinedAt: string;
  lastSeenAt: string;
  disconnectedAt: string | null;
}

export interface LiveSessionSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSubject: string | null;
  quizGrade: string | null;
  pinCode: string;
  status: LiveSessionStatus;
  currentPhase: LiveQuestionPhase;
  settings: LiveSessionSettings;
  questionCount: number;
  participantCount: number;
  connectedParticipantCount: number;
  currentQuestionIndex: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  phaseDurationMs: number | null;
  serverNowMs: number;
  remainingMs: number | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

export interface LiveQuestionPublicOption {
  id: string;
  optionOrder: number;
  optionText: string | null;
  imageUrl: string | null;
}

export interface LiveQuestionRevealedOption extends LiveQuestionPublicOption {
  isCorrect: boolean;
  selectionCount: number;
}

export interface TeacherLiveQuestionView {
  id: string;
  questionOrder: number;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  imageUrl: string | null;
  timeLimitSeconds: number;
  points: number;
  options: LiveQuestionPublicOption[];
}

export interface TeacherQuestionResultsView {
  sessionQuestionId: string;
  questionOrder: number;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  imageUrl: string | null;
  points: number;
  correctOptionId: string | null;
  correctBoolean: boolean | null;
  options: LiveQuestionRevealedOption[];
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  trueSelectedCount: number;
  falseSelectedCount: number;
  correctParticipantNames: string[];
}

export interface FinalLeaderboardEntry {
  participantId: string;
  displayName: string;
  avatarId?: string;
  rankPosition: number;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalResponseTimeMs: number;
}

export interface TeacherLiveSessionDetails extends LiveSessionSummary {
  hostToken: string;
  participants: LiveSessionParticipant[];
  networkAddresses: NetworkAddressOption[];
  primaryJoinUrl: string;
  primaryQrDataUrl: string;
  answeredCount: number;
  currentQuestion: TeacherLiveQuestionView | null;
  questionResults: TeacherQuestionResultsView | null;
  finalResults: FinalLeaderboardEntry[] | null;
}

export interface StudentPublicSessionInfo {
  sessionId: string;
  quizTitle: string;
  quizSubject: string | null;
  quizGrade: string | null;
  pinCode: string;
  status: LiveSessionStatus;
  currentPhase: LiveQuestionPhase;
  settings: LiveSessionSettings;
  questionCount: number;
  participantCount: number;
  currentQuestionIndex: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  phaseDurationMs: number | null;
  serverNowMs: number;
  remainingMs: number | null;
}

export interface StudentLiveQuestionView {
  id: string;
  questionOrder: number;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  imageUrl: string | null;
  timeLimitSeconds: number;
  options?: LiveQuestionPublicOption[];
}

export interface StudentSubmittedAnswerSummary {
  sessionQuestionId: string;
  selectedOptionId: string | null;
  selectedBoolean: boolean | null;
  answeredAt: string;
}

export interface StudentQuestionResultView {
  sessionQuestionId: string;
  questionOrder: number;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  imageUrl: string | null;
  points: number;
  correctOptionId: string | null;
  correctBoolean: boolean | null;
  options: Array<{
    id: string;
    optionOrder: number;
    optionText: string | null;
    imageUrl: string | null;
    isCorrect: boolean;
  }>;
  myResult: {
    answered: boolean;
    selectedOptionId: string | null;
    selectedBoolean: boolean | null;
    isCorrect: boolean;
    responseTimeMs: number | null;
    pointsAwarded: number;
  };
  joinedMidResult: boolean;
}

export interface StudentLiveSessionState {
  session: StudentPublicSessionInfo;
  participant: {
    id: string;
    sessionId: string;
    displayName: string;
    avatarId: string;
    connectionStatus: ParticipantConnectionStatus;
    totalScore: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    rankPosition: number | null;
    joinedAt: string;
  };
  currentQuestion: StudentLiveQuestionView | null;
  myAnswer: StudentSubmittedAnswerSummary | null;
  questionResult: StudentQuestionResultView | null;
  finalSummary: {
    mySummary: FinalLeaderboardEntry | null;
    leaderboard: FinalLeaderboardEntry[];
  } | null;
}

export interface StudentSubmitAnswerRequest {
  sessionId: string;
  participantId: string;
  reconnectToken: string;
  sessionQuestionId: string;
  selectedOptionId?: string | null;
  selectedBoolean?: boolean | null;
}

export interface StudentSubmitAnswerResponse {
  received: true;
  updated: boolean;
  answer: StudentSubmittedAnswerSummary;
}

export interface StudentJoinRequest {
  pinCode: string;
  displayName: string;
  avatarId?: string;
  existingParticipantId?: string;
  reconnectToken?: string;
}

export interface StudentJoinResponse {
  session: StudentPublicSessionInfo;
  participant: {
    id: string;
    sessionId: string;
    displayName: string;
    avatarId: string;
    connectionStatus: ParticipantConnectionStatus;
    totalScore: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    rankPosition: number | null;
    joinedAt: string;
  };
  reconnectToken: string;
  reconnected: boolean;
  liveState?: StudentLiveSessionState;
}

export interface LiveSessionListResponse {
  activeSession: TeacherLiveSessionDetails | null;
  recentSessions: LiveSessionSummary[];
}

export interface LiveSessionConflictPayload {
  error: string;
  code: 'ACTIVE_SESSION_EXISTS';
  existingSession: TeacherLiveSessionDetails;
}

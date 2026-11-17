export type LiveSessionStatus = 'waiting' | 'running' | 'completed' | 'cancelled';

export type ParticipantConnectionStatus = 'connected' | 'disconnected';

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
  connectionStatus: ParticipantConnectionStatus;
  totalScore: number;
  correctCount: number;
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
  questionCount: number;
  participantCount: number;
  connectedParticipantCount: number;
  currentQuestionIndex: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

export interface TeacherLiveSessionDetails extends LiveSessionSummary {
  hostToken: string;
  participants: LiveSessionParticipant[];
  networkAddresses: NetworkAddressOption[];
  primaryJoinUrl: string;
  primaryQrDataUrl: string;
}

export interface StudentPublicSessionInfo {
  sessionId: string;
  quizTitle: string;
  quizSubject: string | null;
  quizGrade: string | null;
  pinCode: string;
  status: LiveSessionStatus;
  questionCount: number;
  participantCount: number;
}

export interface StudentJoinRequest {
  pinCode: string;
  displayName: string;
  existingParticipantId?: string;
  reconnectToken?: string;
}

export interface StudentJoinResponse {
  session: StudentPublicSessionInfo;
  participant: {
    id: string;
    sessionId: string;
    displayName: string;
    connectionStatus: ParticipantConnectionStatus;
    joinedAt: string;
  };
  reconnectToken: string;
  reconnected: boolean;
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

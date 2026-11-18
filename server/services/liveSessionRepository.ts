import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  FinalLeaderboardEntry,
  LiveAdvanceMode,
  LiveQuestionPhase,
  LiveScoringMode,
  LiveSessionListResponse,
  LiveSessionParticipant,
  LiveSessionSettings,
  LiveSessionStatus,
  LiveSessionSummary,
  ParticipantConnectionStatus,
  StudentJoinRequest,
  StudentJoinResponse,
  StudentLiveQuestionView,
  StudentLiveSessionState,
  StudentPublicSessionInfo,
  StudentQuestionResultView,
  StudentSubmitAnswerRequest,
  StudentSubmitAnswerResponse,
  TeacherLiveQuestionView,
  TeacherLiveSessionDetails,
  TeacherQuestionResultsView,
} from '../../src/types/liveSession.ts';
import type { QuizQuestionSnapshot } from '../../src/types/quiz.ts';
import type { StoragePaths } from '../config/storagePaths.ts';
import { mediaRelativePathToUrl } from './mediaStorageService.ts';
import { resolveSessionNetworkOptions } from './networkDiscoveryService.ts';
import { QuizNotFoundError, SqliteQuizRepository } from './quizRepository.ts';

interface LiveSessionRow {
  id: string;
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string | null;
  quiz_grade: string | null;
  pin_code: string;
  host_token: string;
  status: LiveSessionStatus;
  current_question_index: number;
  current_phase: LiveQuestionPhase;
  phase_started_at: string | null;
  phase_ends_at: string | null;
  question_intro_seconds: number;
  advance_mode: LiveAdvanceMode;
  auto_advance_seconds: number;
  allow_answer_change: number;
  allow_late_join: number;
  scoring_mode: LiveScoringMode;
  full_screen_mode?: number;
  question_started_at: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  question_count?: number;
  participant_count?: number;
  connected_participant_count?: number;
}

interface LiveSessionQuestionRow {
  id: string;
  session_id: string;
  source_quiz_question_id: string | null;
  source_question_id: string | null;
  question_order: number;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  image_path: string | null;
  correct_boolean: number | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  time_limit_seconds: number;
  points: number;
  results_finalized: number;
}

interface LiveSessionOptionRow {
  id: string;
  session_question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

interface ParticipantRow {
  id: string;
  session_id: string;
  display_name: string;
  normalized_name: string;
  reconnect_token: string;
  connection_status: ParticipantConnectionStatus;
  total_score: number;
  correct_count: number;
  wrong_count: number;
  total_response_time_ms: number;
  rank_position: number | null;
  joined_at: string;
  last_seen_at: string;
  disconnected_at: string | null;
  avatar_id?: string;
}

interface AnswerRow {
  id: string;
  session_id: string;
  session_question_id: string;
  participant_id: string;
  selected_option_id: string | null;
  selected_boolean: number | null;
  is_correct: number;
  response_time_ms: number | null;
  points_awarded: number;
  answered_at: string;
}

export class LiveSessionValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'LiveSessionValidationError';
    this.statusCode = statusCode;
  }
}

export class LiveSessionNotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'لم يتم العثور على جلسة المسابقة المطلوبة.') {
    super(message);
    this.name = 'LiveSessionNotFoundError';
  }
}

export class LiveSessionConflictError extends Error {
  statusCode = 409;
  code = 'ACTIVE_SESSION_EXISTS' as const;
  existingSessionId: string;

  constructor(message: string, existingSessionId: string) {
    super(message);
    this.name = 'LiveSessionConflictError';
    this.existingSessionId = existingSessionId;
  }
}

export const DEFAULT_LIVE_SESSION_SETTINGS: LiveSessionSettings = {
  questionIntroSeconds: 5,
  advanceMode: 'auto',
  autoAdvanceSeconds: 5,
  allowAnswerChange: false,
  allowLateJoin: true,
  scoringMode: 'speed_and_accuracy',
  fullScreenMode: false,
};

const MIN_PARTICIPANT_NAME_LENGTH = 2;
const MAX_PARTICIPANT_NAME_LENGTH = 40;
const MIN_PHASE_SECONDS = 1;
const MAX_PHASE_SECONDS = 60;

export function normalizePinCode(rawPin: unknown): string {
  if (typeof rawPin !== 'string' && typeof rawPin !== 'number') {
    return '';
  }
  return String(rawPin)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, '')
    .trim();
}

export function cleanParticipantDisplayName(rawName: unknown): string {
  if (typeof rawName !== 'string') return '';
  return rawName
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeParticipantName(rawName: string): string {
  const collapsed = cleanParticipantDisplayName(rawName);
  return collapsed
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .toLocaleLowerCase('en-US');
}

function mapSettingsFromRow(row: LiveSessionRow): LiveSessionSettings {
  return {
    questionIntroSeconds: row.question_intro_seconds ?? 5,
    advanceMode: row.advance_mode === 'manual' ? 'manual' : 'auto',
    autoAdvanceSeconds: row.auto_advance_seconds ?? 5,
    allowAnswerChange: row.allow_answer_change === 1,
    allowLateJoin: row.allow_late_join === 1,
    scoringMode: row.scoring_mode === 'accuracy_only' ? 'accuracy_only' : 'speed_and_accuracy',
    fullScreenMode: (row.full_screen_mode ?? 0) === 1,
  };
}

export function validateLiveSessionSettings(
  input: unknown,
  base: LiveSessionSettings = DEFAULT_LIVE_SESSION_SETTINGS
): LiveSessionSettings {
  if (input === undefined || input === null) {
    return { ...base };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new LiveSessionValidationError('صيغة إعدادات الجلسة غير صالحة.');
  }

  const raw = input as Record<string, unknown>;
  const next: LiveSessionSettings = { ...base };

  if (raw.questionIntroSeconds !== undefined) {
    const val = Number(raw.questionIntroSeconds);
    if (!Number.isInteger(val) || val < MIN_PHASE_SECONDS || val > MAX_PHASE_SECONDS) {
      throw new LiveSessionValidationError(
        `مدة عرض السؤال قبل الاختيارات يجب أن تكون عدداً صحيحاً بين ${MIN_PHASE_SECONDS} و${MAX_PHASE_SECONDS} ثانية.`
      );
    }
    next.questionIntroSeconds = val;
  }

  if (raw.advanceMode !== undefined) {
    if (raw.advanceMode !== 'auto' && raw.advanceMode !== 'manual') {
      throw new LiveSessionValidationError('طريقة الانتقال بين الأسئلة غير صالحة.');
    }
    next.advanceMode = raw.advanceMode;
  }

  if (raw.autoAdvanceSeconds !== undefined) {
    const val = Number(raw.autoAdvanceSeconds);
    if (!Number.isInteger(val) || val < MIN_PHASE_SECONDS || val > MAX_PHASE_SECONDS) {
      throw new LiveSessionValidationError(
        `مدة الانتظار قبل الانتقال التلقائي يجب أن تكون عدداً صحيحاً بين ${MIN_PHASE_SECONDS} و${MAX_PHASE_SECONDS} ثانية.`
      );
    }
    next.autoAdvanceSeconds = val;
  }

  if (raw.allowAnswerChange !== undefined) {
    if (typeof raw.allowAnswerChange !== 'boolean') {
      throw new LiveSessionValidationError('قيمة إعداد السماح بتغيير الإجابة غير صالحة.');
    }
    next.allowAnswerChange = raw.allowAnswerChange;
  }

  if (raw.allowLateJoin !== undefined) {
    if (typeof raw.allowLateJoin !== 'boolean') {
      throw new LiveSessionValidationError('قيمة إعداد السماح بالانضمام المتأخر غير صالحة.');
    }
    next.allowLateJoin = raw.allowLateJoin;
  }

  if (raw.scoringMode !== undefined) {
    if (raw.scoringMode !== 'speed_and_accuracy' && raw.scoringMode !== 'accuracy_only') {
      throw new LiveSessionValidationError('طريقة احتساب النقاط المختارة غير صالحة.');
    }
    next.scoringMode = raw.scoringMode;
  }

  if (raw.fullScreenMode !== undefined) {
    if (typeof raw.fullScreenMode !== 'boolean') {
      throw new LiveSessionValidationError('قيمة إعداد وضع ملء الشاشة غير صالحة.');
    }
    next.fullScreenMode = raw.fullScreenMode;
  }

  return next;
}

function computeTimingFields(row: LiveSessionRow, nowMs = Date.now()) {
  const startedMs = row.phase_started_at ? Date.parse(row.phase_started_at) : NaN;
  const endsMs = row.phase_ends_at ? Date.parse(row.phase_ends_at) : NaN;

  const phaseDurationMs =
    Number.isFinite(startedMs) && Number.isFinite(endsMs) && endsMs >= startedMs
      ? endsMs - startedMs
      : null;

  const remainingMs = Number.isFinite(endsMs) ? Math.max(0, endsMs - nowMs) : null;

  return {
    phaseStartedAt: row.phase_started_at,
    phaseEndsAt: row.phase_ends_at,
    phaseDurationMs,
    serverNowMs: nowMs,
    remainingMs,
  };
}

function mapParticipantRow(
  row: ParticipantRow,
  totalQuestions: number
): LiveSessionParticipant {
  const answeredTotal = (row.correct_count ?? 0) + (row.wrong_count ?? 0);
  return {
    id: row.id,
    sessionId: row.session_id,
    displayName: row.display_name,
    avatarId: row.avatar_id ?? 'avatar_cat',
    connectionStatus: row.connection_status,
    totalScore: row.total_score ?? 0,
    correctCount: row.correct_count ?? 0,
    wrongCount: row.wrong_count ?? 0,
    unansweredCount: Math.max(0, totalQuestions - answeredTotal),
    totalResponseTimeMs: row.total_response_time_ms ?? 0,
    rankPosition: row.rank_position,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    disconnectedAt: row.disconnected_at,
  };
}

function mapSessionSummaryRow(row: LiveSessionRow, nowMs = Date.now()): LiveSessionSummary {
  const timing = computeTimingFields(row, nowMs);
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    currentPhase: row.current_phase ?? 'lobby',
    settings: mapSettingsFromRow(row),
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
    connectedParticipantCount: row.connected_participant_count ?? 0,
    currentQuestionIndex: row.current_question_index,
    ...timing,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
  };
}

function mapToStudentPublicInfo(
  row: LiveSessionRow,
  nowMs = Date.now()
): StudentPublicSessionInfo {
  const timing = computeTimingFields(row, nowMs);
  return {
    sessionId: row.id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    currentPhase: row.current_phase ?? 'lobby',
    settings: mapSettingsFromRow(row),
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
    currentQuestionIndex: row.current_question_index,
    ...timing,
  };
}

function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class SqliteLiveSessionRepository {
  private db: DatabaseSync;
  private storagePaths: StoragePaths;
  private quizRepo: SqliteQuizRepository;

  constructor(db: DatabaseSync, storagePaths: StoragePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
    this.quizRepo = new SqliteQuizRepository(db, storagePaths);
  }

  private getSessionRowById(sessionId: string): LiveSessionRow | undefined {
    return this.db
      .prepare(
        `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        WHERE ls.id = ?
      `
      )
      .get(sessionId) as unknown as LiveSessionRow | undefined;
  }

  private getSessionRowByPin(pinCode: string): LiveSessionRow | undefined {
    return this.db
      .prepare(
        `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        WHERE ls.pin_code = ?
        ORDER BY
          CASE ls.status
            WHEN 'waiting' THEN 0
            WHEN 'running' THEN 1
            ELSE 2
          END ASC,
          ls.created_at DESC
        LIMIT 1
      `
      )
      .get(pinCode) as unknown as LiveSessionRow | undefined;
  }

  private getSessionQuestionByOrder(
    sessionId: string,
    questionOrder: number
  ): LiveSessionQuestionRow | undefined {
    if (questionOrder < 0) return undefined;
    return this.db
      .prepare(
        `SELECT * FROM live_session_questions WHERE session_id = ? AND question_order = ? LIMIT 1`
      )
      .get(sessionId, questionOrder) as unknown as LiveSessionQuestionRow | undefined;
  }

  private getSessionQuestionOptions(sessionQuestionId: string): LiveSessionOptionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM live_session_question_options WHERE session_question_id = ? ORDER BY option_order ASC`
      )
      .all(sessionQuestionId) as unknown as LiveSessionOptionRow[];
  }

  private buildLeaderboard(
    participantRows: ParticipantRow[],
    totalQuestions: number
  ): FinalLeaderboardEntry[] {
    const sorted = [...participantRows].sort((a, b) => {
      if ((b.total_score ?? 0) !== (a.total_score ?? 0)) {
        return (b.total_score ?? 0) - (a.total_score ?? 0);
      }
      if ((b.correct_count ?? 0) !== (a.correct_count ?? 0)) {
        return (b.correct_count ?? 0) - (a.correct_count ?? 0);
      }
      if ((a.total_response_time_ms ?? 0) !== (b.total_response_time_ms ?? 0)) {
        return (a.total_response_time_ms ?? 0) - (b.total_response_time_ms ?? 0);
      }
      if (a.joined_at !== b.joined_at) {
        return a.joined_at.localeCompare(b.joined_at);
      }
      return a.id.localeCompare(b.id);
    });

    return sorted.map((row, idx) => {
      const answeredTotal = (row.correct_count ?? 0) + (row.wrong_count ?? 0);
      return {
        participantId: row.id,
        displayName: row.display_name,
        avatarId: row.avatar_id ?? 'avatar_cat',
        rankPosition: row.rank_position ?? idx + 1,
        totalScore: row.total_score ?? 0,
        correctCount: row.correct_count ?? 0,
        wrongCount: row.wrong_count ?? 0,
        unansweredCount: Math.max(0, totalQuestions - answeredTotal),
        totalResponseTimeMs: row.total_response_time_ms ?? 0,
      };
    });
  }

  private recomputeSessionStandingsTx(sessionId: string): void {
    const participantRows = this.db
      .prepare(`SELECT * FROM live_session_participants WHERE session_id = ?`)
      .all(sessionId) as unknown as ParticipantRow[];

    const aggRows = this.db
      .prepare(
        `
        SELECT
          lsa.participant_id AS participant_id,
          COALESCE(SUM(lsa.points_awarded), 0) AS total_score,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_count,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong_count,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 1 THEN COALESCE(lsa.response_time_ms, 0) ELSE 0 END), 0) AS correct_time_ms
        FROM live_session_answers lsa
        INNER JOIN live_session_questions lsq ON lsq.id = lsa.session_question_id
        WHERE lsa.session_id = ? AND lsq.results_finalized = 1
        GROUP BY lsa.participant_id
      `
      )
      .all(sessionId) as Array<{
      participant_id: string;
      total_score: number;
      correct_count: number;
      wrong_count: number;
      correct_time_ms: number;
    }>;

    const aggByParticipant = new Map(aggRows.map((row) => [row.participant_id, row]));

    const computed = participantRows.map((p) => {
      const agg = aggByParticipant.get(p.id);
      return {
        id: p.id,
        joinedAt: p.joined_at,
        totalScore: agg ? Number(agg.total_score) : 0,
        correctCount: agg ? Number(agg.correct_count) : 0,
        wrongCount: agg ? Number(agg.wrong_count) : 0,
        totalResponseTimeMs: agg ? Number(agg.correct_time_ms) : 0,
      };
    });

    computed.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.totalResponseTimeMs !== b.totalResponseTimeMs) {
        return a.totalResponseTimeMs - b.totalResponseTimeMs;
      }
      if (a.joinedAt !== b.joinedAt) return a.joinedAt.localeCompare(b.joinedAt);
      return a.id.localeCompare(b.id);
    });

    const updateStmt = this.db.prepare(
      `
      UPDATE live_session_participants
      SET total_score = ?,
          correct_count = ?,
          wrong_count = ?,
          total_response_time_ms = ?,
          rank_position = ?
      WHERE id = ? AND session_id = ?
    `
    );

    computed.forEach((entry, index) => {
      updateStmt.run(
        entry.totalScore,
        entry.correctCount,
        entry.wrongCount,
        entry.totalResponseTimeMs,
        index + 1,
        entry.id,
        sessionId
      );
    });
  }

  private generateUniqueActivePin(): string {
    const checkStmt = this.db.prepare(
      `SELECT 1 FROM live_sessions WHERE pin_code = ? AND status IN ('waiting', 'running') LIMIT 1`
    );

    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = String(crypto.randomInt(100000, 1000000));
      if (!checkStmt.get(candidate)) {
        return candidate;
      }
    }

    throw new LiveSessionValidationError('تعذر توليد رمز PIN فريد للجلسة حالياً. حاول مرة أخرى.', 500);
  }

  private insertFrozenSessionQuestions(
    sessionId: string,
    questions: QuizQuestionSnapshot[]
  ): void {
    const insertQuestionStmt = this.db.prepare(
      `
      INSERT INTO live_session_questions (
        id, session_id, source_quiz_question_id, source_question_id, question_order,
        type, prompt, image_path, correct_boolean, subject, grade, topic,
        difficulty, time_limit_seconds, points, results_finalized
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `
    );

    const insertOptionStmt = this.db.prepare(
      `
      INSERT INTO live_session_question_options (
        id, session_question_id, option_order, option_text, image_path, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    );

    questions.forEach((question, index) => {
      const sessionQuestionId = crypto.randomUUID();
      insertQuestionStmt.run(
        sessionQuestionId,
        sessionId,
        question.id,
        question.sourceQuestionId,
        index,
        question.type,
        question.prompt,
        question.imagePath,
        question.correctBoolean === null ? null : question.correctBoolean ? 1 : 0,
        question.subject,
        question.grade,
        question.topic,
        question.difficulty,
        question.timeLimitSeconds,
        1000
      );

      if (question.type === 'multiple_choice') {
        question.options.forEach((opt, optIdx) => {
          insertOptionStmt.run(
            crypto.randomUUID(),
            sessionQuestionId,
            optIdx,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
    });
  }

  private buildTeacherQuestionResults(
    sessionId: string,
    questionRow: LiveSessionQuestionRow,
    totalParticipants: number
  ): TeacherQuestionResultsView {
    const options = this.getSessionQuestionOptions(questionRow.id);
    const answers = this.db
      .prepare(
        `
        SELECT
          lsa.*,
          lsp.display_name AS participant_name,
          lsp.joined_at AS participant_joined_at
        FROM live_session_answers lsa
        INNER JOIN live_session_participants lsp ON lsp.id = lsa.participant_id
        WHERE lsa.session_id = ? AND lsa.session_question_id = ?
        ORDER BY COALESCE(lsa.response_time_ms, 9999999) ASC, lsp.joined_at ASC
      `
      )
      .all(sessionId, questionRow.id) as unknown as Array<
      AnswerRow & { participant_name: string; participant_joined_at: string }
    >;

    const optionCountMap = new Map<string, number>();
    let correctCount = 0;
    let wrongCount = 0;
    let trueSelectedCount = 0;
    let falseSelectedCount = 0;
    const correctParticipantNames: string[] = [];

    for (const ans of answers) {
      if (ans.is_correct === 1) {
        correctCount += 1;
        correctParticipantNames.push(ans.participant_name);
      } else {
        wrongCount += 1;
      }
      if (ans.selected_option_id) {
        optionCountMap.set(
          ans.selected_option_id,
          (optionCountMap.get(ans.selected_option_id) ?? 0) + 1
        );
      }
      if (ans.selected_boolean === 1) trueSelectedCount += 1;
      if (ans.selected_boolean === 0) falseSelectedCount += 1;
    }

    const correctOpt = options.find((opt) => opt.is_correct === 1) ?? null;

    return {
      sessionQuestionId: questionRow.id,
      questionOrder: questionRow.question_order,
      type: questionRow.type,
      prompt: questionRow.prompt,
      imageUrl: mediaRelativePathToUrl(questionRow.image_path),
      points: questionRow.points,
      correctOptionId: questionRow.type === 'multiple_choice' ? (correctOpt?.id ?? null) : null,
      correctBoolean:
        questionRow.type === 'true_false' && questionRow.correct_boolean !== null
          ? questionRow.correct_boolean === 1
          : null,
      options: options.map((opt) => ({
        id: opt.id,
        optionOrder: opt.option_order,
        optionText: opt.option_text,
        imageUrl: mediaRelativePathToUrl(opt.image_path),
        isCorrect: opt.is_correct === 1,
        selectionCount: optionCountMap.get(opt.id) ?? 0,
      })),
      correctCount,
      wrongCount,
      unansweredCount: Math.max(0, totalParticipants - (correctCount + wrongCount)),
      trueSelectedCount,
      falseSelectedCount,
      correctParticipantNames,
    };
  }

  async getTeacherSessionDetails(
    sessionId: string,
    options?: { port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    const participantRows = this.db
      .prepare(
        `
        SELECT * FROM live_session_participants
        WHERE session_id = ?
        ORDER BY COALESCE(rank_position, 999999) ASC, joined_at ASC
      `
      )
      .all(sessionId) as unknown as ParticipantRow[];

    const totalQuestions = row.question_count ?? 0;
    const nowMs = Date.now();
    const port = options?.port ?? Number(process.env.PORT ?? 3000);
    const networkInfo = await resolveSessionNetworkOptions({
      pinCode: row.pin_code,
      port,
      requestOrigin: options?.requestOrigin,
    });

    let currentQuestion: TeacherLiveQuestionView | null = null;
    let answeredCount = 0;
    let questionResults: TeacherQuestionResultsView | null = null;

    if (
      row.status === 'running' &&
      row.current_question_index >= 0 &&
      (row.current_phase === 'question_intro' ||
        row.current_phase === 'answering' ||
        row.current_phase === 'question_results')
    ) {
      const qRow = this.getSessionQuestionByOrder(sessionId, row.current_question_index);
      if (qRow) {
        const optRows = this.getSessionQuestionOptions(qRow.id);
        currentQuestion = {
          id: qRow.id,
          questionOrder: qRow.question_order,
          type: qRow.type,
          prompt: qRow.prompt,
          imageUrl: mediaRelativePathToUrl(qRow.image_path),
          timeLimitSeconds: qRow.time_limit_seconds,
          points: qRow.points,
          options: optRows.map((opt) => ({
            id: opt.id,
            optionOrder: opt.option_order,
            optionText: opt.option_text,
            imageUrl: mediaRelativePathToUrl(opt.image_path),
          })),
        };

        const countRow = this.db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM live_session_answers WHERE session_id = ? AND session_question_id = ?`
          )
          .get(sessionId, qRow.id) as { cnt: number };
        answeredCount = Number(countRow?.cnt ?? 0);

        if (row.current_phase === 'question_results') {
          questionResults = this.buildTeacherQuestionResults(
            sessionId,
            qRow,
            participantRows.length
          );
        }
      }
    }

    const finalResults =
      row.status === 'completed' || row.current_phase === 'final_results'
        ? this.buildLeaderboard(participantRows, totalQuestions)
        : null;

    return {
      ...mapSessionSummaryRow(row, nowMs),
      hostToken: row.host_token,
      participants: participantRows.map((p) => mapParticipantRow(p, totalQuestions)),
      networkAddresses: networkInfo.networkAddresses,
      primaryJoinUrl: networkInfo.primaryJoinUrl,
      primaryQrDataUrl: networkInfo.primaryQrDataUrl,
      answeredCount,
      currentQuestion,
      questionResults,
      finalResults,
    };
  }

  async listSessionsForTeacher(options?: {
    port?: number;
    requestOrigin?: string | null;
  }): Promise<LiveSessionListResponse> {
    const activeRow = this.db
      .prepare(
        `
        SELECT ls.id
        FROM live_sessions ls
        WHERE ls.status IN ('waiting', 'running')
        ORDER BY ls.created_at DESC
        LIMIT 1
      `
      )
      .get() as { id: string } | undefined;

    const activeSession = activeRow
      ? await this.getTeacherSessionDetails(activeRow.id, options)
      : null;

    const recentRows = this.db
      .prepare(
        `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        ORDER BY ls.created_at DESC
        LIMIT 15
      `
      )
      .all() as unknown as LiveSessionRow[];

    const nowMs = Date.now();
    return {
      activeSession,
      recentSessions: recentRows.map((r) => mapSessionSummaryRow(r, nowMs)),
    };
  }

  async createSession(
    quizId: string,
    options?: { settings?: unknown; port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const cleanQuizId = typeof quizId === 'string' ? quizId.trim() : '';
    if (!cleanQuizId) {
      throw new LiveSessionValidationError('معرّف المسابقة غير صالح.');
    }

    const validatedSettings = validateLiveSessionSettings(
      options?.settings,
      DEFAULT_LIVE_SESSION_SETTINGS
    );

    let quiz;
    try {
      quiz = this.quizRepo.getQuizById(cleanQuizId);
    } catch (error) {
      if (error instanceof QuizNotFoundError) {
        throw new LiveSessionNotFoundError('المسابقة المحددة غير موجودة في قاعدة البيانات.');
      }
      throw error;
    }

    if (quiz.questions.length === 0) {
      throw new LiveSessionValidationError(
        'لا يمكن تشغيل جلسة مباشرة لمسابقة لا تحتوي على أي أسئلة محفوظة.'
      );
    }

    const existingForQuiz = this.db
      .prepare(
        `
        SELECT id, pin_code, status
        FROM live_sessions
        WHERE quiz_id = ? AND status IN ('waiting', 'running')
        LIMIT 1
      `
      )
      .get(cleanQuizId) as { id: string; pin_code: string; status: LiveSessionStatus } | undefined;

    if (existingForQuiz) {
      throw new LiveSessionConflictError(
        `توجد جلسة مباشرة نشطة حالياً لهذه المسابقة برمز الدخول ${existingForQuiz.pin_code}.`,
        existingForQuiz.id
      );
    }

    const sessionId = crypto.randomUUID();
    const pinCode = this.generateUniqueActivePin();
    const hostToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          INSERT INTO live_sessions (
            id, quiz_id, quiz_title, quiz_subject, quiz_grade,
            pin_code, host_token, status, current_question_index,
            current_phase, phase_started_at, phase_ends_at,
            question_intro_seconds, advance_mode, auto_advance_seconds,
            allow_answer_change, allow_late_join, scoring_mode, full_screen_mode,
            question_started_at, created_at, started_at, ended_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', -1, 'lobby', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)
        `
        )
        .run(
          sessionId,
          quiz.id,
          quiz.title,
          quiz.subject,
          quiz.grade,
          pinCode,
          hostToken,
          validatedSettings.questionIntroSeconds,
          validatedSettings.advanceMode,
          validatedSettings.autoAdvanceSeconds,
          validatedSettings.allowAnswerChange ? 1 : 0,
          validatedSettings.allowLateJoin ? 1 : 0,
          validatedSettings.scoringMode,
          validatedSettings.fullScreenMode ? 1 : 0,
          now,
          now
        );

      this.insertFrozenSessionQuestions(sessionId, quiz.questions);
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      const message = error instanceof Error ? error.message : '';
      if (message.includes('idx_live_sessions_active_quiz')) {
        const conflict = this.db
          .prepare(
            `SELECT id, pin_code FROM live_sessions WHERE quiz_id = ? AND status IN ('waiting', 'running') LIMIT 1`
          )
          .get(cleanQuizId) as { id: string; pin_code: string } | undefined;
        if (conflict) {
          throw new LiveSessionConflictError(
            `توجد جلسة مباشرة نشطة حالياً لهذه المسابقة برمز الدخول ${conflict.pin_code}.`,
            conflict.id
          );
        }
      }
      throw error;
    }

    return this.getTeacherSessionDetails(sessionId, options);
  }

  async updateSessionSettings(
    sessionId: string,
    settingsInput: unknown,
    options?: { hostToken?: string; port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError('غير مصرح بتعديل إعدادات هذه الجلسة.', 403);
    }

    if (row.status !== 'waiting') {
      throw new LiveSessionValidationError(
        'لا يمكن تعديل إعدادات المسابقة بعد بدئها أو إنهائها.',
        409
      );
    }

    const nextSettings = validateLiveSessionSettings(settingsInput, mapSettingsFromRow(row));
    const now = new Date().toISOString();

    const updateRes = this.db
      .prepare(
        `
        UPDATE live_sessions
        SET question_intro_seconds = ?,
            advance_mode = ?,
            auto_advance_seconds = ?,
            allow_answer_change = ?,
            allow_late_join = ?,
            scoring_mode = ?,
            full_screen_mode = ?,
            updated_at = ?
        WHERE id = ? AND status = 'waiting'
      `
      )
      .run(
        nextSettings.questionIntroSeconds,
        nextSettings.advanceMode,
        nextSettings.autoAdvanceSeconds,
        nextSettings.allowAnswerChange ? 1 : 0,
        nextSettings.allowLateJoin ? 1 : 0,
        nextSettings.scoringMode,
        nextSettings.fullScreenMode ? 1 : 0,
        now,
        sessionId
      );

    if (updateRes.changes !== 1) {
      throw new LiveSessionValidationError(
        'لا يمكن تعديل إعدادات المسابقة بعد بدئها.',
        409
      );
    }

    return this.getTeacherSessionDetails(sessionId, options);
  }

  async startSession(
    sessionId: string,
    options?: {
      hostToken?: string;
      settings?: unknown;
      port?: number;
      requestOrigin?: string | null;
    }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError('غير مصرح ببدء هذه الجلسة.', 403);
    }

    if (row.status === 'running') {
      return this.getTeacherSessionDetails(sessionId, options);
    }

    if (row.status !== 'waiting') {
      throw new LiveSessionValidationError(
        'لا يمكن بدء الجلسة لأنها منتهية أو ملغاة بالفعل.',
        409
      );
    }

    const settings = validateLiveSessionSettings(options?.settings, mapSettingsFromRow(row));

    const quiz = this.quizRepo.getQuizById(row.quiz_id);
    if (quiz.questions.length === 0) {
      throw new LiveSessionValidationError(
        'تعذر بدء الجلسة لعدم وجود أسئلة صالحة في المسابقة.'
      );
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const introEndsIso = new Date(nowMs + settings.questionIntroSeconds * 1000).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`DELETE FROM live_session_questions WHERE session_id = ?`).run(sessionId);
      this.insertFrozenSessionQuestions(sessionId, quiz.questions);

      const updateSessionRes = this.db
        .prepare(
          `
          UPDATE live_sessions
          SET quiz_title = ?,
              quiz_subject = ?,
              quiz_grade = ?,
              status = 'running',
              current_question_index = 0,
              current_phase = 'question_intro',
              phase_started_at = ?,
              phase_ends_at = ?,
              question_intro_seconds = ?,
              advance_mode = ?,
              auto_advance_seconds = ?,
              allow_answer_change = ?,
              allow_late_join = ?,
              scoring_mode = ?,
              full_screen_mode = ?,
              question_started_at = NULL,
              started_at = ?,
              updated_at = ?
          WHERE id = ? AND status = 'waiting'
        `
        )
        .run(
          quiz.title,
          quiz.subject,
          quiz.grade,
          nowIso,
          introEndsIso,
          settings.questionIntroSeconds,
          settings.advanceMode,
          settings.autoAdvanceSeconds,
          settings.allowAnswerChange ? 1 : 0,
          settings.allowLateJoin ? 1 : 0,
          settings.scoringMode,
          settings.fullScreenMode ? 1 : 0,
          nowIso,
          nowIso,
          sessionId
        );

      if (updateSessionRes.changes !== 1) {
        throw new LiveSessionValidationError('تعذر تغيير حالة الجلسة إلى قيد التشغيل.', 409);
      }

      this.db
        .prepare(
          `
          UPDATE quizzes
          SET lifecycle_status = 'started', updated_at = ?
          WHERE id = ?
        `
        )
        .run(nowIso, row.quiz_id);

      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }

    return this.getTeacherSessionDetails(sessionId, options);
  }

  /**
   * الانتقال الذري من مرحلة عرض السؤال التمهيدي (question_intro) إلى مرحلة استقبال الإجابات (answering).
   */
  beginAnsweringPhase(sessionId: string, expectedQuestionIndex: number): boolean {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.getSessionRowById(sessionId);
      if (
        !row ||
        row.status !== 'running' ||
        row.current_phase !== 'question_intro' ||
        row.current_question_index !== expectedQuestionIndex
      ) {
        this.db.exec('ROLLBACK');
        return false;
      }

      const qRow = this.getSessionQuestionByOrder(sessionId, expectedQuestionIndex);
      if (!qRow) {
        this.db.exec('ROLLBACK');
        return false;
      }

      const endsIso = new Date(nowMs + qRow.time_limit_seconds * 1000).toISOString();
      const res = this.db
        .prepare(
          `
          UPDATE live_sessions
          SET current_phase = 'answering',
              phase_started_at = ?,
              phase_ends_at = ?,
              question_started_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'question_intro'
            AND current_question_index = ?
        `
        )
        .run(nowIso, endsIso, nowIso, nowIso, sessionId, expectedQuestionIndex);

      this.db.exec('COMMIT');
      return res.changes === 1;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }
  }

  /**
   * إغلاق استقبال الإجابات واحتساب نتائج السؤال وتحديث النقاط والترتيب ذرياً في SQLite.
   */
  finalizeCurrentQuestion(sessionId: string, expectedQuestionIndex: number): boolean {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.getSessionRowById(sessionId);
      if (
        !row ||
        row.status !== 'running' ||
        row.current_phase !== 'answering' ||
        row.current_question_index !== expectedQuestionIndex
      ) {
        this.db.exec('ROLLBACK');
        return false;
      }

      const qRow = this.getSessionQuestionByOrder(sessionId, expectedQuestionIndex);
      if (!qRow) {
        this.db.exec('ROLLBACK');
        return false;
      }

      this.db
        .prepare(`UPDATE live_session_questions SET results_finalized = 1 WHERE id = ?`)
        .run(qRow.id);

      this.recomputeSessionStandingsTx(sessionId);

      const nextEndsIso =
        row.advance_mode === 'auto'
          ? new Date(nowMs + row.auto_advance_seconds * 1000).toISOString()
          : null;

      const res = this.db
        .prepare(
          `
          UPDATE live_sessions
          SET current_phase = 'question_results',
              phase_started_at = ?,
              phase_ends_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'answering'
            AND current_question_index = ?
        `
        )
        .run(nowIso, nextEndsIso, nowIso, sessionId, expectedQuestionIndex);

      this.db.exec('COMMIT');
      return res.changes === 1;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }
  }

  /**
   * الانتقال من نتائج السؤال الحالي إلى السؤال التالي (question_intro) أو إلى النتائج النهائية (completed/final_results).
   */
  advanceFromResults(
    sessionId: string,
    expectedQuestionIndex?: number
  ): { transitioned: boolean; completed: boolean } {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row || row.status !== 'running' || row.current_phase !== 'question_results') {
        this.db.exec('ROLLBACK');
        return { transitioned: false, completed: false };
      }

      if (
        expectedQuestionIndex !== undefined &&
        row.current_question_index !== expectedQuestionIndex
      ) {
        this.db.exec('ROLLBACK');
        return { transitioned: false, completed: false };
      }

      const totalQuestions = row.question_count ?? 0;
      const nextIndex = row.current_question_index + 1;

      if (nextIndex < totalQuestions) {
        const nextEndsIso = new Date(nowMs + row.question_intro_seconds * 1000).toISOString();
        const res = this.db
          .prepare(
            `
            UPDATE live_sessions
            SET current_question_index = ?,
                current_phase = 'question_intro',
                phase_started_at = ?,
                phase_ends_at = ?,
                question_started_at = NULL,
                updated_at = ?
            WHERE id = ?
              AND status = 'running'
              AND current_phase = 'question_results'
              AND current_question_index = ?
          `
          )
          .run(nextIndex, nowIso, nextEndsIso, nowIso, sessionId, row.current_question_index);

        this.db.exec('COMMIT');
        return { transitioned: res.changes === 1, completed: false };
      }

      // نهاية آخر سؤال -> النتائج النهائية وتحديث حالة المسابقة إلى completed
      this.recomputeSessionStandingsTx(sessionId);

      const completeRes = this.db
        .prepare(
          `
          UPDATE live_sessions
          SET status = 'completed',
              current_phase = 'final_results',
              phase_started_at = ?,
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'question_results'
            AND current_question_index = ?
        `
        )
        .run(nowIso, nowIso, nowIso, sessionId, row.current_question_index);

      this.db
        .prepare(`UPDATE quizzes SET lifecycle_status = 'completed', updated_at = ? WHERE id = ?`)
        .run(nowIso, row.quiz_id);

      this.db.exec('COMMIT');
      return { transitioned: completeRes.changes === 1, completed: completeRes.changes === 1 };
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }
  }

  async nextQuestionByTeacher(
    sessionId: string,
    options?: { hostToken?: string; port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError('غير مصرح بالتحكم في تقدم هذه الجلسة.', 403);
    }

    if (row.status !== 'running') {
      throw new LiveSessionValidationError('الجلسة ليست قيد التشغيل حالياً.', 409);
    }

    if (row.current_phase !== 'question_results') {
      throw new LiveSessionValidationError(
        'يمكن الانتقال إلى السؤال التالي فقط بعد انتهاء السؤال الحالي وعرض نتائجه.',
        409
      );
    }

    this.advanceFromResults(sessionId, row.current_question_index);
    return this.getTeacherSessionDetails(sessionId, options);
  }

  async completeSession(
    sessionId: string,
    options?: { hostToken?: string; port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError('غير مصرح بإنهاء هذه الجلسة.', 403);
    }

    if (row.status === 'completed') {
      return this.getTeacherSessionDetails(sessionId, options);
    }

    if (row.status !== 'running') {
      throw new LiveSessionValidationError('يمكن إكمال الجلسة فقط بعد بدئها.', 409);
    }

    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // إذا أنهى المعلم المسابقة أثناء مرحلة الإجابة، نثبت الإجابات المستلمة للسؤال الحالي أولاً
      const freshRow = this.getSessionRowById(sessionId);
      if (freshRow && freshRow.current_question_index >= 0) {
        const currentQ = this.getSessionQuestionByOrder(
          sessionId,
          freshRow.current_question_index
        );
        if (currentQ && freshRow.current_phase === 'answering') {
          this.db
            .prepare(`UPDATE live_session_questions SET results_finalized = 1 WHERE id = ?`)
            .run(currentQ.id);
        }
      }

      this.recomputeSessionStandingsTx(sessionId);

      this.db
        .prepare(
          `
          UPDATE live_sessions
          SET status = 'completed',
              current_phase = 'final_results',
              phase_started_at = ?,
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ? AND status = 'running'
        `
        )
        .run(now, now, now, sessionId);

      this.db
        .prepare(
          `
          UPDATE quizzes
          SET lifecycle_status = 'completed', updated_at = ?
          WHERE id = ?
        `
        )
        .run(now, row.quiz_id);

      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }

    return this.getTeacherSessionDetails(sessionId, options);
  }

  async cancelSession(
    sessionId: string,
    options?: { hostToken?: string; port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError('غير مصرح بإلغاء هذه الجلسة.', 403);
    }

    if (row.status === 'cancelled') {
      return this.getTeacherSessionDetails(sessionId, options);
    }

    if (row.status === 'completed') {
      throw new LiveSessionValidationError('لا يمكن إلغاء جلسة مكتملة بالفعل.', 409);
    }

    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          UPDATE live_sessions
          SET status = 'cancelled',
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ? AND status IN ('waiting', 'running')
        `
        )
        .run(now, now, sessionId);

      if (row.started_at) {
        this.db
          .prepare(`UPDATE quizzes SET lifecycle_status = 'completed', updated_at = ? WHERE id = ?`)
          .run(now, row.quiz_id);
      }

      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }

    return this.getTeacherSessionDetails(sessionId, options);
  }

  lookupPublicSessionByPin(rawPin: unknown): StudentPublicSessionInfo {
    const pinCode = normalizePinCode(rawPin);
    if (!/^\d{6}$/.test(pinCode)) {
      throw new LiveSessionValidationError('يرجى إدخال رمز PIN صحيح مكوّن من 6 أرقام.');
    }

    const row = this.getSessionRowByPin(pinCode);
    if (!row) {
      throw new LiveSessionNotFoundError('رمز الجلسة غير صحيح أو لا توجد جلسة مطابقة.');
    }

    if (row.status === 'completed') {
      throw new LiveSessionValidationError('انتهت هذه المسابقة ولم يعد الانضمام متاحاً.', 409);
    }

    if (row.status === 'cancelled') {
      throw new LiveSessionValidationError('تم إلغاء هذه الجلسة من قِبل المعلم.', 409);
    }

    if (row.status === 'running' && row.allow_late_join === 0) {
      throw new LiveSessionValidationError(
        'تم إغلاق الانضمام لأن المسابقة قد بدأت بالفعل ولا يُسمح بالانضمام المتأخر.',
        409
      );
    }

    return mapToStudentPublicInfo(row);
  }

  getStudentPublicSessionById(sessionId: string): StudentPublicSessionInfo {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    return mapToStudentPublicInfo(row);
  }

  getStudentLiveState(sessionId: string, participantId: string): StudentLiveSessionState {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }

    const participantRow = this.db
      .prepare(`SELECT * FROM live_session_participants WHERE id = ? AND session_id = ?`)
      .get(participantId, sessionId) as unknown as ParticipantRow | undefined;

    if (!participantRow) {
      throw new LiveSessionValidationError('المشارك غير مسجل في هذه الجلسة.', 404);
    }

    const nowMs = Date.now();
    const totalQuestions = row.question_count ?? 0;
    const publicSession = mapToStudentPublicInfo(row, nowMs);
    const participantAnswered =
      (participantRow.correct_count ?? 0) + (participantRow.wrong_count ?? 0);

    let currentQuestion: StudentLiveQuestionView | null = null;
    let myAnswer: StudentLiveSessionState['myAnswer'] = null;
    let questionResult: StudentQuestionResultView | null = null;
    let finalSummary: StudentLiveSessionState['finalSummary'] = null;

    if (row.status === 'running' && row.current_question_index >= 0) {
      const qRow = this.getSessionQuestionByOrder(sessionId, row.current_question_index);
      if (qRow) {
        const answerRow = this.db
          .prepare(
            `SELECT * FROM live_session_answers WHERE session_question_id = ? AND participant_id = ? LIMIT 1`
          )
          .get(qRow.id, participantId) as unknown as AnswerRow | undefined;

        if (answerRow) {
          myAnswer = {
            sessionQuestionId: qRow.id,
            selectedOptionId: answerRow.selected_option_id,
            selectedBoolean:
              answerRow.selected_boolean === null ? null : answerRow.selected_boolean === 1,
            answeredAt: answerRow.answered_at,
          };
        }

        if (row.current_phase === 'question_intro') {
          // المرحلة الأولى: نص السؤال وصورته فقط، دون الاختيارات ودون أي إجابة صحيحة
          currentQuestion = {
            id: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            timeLimitSeconds: qRow.time_limit_seconds,
          };
        } else if (row.current_phase === 'answering') {
          // المرحلة الثانية: السؤال + الاختيارات دون أي كشف للإجابة الصحيحة
          const optRows =
            qRow.type === 'multiple_choice' ? this.getSessionQuestionOptions(qRow.id) : [];
          currentQuestion = {
            id: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            timeLimitSeconds: qRow.time_limit_seconds,
            options: optRows.map((opt) => ({
              id: opt.id,
              optionOrder: opt.option_order,
              optionText: opt.option_text,
              imageUrl: mediaRelativePathToUrl(opt.image_path),
            })),
          };
        } else if (row.current_phase === 'question_results') {
          // المرحلة الثالثة: كشف الإجابة الصحيحة ونتيجة هذا الطالب فقط
          const optRows =
            qRow.type === 'multiple_choice' ? this.getSessionQuestionOptions(qRow.id) : [];
          const correctOpt = optRows.find((opt) => opt.is_correct === 1) ?? null;
          const joinedMidResult =
            !answerRow &&
            Boolean(row.phase_started_at) &&
            participantRow.joined_at >= (row.phase_started_at as string);

          questionResult = {
            sessionQuestionId: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            points: qRow.points,
            correctOptionId: qRow.type === 'multiple_choice' ? (correctOpt?.id ?? null) : null,
            correctBoolean:
              qRow.type === 'true_false' && qRow.correct_boolean !== null
                ? qRow.correct_boolean === 1
                : null,
            options: optRows.map((opt) => ({
              id: opt.id,
              optionOrder: opt.option_order,
              optionText: opt.option_text,
              imageUrl: mediaRelativePathToUrl(opt.image_path),
              isCorrect: opt.is_correct === 1,
            })),
            myResult: {
              answered: Boolean(answerRow),
              selectedOptionId: answerRow?.selected_option_id ?? null,
              selectedBoolean:
                answerRow && answerRow.selected_boolean !== null
                  ? answerRow.selected_boolean === 1
                  : null,
              isCorrect: answerRow ? answerRow.is_correct === 1 : false,
              responseTimeMs: answerRow?.response_time_ms ?? null,
              pointsAwarded: answerRow?.points_awarded ?? 0,
            },
            joinedMidResult,
          };
        }
      }
    }

    if (row.status === 'completed' || row.current_phase === 'final_results') {
      const allParticipants = this.db
        .prepare(`SELECT * FROM live_session_participants WHERE session_id = ?`)
        .all(sessionId) as unknown as ParticipantRow[];
      const leaderboard = this.buildLeaderboard(allParticipants, totalQuestions);
      const mySummary = leaderboard.find((e) => e.participantId === participantId) ?? null;
      finalSummary = {
        mySummary,
        leaderboard,
      };
    }

    return {
      session: publicSession,
      participant: {
        id: participantRow.id,
        sessionId: participantRow.session_id,
        displayName: participantRow.display_name,
        avatarId: participantRow.avatar_id ?? 'avatar_cat',
        connectionStatus: participantRow.connection_status,
        totalScore: participantRow.total_score ?? 0,
        correctCount: participantRow.correct_count ?? 0,
        wrongCount: participantRow.wrong_count ?? 0,
        unansweredCount: Math.max(0, totalQuestions - participantAnswered),
        rankPosition: participantRow.rank_position,
        joinedAt: participantRow.joined_at,
      },
      currentQuestion,
      myAnswer,
      questionResult,
      finalSummary,
    };
  }

  submitStudentAnswer(input: StudentSubmitAnswerRequest): StudentSubmitAnswerResponse {
    if (!input || typeof input !== 'object') {
      throw new LiveSessionValidationError('بيانات الإجابة المرسلة غير صالحة.');
    }

    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    const participantId =
      typeof input.participantId === 'string' ? input.participantId.trim() : '';
    const reconnectToken =
      typeof input.reconnectToken === 'string' ? input.reconnectToken.trim() : '';
    const sessionQuestionId =
      typeof input.sessionQuestionId === 'string' ? input.sessionQuestionId.trim() : '';

    if (!sessionQuestionId) {
      throw new LiveSessionValidationError('معرّف السؤال غير صالح.');
    }

    this.verifyParticipantAuth({ sessionId, participantId, reconnectToken });

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row) {
        throw new LiveSessionNotFoundError();
      }

      if (row.status !== 'running') {
        throw new LiveSessionValidationError('المسابقة ليست قيد التشغيل حالياً.', 409);
      }

      if (row.current_phase === 'question_intro') {
        throw new LiveSessionValidationError(
          'لم يبدأ وقت الإجابة بعد؛ يرجى انتظار ظهور الاختيارات.',
          409
        );
      }

      if (row.current_phase !== 'answering') {
        throw new LiveSessionValidationError('انتهى وقت الإجابة لهذا السؤال.', 409);
      }

      const phaseEndsAtMs = row.phase_ends_at ? Date.parse(row.phase_ends_at) : NaN;
      if (!Number.isFinite(phaseEndsAtMs) || nowMs > phaseEndsAtMs) {
        throw new LiveSessionValidationError('انتهى وقت الإجابة لهذا السؤال.', 409);
      }

      const currentQuestion = this.getSessionQuestionByOrder(
        sessionId,
        row.current_question_index
      );
      if (!currentQuestion || currentQuestion.id !== sessionQuestionId) {
        throw new LiveSessionValidationError(
          'السؤال المرسل لا يطابق السؤال النشط حالياً في الجلسة.',
          409
        );
      }

      const existingAnswer = this.db
        .prepare(
          `SELECT * FROM live_session_answers WHERE session_question_id = ? AND participant_id = ? LIMIT 1`
        )
        .get(currentQuestion.id, participantId) as unknown as AnswerRow | undefined;

      if (existingAnswer && row.allow_answer_change === 0) {
        throw new LiveSessionValidationError(
          'تم استلام إجابتك بالفعل ولا يُسمح بتغيير الإجابة في هذه المسابقة.',
          409
        );
      }

      let selectedOptionId: string | null = null;
      let selectedBooleanInt: number | null = null;
      let isCorrect = false;

      if (currentQuestion.type === 'multiple_choice') {
        const rawOptId =
          typeof input.selectedOptionId === 'string' ? input.selectedOptionId.trim() : '';
        if (!rawOptId) {
          throw new LiveSessionValidationError('يرجى اختيار إحدى الإجابات المتاحة.');
        }
        const matchedOption = this.db
          .prepare(
            `SELECT * FROM live_session_question_options WHERE id = ? AND session_question_id = ? LIMIT 1`
          )
          .get(rawOptId, currentQuestion.id) as unknown as LiveSessionOptionRow | undefined;

        if (!matchedOption) {
          throw new LiveSessionValidationError('الاختيار المحدد لا يتبع لهذا السؤال.');
        }

        selectedOptionId = matchedOption.id;
        isCorrect = matchedOption.is_correct === 1;
      } else {
        if (typeof input.selectedBoolean !== 'boolean') {
          throw new LiveSessionValidationError('يرجى اختيار «صح» أو «خطأ».');
        }
        selectedBooleanInt = input.selectedBoolean ? 1 : 0;
        isCorrect =
          currentQuestion.correct_boolean !== null &&
          (currentQuestion.correct_boolean === 1) === input.selectedBoolean;
      }

      const startedAtIso = row.question_started_at ?? row.phase_started_at ?? nowIso;
      const startedAtMs = Date.parse(startedAtIso);
      const totalTimeMs = currentQuestion.time_limit_seconds * 1000;
      const rawElapsed = Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;
      const responseTimeMs = Math.min(totalTimeMs, rawElapsed);

      let pointsAwarded = 0;
      if (isCorrect) {
        if (row.scoring_mode === 'accuracy_only') {
          pointsAwarded = 1000;
        } else {
          const remainingMs = Math.max(0, totalTimeMs - responseTimeMs);
          pointsAwarded = Math.round(1000 * (remainingMs / totalTimeMs));
        }
      }

      if (existingAnswer) {
        this.db
          .prepare(
            `
            UPDATE live_session_answers
            SET selected_option_id = ?,
                selected_boolean = ?,
                is_correct = ?,
                response_time_ms = ?,
                points_awarded = ?,
                answered_at = ?
            WHERE id = ?
          `
          )
          .run(
            selectedOptionId,
            selectedBooleanInt,
            isCorrect ? 1 : 0,
            responseTimeMs,
            pointsAwarded,
            nowIso,
            existingAnswer.id
          );
      } else {
        this.db
          .prepare(
            `
            INSERT INTO live_session_answers (
              id, session_id, session_question_id, participant_id,
              selected_option_id, selected_boolean, is_correct,
              response_time_ms, points_awarded, answered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            crypto.randomUUID(),
            sessionId,
            currentQuestion.id,
            participantId,
            selectedOptionId,
            selectedBooleanInt,
            isCorrect ? 1 : 0,
            responseTimeMs,
            pointsAwarded,
            nowIso
          );
      }

      this.db
        .prepare(`UPDATE live_session_participants SET last_seen_at = ? WHERE id = ?`)
        .run(nowIso, participantId);

      this.db.exec('COMMIT');

      return {
        received: true,
        updated: Boolean(existingAnswer),
        answer: {
          sessionQuestionId: currentQuestion.id,
          selectedOptionId,
          selectedBoolean:
            selectedBooleanInt === null ? null : selectedBooleanInt === 1,
          answeredAt: nowIso,
        },
      };
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }
  }

  joinSession(input: StudentJoinRequest): StudentJoinResponse {
    if (!input || typeof input !== 'object') {
      throw new LiveSessionValidationError('بيانات الانضمام غير صالحة.');
    }

    const pinCode = normalizePinCode(input.pinCode);
    if (!/^\d{6}$/.test(pinCode)) {
      throw new LiveSessionValidationError('يرجى إدخال رمز PIN صحيح مكوّن من 6 أرقام.');
    }

    const displayName = cleanParticipantDisplayName(input.displayName);
    if (displayName.length < MIN_PARTICIPANT_NAME_LENGTH) {
      throw new LiveSessionValidationError(
        `يرجى كتابة اسم الطالب (${MIN_PARTICIPANT_NAME_LENGTH} أحرف على الأقل).`
      );
    }
    if (displayName.length > MAX_PARTICIPANT_NAME_LENGTH) {
      throw new LiveSessionValidationError(
        `اسم الطالب يتجاوز الحد الأقصى المسموح به (${MAX_PARTICIPANT_NAME_LENGTH} حرفاً).`
      );
    }

    const normalizedName = normalizeParticipantName(displayName);
    if (!normalizedName) {
      throw new LiveSessionValidationError('يرجى إدخال اسم واضح للطالب.');
    }

    const row = this.getSessionRowByPin(pinCode);
    if (!row) {
      throw new LiveSessionNotFoundError('رمز الجلسة غير موجود أو انتهت صلاحيته.');
    }

    if (row.status === 'cancelled') {
      throw new LiveSessionValidationError('تم إلغاء هذه الجلسة ولا يمكن الانضمام إليها.', 409);
    }

    const now = new Date().toISOString();

    const existingParticipantId =
      typeof input.existingParticipantId === 'string'
        ? input.existingParticipantId.trim()
        : '';
    const suppliedReconnectToken =
      typeof input.reconnectToken === 'string' ? input.reconnectToken.trim() : '';

    // التحقق أولاً من استعادة مشارك مسجل مسبقاً في الجلسة (يعمل أثناء الانتظار أو التشغيل أو لعرض النتائج النهائية بعد الانتهاء)
    if (existingParticipantId) {
      const existingById = this.db
        .prepare(`SELECT * FROM live_session_participants WHERE id = ?`)
        .get(existingParticipantId) as unknown as ParticipantRow | undefined;

      if (existingById) {
        if (existingById.session_id !== row.id) {
          throw new LiveSessionValidationError(
            'معرّف المشارك المستخدم لا يتبع لهذه الجلسة.',
            403
          );
        }

        if (
          suppliedReconnectToken &&
          safeTokenEquals(existingById.reconnect_token, suppliedReconnectToken)
        ) {
          this.db
            .prepare(
              `
              UPDATE live_session_participants
              SET connection_status = 'connected', last_seen_at = ?, disconnected_at = NULL
              WHERE id = ?
            `
            )
            .run(now, existingById.id);

          const liveState = this.getStudentLiveState(row.id, existingById.id);
          return {
            session: liveState.session,
            participant: liveState.participant,
            reconnectToken: existingById.reconnect_token,
            reconnected: true,
            liveState,
          };
        }
      }
    }

    // لا يُسمح بانضمام مشارك جديد إلى جلسة منتهية أو جلسة جارية أُغلق فيها الانضمام المتأخر
    if (row.status === 'completed') {
      throw new LiveSessionValidationError('انتهت هذه المسابقة ولا يمكن الانضمام إليها.', 409);
    }

    if (row.status === 'running' && row.allow_late_join === 0) {
      throw new LiveSessionValidationError(
        'تم إغلاق الانضمام لأن المسابقة قد بدأت بالفعل ولا يُسمح بالانضمام المتأخر.',
        409
      );
    }

    const duplicate = this.db
      .prepare(
        `
        SELECT id FROM live_session_participants
        WHERE session_id = ? AND normalized_name = ?
        LIMIT 1
      `
      )
      .get(row.id, normalizedName) as { id: string } | undefined;

    if (duplicate) {
      throw new LiveSessionValidationError(
        'يوجد طالب منضم بهذا الاسم بالفعل في هذه الجلسة. يرجى اختيار اسم مختلف أو إضافة اسم العائلة.',
        409
      );
    }

    const VALID_AVATAR_IDS = new Set([
      'avatar_cat',
      'avatar_robot',
      'avatar_fox',
      'avatar_bear',
      'avatar_penguin',
      'avatar_lion',
      'avatar_owl',
      'avatar_alien',
      'avatar_koala',
      'avatar_panda',
      'avatar_tiger',
      'avatar_bunny',
    ]);
    const requestedAvatarId =
      typeof input.avatarId === 'string' ? input.avatarId.trim() : '';
    const avatarId = VALID_AVATAR_IDS.has(requestedAvatarId)
      ? requestedAvatarId
      : 'avatar_cat';

    const participantId = crypto.randomUUID();
    const reconnectToken = crypto.randomBytes(24).toString('hex');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          INSERT INTO live_session_participants (
            id, session_id, display_name, normalized_name, reconnect_token,
            connection_status, total_score, correct_count, wrong_count,
            total_response_time_ms, rank_position,
            joined_at, last_seen_at, disconnected_at, avatar_id
          ) VALUES (?, ?, ?, ?, ?, 'connected', 0, 0, 0, 0, NULL, ?, ?, NULL, ?)
        `
        )
        .run(
          participantId,
          row.id,
          displayName,
          normalizedName,
          reconnectToken,
          now,
          now,
          avatarId
        );
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE constraint failed')) {
        throw new LiveSessionValidationError(
          'يوجد طالب منضم بهذا الاسم بالفعل في هذه الجلسة.',
          409
        );
      }
      throw error;
    }

    const liveState = this.getStudentLiveState(row.id, participantId);
    return {
      session: liveState.session,
      participant: liveState.participant,
      reconnectToken,
      reconnected: false,
      liveState,
    };
  }

  verifyParticipantAuth(options: {
    sessionId: string;
    participantId: string;
    reconnectToken: string;
  }): {
    session: StudentPublicSessionInfo;
    participant: LiveSessionParticipant;
  } {
    const cleanSessionId = typeof options.sessionId === 'string' ? options.sessionId.trim() : '';
    const cleanParticipantId =
      typeof options.participantId === 'string' ? options.participantId.trim() : '';
    const cleanToken =
      typeof options.reconnectToken === 'string' ? options.reconnectToken.trim() : '';

    if (!cleanSessionId || !cleanParticipantId || !cleanToken) {
      throw new LiveSessionValidationError('بيانات التحقق من المشارك غير مكتملة.', 401);
    }

    const sessionRow = this.getSessionRowById(cleanSessionId);
    if (!sessionRow) {
      throw new LiveSessionNotFoundError();
    }

    const participantRow = this.db
      .prepare(`SELECT * FROM live_session_participants WHERE id = ?`)
      .get(cleanParticipantId) as unknown as ParticipantRow | undefined;

    if (!participantRow) {
      throw new LiveSessionValidationError('المشارك غير مسجل في هذه الجلسة.', 404);
    }

    if (participantRow.session_id !== cleanSessionId) {
      throw new LiveSessionValidationError(
        'مرفوض: معرّف المشارك لا ينتمي إلى هذه الجلسة.',
        403
      );
    }

    if (!safeTokenEquals(participantRow.reconnect_token, cleanToken)) {
      throw new LiveSessionValidationError('رمز التحقق الخاص بالمشارك غير صالح.', 403);
    }

    const totalQuestions = sessionRow.question_count ?? 0;
    return {
      session: mapToStudentPublicInfo(sessionRow),
      participant: mapParticipantRow(participantRow, totalQuestions),
    };
  }

  verifyTeacherHostToken(sessionId: string, hostToken: string): boolean {
    const cleanSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
    const cleanHostToken = typeof hostToken === 'string' ? hostToken.trim() : '';
    if (!cleanSessionId || !cleanHostToken) return false;

    const row = this.db
      .prepare(`SELECT host_token FROM live_sessions WHERE id = ?`)
      .get(cleanSessionId) as { host_token: string } | undefined;

    if (!row) return false;
    return safeTokenEquals(row.host_token, cleanHostToken);
  }

  setParticipantConnectionStatus(
    sessionId: string,
    participantId: string,
    status: ParticipantConnectionStatus
  ): LiveSessionParticipant | null {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `
        UPDATE live_session_participants
        SET connection_status = ?,
            last_seen_at = ?,
            disconnected_at = CASE WHEN ? = 'disconnected' THEN ? ELSE NULL END
        WHERE id = ? AND session_id = ?
      `
      )
      .run(status, now, status, now, participantId, sessionId);

    if (res.changes === 0) return null;

    const sessionRow = this.getSessionRowById(sessionId);
    const totalQuestions = sessionRow?.question_count ?? 0;
    const row = this.db
      .prepare(`SELECT * FROM live_session_participants WHERE id = ? AND session_id = ?`)
      .get(participantId, sessionId) as unknown as ParticipantRow | undefined;

    return row ? mapParticipantRow(row, totalQuestions) : null;
  }

  markAllParticipantsDisconnectedOnBoot(): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE live_session_participants
        SET connection_status = 'disconnected',
            disconnected_at = COALESCE(disconnected_at, ?)
        WHERE connection_status = 'connected'
          AND session_id IN (SELECT id FROM live_sessions WHERE status IN ('waiting', 'running'))
      `
      )
      .run(now);
  }

  listRunningSessionStatesForRecovery(): Array<{
    id: string;
    currentPhase: LiveQuestionPhase;
    currentQuestionIndex: number;
    phaseEndsAt: string | null;
    advanceMode: LiveAdvanceMode;
  }> {
    const rows = this.db
      .prepare(
        `
        SELECT id, current_phase, current_question_index, phase_ends_at, advance_mode
        FROM live_sessions
        WHERE status = 'running'
      `
      )
      .all() as Array<{
      id: string;
      current_phase: LiveQuestionPhase;
      current_question_index: number;
      phase_ends_at: string | null;
      advance_mode: LiveAdvanceMode;
    }>;

    return rows.map((row) => ({
      id: row.id,
      currentPhase: row.current_phase,
      currentQuestionIndex: row.current_question_index,
      phaseEndsAt: row.phase_ends_at,
      advanceMode: row.advance_mode,
    }));
  }
}

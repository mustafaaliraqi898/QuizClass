import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  LiveSessionListResponse,
  LiveSessionParticipant,
  LiveSessionStatus,
  LiveSessionSummary,
  ParticipantConnectionStatus,
  StudentJoinRequest,
  StudentJoinResponse,
  StudentPublicSessionInfo,
  TeacherLiveSessionDetails,
} from '../../src/types/liveSession.ts';
import type { QuizQuestionSnapshot } from '../../src/types/quiz.ts';
import type { StoragePaths } from '../config/storagePaths.ts';
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
  question_started_at: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  question_count?: number;
  participant_count?: number;
  connected_participant_count?: number;
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
  rank_position: number | null;
  joined_at: string;
  last_seen_at: string;
  disconnected_at: string | null;
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

const MIN_PARTICIPANT_NAME_LENGTH = 2;
const MAX_PARTICIPANT_NAME_LENGTH = 40;

/**
 * يحوّل الأرقام العربية/الفارسية إلى أرقام إنجليزية قياسية ويزيل الفراغات والرموز غير الرقمية.
 */
export function normalizePinCode(rawPin: unknown): string {
  if (typeof rawPin !== 'string' && typeof rawPin !== 'number') {
    return '';
  }
  const str = String(rawPin)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, '')
    .trim();
  return str;
}

export function cleanParticipantDisplayName(rawName: unknown): string {
  if (typeof rawName !== 'string') return '';
  return rawName
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يطبّع اسم الطالب لمنع التكرار الناتج عن اختلاف المسافات أو التشكيل أو الألف أو حالة الأحرف اللاتينية.
 */
export function normalizeParticipantName(rawName: string): string {
  const collapsed = cleanParticipantDisplayName(rawName);
  return collapsed
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .toLocaleLowerCase('en-US');
}

function mapParticipantRow(row: ParticipantRow): LiveSessionParticipant {
  return {
    id: row.id,
    sessionId: row.session_id,
    displayName: row.display_name,
    connectionStatus: row.connection_status,
    totalScore: row.total_score,
    correctCount: row.correct_count,
    rankPosition: row.rank_position,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    disconnectedAt: row.disconnected_at,
  };
}

function mapSessionSummaryRow(row: LiveSessionRow): LiveSessionSummary {
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
    connectedParticipantCount: row.connected_participant_count ?? 0,
    currentQuestionIndex: row.current_question_index,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
  };
}

function mapToStudentPublicInfo(row: LiveSessionRow): StudentPublicSessionInfo {
  return {
    sessionId: row.id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
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
        difficulty, time_limit_seconds, points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ORDER BY joined_at ASC
      `
      )
      .all(sessionId) as unknown as ParticipantRow[];

    const port = options?.port ?? Number(process.env.PORT ?? 3000);
    const networkInfo = await resolveSessionNetworkOptions({
      pinCode: row.pin_code,
      port,
      requestOrigin: options?.requestOrigin,
    });

    return {
      ...mapSessionSummaryRow(row),
      hostToken: row.host_token,
      participants: participantRows.map(mapParticipantRow),
      networkAddresses: networkInfo.networkAddresses,
      primaryJoinUrl: networkInfo.primaryJoinUrl,
      primaryQrDataUrl: networkInfo.primaryQrDataUrl,
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

    return {
      activeSession,
      recentSessions: recentRows.map(mapSessionSummaryRow),
    };
  }

  async createSession(
    quizId: string,
    options?: { port?: number; requestOrigin?: string | null }
  ): Promise<TeacherLiveSessionDetails> {
    const cleanQuizId = typeof quizId === 'string' ? quizId.trim() : '';
    if (!cleanQuizId) {
      throw new LiveSessionValidationError('معرّف المسابقة غير صالح.');
    }

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

    // منع جلستين متعارضتين لنفس المسابقة
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
            question_started_at, created_at, started_at, ended_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', -1, NULL, ?, NULL, NULL, ?)
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

  async startSession(
    sessionId: string,
    options?: { hostToken?: string; port?: number; requestOrigin?: string | null }
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

    const quiz = this.quizRepo.getQuizById(row.quiz_id);
    if (quiz.questions.length === 0) {
      throw new LiveSessionValidationError(
        'تعذر بدء الجلسة لعدم وجود أسئلة صالحة في المسابقة.'
      );
    }

    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      // إعادة تثبيت نسخة الأسئلة عند البدء الفعلي وتحديث حالة المسابقة إلى started
      this.db.prepare(`DELETE FROM live_session_questions WHERE session_id = ?`).run(sessionId);
      this.insertFrozenSessionQuestions(sessionId, quiz.questions);

      const updateSessionRes = this.db
        .prepare(
          `
          UPDATE live_sessions
          SET quiz_title = ?, quiz_subject = ?, quiz_grade = ?,
              status = 'running', started_at = ?, updated_at = ?
          WHERE id = ? AND status = 'waiting'
        `
        )
        .run(quiz.title, quiz.subject, quiz.grade, now, now, sessionId);

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
      throw new LiveSessionValidationError(
        'يمكن إكمال الجلسة فقط بعد بدئها.',
        409
      );
    }

    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          UPDATE live_sessions
          SET status = 'completed', ended_at = ?, updated_at = ?
          WHERE id = ? AND status = 'running'
        `
        )
        .run(now, now, sessionId);

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
          SET status = 'cancelled', ended_at = ?, updated_at = ?
          WHERE id = ? AND status IN ('waiting', 'running')
        `
        )
        .run(now, now, sessionId);

      // إذا لم تكن المسابقة قد بدأت في هذه الجلسة أو أي جلسة سابقة، تبقى حالتها draft قابلة للتعديل والمزامنة
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

    return mapToStudentPublicInfo(row);
  }

  getStudentPublicSessionById(sessionId: string): StudentPublicSessionInfo {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    return mapToStudentPublicInfo(row);
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

    if (row.status === 'completed') {
      throw new LiveSessionValidationError('انتهت هذه المسابقة ولا يمكن الانضمام إليها.', 409);
    }

    if (row.status === 'cancelled') {
      throw new LiveSessionValidationError('تم إلغاء هذه الجلسة ولا يمكن الانضمام إليها.', 409);
    }

    const now = new Date().toISOString();

    // التحقق من محاولة إعادة الاتصال بنفس الجلسة وعدم قبول معرف مشارك تابع لجلسة أخرى
    const existingParticipantId =
      typeof input.existingParticipantId === 'string'
        ? input.existingParticipantId.trim()
        : '';
    const suppliedReconnectToken =
      typeof input.reconnectToken === 'string' ? input.reconnectToken.trim() : '';

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

          const refreshedRow = this.getSessionRowById(row.id) ?? row;
          return {
            session: mapToStudentPublicInfo(refreshedRow),
            participant: {
              id: existingById.id,
              sessionId: existingById.session_id,
              displayName: existingById.display_name,
              connectionStatus: 'connected',
              joinedAt: existingById.joined_at,
            },
            reconnectToken: existingById.reconnect_token,
            reconnected: true,
          };
        }
      }
    }

    // منع تكرار اسم الطالب داخل الجلسة (مع معالجة المسافات وتشكيل/همزات وحالة الأحرف)
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

    const participantId = crypto.randomUUID();
    const reconnectToken = crypto.randomBytes(24).toString('hex');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          INSERT INTO live_session_participants (
            id, session_id, display_name, normalized_name, reconnect_token,
            connection_status, total_score, correct_count, rank_position,
            joined_at, last_seen_at, disconnected_at
          ) VALUES (?, ?, ?, ?, ?, 'connected', 0, 0, NULL, ?, ?, NULL)
        `
        )
        .run(
          participantId,
          row.id,
          displayName,
          normalizedName,
          reconnectToken,
          now,
          now
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

    const refreshedRow = this.getSessionRowById(row.id) ?? row;
    return {
      session: mapToStudentPublicInfo(refreshedRow),
      participant: {
        id: participantId,
        sessionId: row.id,
        displayName,
        connectionStatus: 'connected',
        joinedAt: now,
      },
      reconnectToken,
      reconnected: false,
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

    return {
      session: mapToStudentPublicInfo(sessionRow),
      participant: mapParticipantRow(participantRow),
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

    const row = this.db
      .prepare(`SELECT * FROM live_session_participants WHERE id = ? AND session_id = ?`)
      .get(participantId, sessionId) as unknown as ParticipantRow | undefined;

    return row ? mapParticipantRow(row) : null;
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
}

import crypto from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { LiveAdvanceMode, LiveScoringMode } from '../../src/types/liveSession.ts';
import type { QuestionDifficulty, QuestionType } from '../../src/types/questionBank.ts';
import type {
  ArchivedParticipantDetailsResponse,
  ArchivedParticipantQuestionBreakdown,
  ArchivedParticipantRecord,
  ArchivedQuestionOption,
  ArchivedResultsFilterParams,
  ArchivedResultsListResponse,
  ArchivedResultSessionDetails,
  ArchivedSessionSummary,
} from '../../src/types/resultsArchive.ts';
import { mediaRelativePathToUrl } from './mediaStorageService.ts';

interface LiveSessionSourceRow {
  id: string;
  quiz_id: string | null;
  quiz_title: string;
  quiz_subject: string | null;
  quiz_grade: string | null;
  pin_code: string;
  status: string;
  scoring_mode: LiveScoringMode;
  advance_mode: LiveAdvanceMode;
  allow_answer_change: number;
  allow_late_join: number;
  question_intro_seconds: number;
  auto_advance_seconds: number;
  full_screen_mode: number;
  started_at: string | null;
  ended_at: string | null;
}

interface LiveQuestionSourceRow {
  id: string;
  session_id: string;
  source_quiz_question_id: string | null;
  source_question_id: string | null;
  question_order: number;
  type: QuestionType;
  prompt: string;
  image_path: string | null;
  correct_boolean: number | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  time_limit_seconds: number;
  points: number;
}

interface LiveOptionSourceRow {
  id: string;
  session_question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

interface LiveParticipantSourceRow {
  id: string;
  session_id: string;
  display_name: string;
  avatar_id: string;
  total_score: number;
  correct_count: number;
  wrong_count: number;
  total_response_time_ms: number;
  rank_position: number | null;
  joined_at: string;
}

interface LiveAnswerSourceRow {
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

interface ArchivedSessionRow {
  id: string;
  live_session_id: string;
  quiz_id: string | null;
  quiz_title: string;
  quiz_subject: string | null;
  quiz_grade: string | null;
  pin_code: string;
  status: 'completed';
  scoring_mode: LiveScoringMode;
  advance_mode: LiveAdvanceMode;
  allow_answer_change: number;
  allow_late_join: number;
  question_intro_seconds: number;
  auto_advance_seconds: number;
  full_screen_mode: number;
  question_count: number;
  participant_count: number;
  started_at: string | null;
  ended_at: string | null;
  archived_at: string;
}

interface ArchivedQuestionRow {
  id: string;
  archive_id: string;
  question_order: number;
  type: QuestionType;
  prompt: string;
  image_path: string | null;
  correct_boolean: number | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  time_limit_seconds: number;
  points: number;
}

interface ArchivedOptionRow {
  id: string;
  archive_question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

interface ArchivedParticipantRow {
  id: string;
  archive_id: string;
  source_participant_id: string | null;
  display_name: string;
  avatar_id: string;
  total_score: number;
  rank_position: number | null;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  accuracy_percent: number | null;
  total_response_time_ms: number;
  joined_at: string | null;
}

interface ArchivedAnswerRow {
  id: string;
  archive_id: string;
  archive_question_id: string;
  archive_participant_id: string;
  selected_archive_option_id: string | null;
  selected_option_text_snapshot: string | null;
  selected_boolean: number | null;
  is_correct: number;
  response_time_ms: number | null;
  points_awarded: number;
  answered_at: string;
}

export class ResultsArchiveValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ResultsArchiveValidationError';
    this.statusCode = statusCode;
  }
}

export class ResultsArchiveNotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'لم يتم العثور على نتيجة المسابقة المطلوبة في الأرشيف.') {
    super(message);
    this.name = 'ResultsArchiveNotFoundError';
  }
}

function escapeSqlLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function computeAccuracyPercent(correctCount: number, questionCount: number): number | null {
  if (!Number.isFinite(questionCount) || questionCount <= 0) {
    return null;
  }
  if (!Number.isFinite(correctCount) || correctCount < 0) {
    return null;
  }
  const boundedCorrect = Math.min(correctCount, questionCount);
  return Math.round((boundedCorrect / questionCount) * 1000) / 10;
}

function mapArchivedSessionRow(row: ArchivedSessionRow): ArchivedSessionSummary {
  return {
    id: row.id,
    liveSessionId: row.live_session_id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: 'completed',
    scoringMode: row.scoring_mode,
    advanceMode: row.advance_mode,
    allowAnswerChange: row.allow_answer_change === 1,
    allowLateJoin: row.allow_late_join === 1,
    questionIntroSeconds: row.question_intro_seconds,
    autoAdvanceSeconds: row.auto_advance_seconds,
    fullScreenMode: row.full_screen_mode === 1,
    questionCount: Number(row.question_count ?? 0),
    participantCount: Number(row.participant_count ?? 0),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    archivedAt: row.archived_at,
  };
}

function mapArchivedParticipantRow(row: ArchivedParticipantRow): ArchivedParticipantRecord {
  return {
    id: row.id,
    archiveId: row.archive_id,
    sourceParticipantId: row.source_participant_id,
    displayName: row.display_name,
    avatarId: row.avatar_id || 'avatar_cat',
    totalScore: Number(row.total_score ?? 0),
    rankPosition:
      row.rank_position !== null && row.rank_position !== undefined
        ? Number(row.rank_position)
        : null,
    correctCount: Number(row.correct_count ?? 0),
    wrongCount: Number(row.wrong_count ?? 0),
    unansweredCount: Number(row.unanswered_count ?? 0),
    accuracyPercent:
      row.accuracy_percent !== null && row.accuracy_percent !== undefined
        ? Number(row.accuracy_percent)
        : null,
    totalResponseTimeMs: Number(row.total_response_time_ms ?? 0),
    joinedAt: row.joined_at,
  };
}

function mapArchivedOptionRow(row: ArchivedOptionRow): ArchivedQuestionOption {
  return {
    id: row.id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1,
  };
}

/**
 * أرشفة جلسة مسابقة مباشرة مكتملة داخل المعاملة الحالية في SQLite بشكل ذري ومتكرر الأمان (Idempotent).
 * يجب استدعاؤها داخل BEGIN IMMEDIATE ... COMMIT لضمان الحفظ المتزامن مع إكمال الجلسة أو التراجع الكامل عند أي خطأ.
 */
export function archiveCompletedSessionTx(db: DatabaseSync, sessionId: string): boolean {
  const cleanSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!cleanSessionId) return false;

  const existing = db
    .prepare(`SELECT id FROM archived_sessions WHERE live_session_id = ? LIMIT 1`)
    .get(cleanSessionId) as { id: string } | undefined;

  if (existing) {
    return false;
  }

  const sessionRow = db
    .prepare(
      `
      SELECT
        id, quiz_id, quiz_title, quiz_subject, quiz_grade, pin_code, status,
        scoring_mode, advance_mode, allow_answer_change, allow_late_join,
        question_intro_seconds, auto_advance_seconds, full_screen_mode,
        started_at, ended_at
      FROM live_sessions
      WHERE id = ?
      LIMIT 1
    `
    )
    .get(cleanSessionId) as unknown as LiveSessionSourceRow | undefined;

  if (!sessionRow || sessionRow.status !== 'completed') {
    return false;
  }

  const questionRows = db
    .prepare(
      `
      SELECT
        id, session_id, source_quiz_question_id, source_question_id,
        question_order, type, prompt, image_path, correct_boolean,
        subject, grade, topic, difficulty, time_limit_seconds, points
      FROM live_session_questions
      WHERE session_id = ?
      ORDER BY question_order ASC
    `
    )
    .all(cleanSessionId) as unknown as LiveQuestionSourceRow[];

  const participantRows = db
    .prepare(
      `
      SELECT
        id, session_id, display_name, avatar_id, total_score,
        correct_count, wrong_count, total_response_time_ms,
        rank_position, joined_at
      FROM live_session_participants
      WHERE session_id = ?
      ORDER BY COALESCE(rank_position, 999999) ASC, total_score DESC, joined_at ASC
    `
    )
    .all(cleanSessionId) as unknown as LiveParticipantSourceRow[];

  const answerRows = db
    .prepare(
      `
      SELECT
        id, session_id, session_question_id, participant_id,
        selected_option_id, selected_boolean, is_correct,
        response_time_ms, points_awarded, answered_at
      FROM live_session_answers
      WHERE session_id = ?
    `
    )
    .all(cleanSessionId) as unknown as LiveAnswerSourceRow[];

  const optionRowsBySourceQuestionId = new Map<string, LiveOptionSourceRow[]>();
  if (questionRows.length > 0) {
    const placeholders = questionRows.map(() => '?').join(', ');
    const optionRows = db
      .prepare(
        `
        SELECT id, session_question_id, option_order, option_text, image_path, is_correct
        FROM live_session_question_options
        WHERE session_question_id IN (${placeholders})
        ORDER BY option_order ASC
      `
      )
      .all(...questionRows.map((q) => q.id)) as unknown as LiveOptionSourceRow[];

    for (const opt of optionRows) {
      const list = optionRowsBySourceQuestionId.get(opt.session_question_id) ?? [];
      list.push(opt);
      optionRowsBySourceQuestionId.set(opt.session_question_id, list);
    }
  }

  const archiveId = crypto.randomUUID();
  const archivedAt = new Date().toISOString();
  const questionCount = questionRows.length;
  const participantCount = participantRows.length;

  db.prepare(
    `
    INSERT INTO archived_sessions (
      id, live_session_id, quiz_id, quiz_title, quiz_subject, quiz_grade,
      pin_code, status, scoring_mode, advance_mode, allow_answer_change,
      allow_late_join, question_intro_seconds, auto_advance_seconds,
      full_screen_mode, question_count, participant_count,
      started_at, ended_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    archiveId,
    sessionRow.id,
    sessionRow.quiz_id,
    sessionRow.quiz_title,
    sessionRow.quiz_subject,
    sessionRow.quiz_grade,
    sessionRow.pin_code,
    sessionRow.scoring_mode ?? 'speed_and_accuracy',
    sessionRow.advance_mode ?? 'auto',
    sessionRow.allow_answer_change ? 1 : 0,
    sessionRow.allow_late_join ? 1 : 0,
    Number(sessionRow.question_intro_seconds ?? 5),
    Number(sessionRow.auto_advance_seconds ?? 5),
    sessionRow.full_screen_mode ? 1 : 0,
    questionCount,
    participantCount,
    sessionRow.started_at,
    sessionRow.ended_at,
    archivedAt
  );

  const insertQuestionStmt = db.prepare(
    `
    INSERT INTO archived_session_questions (
      id, archive_id, source_session_question_id, source_quiz_question_id,
      source_question_id, question_order, type, prompt, image_path,
      correct_boolean, subject, grade, topic, difficulty,
      time_limit_seconds, points
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );

  const insertOptionStmt = db.prepare(
    `
    INSERT INTO archived_session_options (
      id, archive_question_id, source_option_id, option_order,
      option_text, image_path, is_correct
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  );

  const questionIdMap = new Map<string, string>();
  const optionSnapshotMap = new Map<string, { archiveOptionId: string; optionText: string | null }>();

  for (const q of questionRows) {
    const archiveQuestionId = crypto.randomUUID();
    questionIdMap.set(q.id, archiveQuestionId);

    insertQuestionStmt.run(
      archiveQuestionId,
      archiveId,
      q.id,
      q.source_quiz_question_id,
      q.source_question_id,
      q.question_order,
      q.type,
      q.prompt,
      q.image_path,
      q.correct_boolean,
      q.subject,
      q.grade,
      q.topic,
      q.difficulty,
      q.time_limit_seconds,
      Number(q.points ?? 1000)
    );

    const optList = optionRowsBySourceQuestionId.get(q.id) ?? [];
    for (const opt of optList) {
      const archiveOptionId = crypto.randomUUID();
      optionSnapshotMap.set(opt.id, {
        archiveOptionId,
        optionText: opt.option_text,
      });

      insertOptionStmt.run(
        archiveOptionId,
        archiveQuestionId,
        opt.id,
        opt.option_order,
        opt.option_text,
        opt.image_path,
        opt.is_correct ? 1 : 0
      );
    }
  }

  const insertParticipantStmt = db.prepare(
    `
    INSERT INTO archived_session_participants (
      id, archive_id, source_participant_id, display_name, avatar_id,
      total_score, rank_position, correct_count, wrong_count,
      unanswered_count, accuracy_percent, total_response_time_ms, joined_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );

  const participantIdMap = new Map<string, string>();

  for (const p of participantRows) {
    const archiveParticipantId = crypto.randomUUID();
    participantIdMap.set(p.id, archiveParticipantId);

    const correctCount = Number(p.correct_count ?? 0);
    const wrongCount = Number(p.wrong_count ?? 0);
    const unansweredCount = Math.max(0, questionCount - (correctCount + wrongCount));
    const accuracyPercent = computeAccuracyPercent(correctCount, questionCount);

    insertParticipantStmt.run(
      archiveParticipantId,
      archiveId,
      p.id,
      p.display_name,
      p.avatar_id || 'avatar_cat',
      Number(p.total_score ?? 0),
      p.rank_position !== null && p.rank_position !== undefined ? Number(p.rank_position) : null,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracyPercent,
      Number(p.total_response_time_ms ?? 0),
      p.joined_at
    );
  }

  const insertAnswerStmt = db.prepare(
    `
    INSERT INTO archived_session_answers (
      id, archive_id, archive_question_id, archive_participant_id,
      selected_archive_option_id, selected_option_text_snapshot,
      selected_boolean, is_correct, response_time_ms, points_awarded, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );

  for (const ans of answerRows) {
    const archiveQuestionId = questionIdMap.get(ans.session_question_id);
    const archiveParticipantId = participantIdMap.get(ans.participant_id);
    if (!archiveQuestionId || !archiveParticipantId) {
      continue;
    }

    const selectedOptSnap = ans.selected_option_id
      ? optionSnapshotMap.get(ans.selected_option_id)
      : undefined;

    insertAnswerStmt.run(
      crypto.randomUUID(),
      archiveId,
      archiveQuestionId,
      archiveParticipantId,
      selectedOptSnap?.archiveOptionId ?? null,
      selectedOptSnap?.optionText ?? null,
      ans.selected_boolean,
      ans.is_correct ? 1 : 0,
      ans.response_time_ms,
      Number(ans.points_awarded ?? 0),
      ans.answered_at
    );
  }

  return true;
}

/**
 * ترحيل/أرشفة الجلسات المكتملة مسبقاً التي لا تملك سجلاً في archived_sessions دون حذف أو تلفيق أي بيانات.
 */
export function backfillLegacyCompletedSessions(db: DatabaseSync): number {
  const missingRows = db
    .prepare(
      `
      SELECT ls.id
      FROM live_sessions ls
      WHERE ls.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM archived_sessions a WHERE a.live_session_id = ls.id
        )
      ORDER BY COALESCE(ls.ended_at, ls.updated_at, ls.created_at) ASC
    `
    )
    .all() as Array<{ id: string }>;

  if (missingRows.length === 0) {
    return 0;
  }

  let archivedCount = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of missingRows) {
      if (archiveCompletedSessionTx(db, row.id)) {
        archivedCount += 1;
      }
    }
    db.exec('COMMIT');
    return archivedCount;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback failure
    }
    throw error;
  }
}

export class SqliteResultsArchiveRepository {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  archiveCompletedSessionAtomic(sessionId: string): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const created = archiveCompletedSessionTx(this.db, sessionId);
      this.db.exec('COMMIT');
      return created;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw error;
    }
  }

  listArchivedResults(filters: ArchivedResultsFilterParams = {}): ArchivedResultsListResponse {
    const whereClauses: string[] = [];
    const params: SQLInputValue[] = [];

    const search = typeof filters.search === 'string' ? filters.search.trim() : '';
    if (search.length > 0) {
      const pattern = `%${escapeSqlLikePattern(search)}%`;
      whereClauses.push(
        `(quiz_title LIKE ? ESCAPE '\\' OR COALESCE(quiz_subject, '') LIKE ? ESCAPE '\\' OR COALESCE(quiz_grade, '') LIKE ? ESCAPE '\\' OR pin_code LIKE ? ESCAPE '\\')`
      );
      params.push(pattern, pattern, pattern, pattern);
    }

    const exactDate = typeof filters.date === 'string' ? filters.date.trim() : '';
    if (exactDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exactDate)) {
        throw new ResultsArchiveValidationError('صيغة التاريخ غير صالحة. استخدم YYYY-MM-DD.');
      }
      whereClauses.push(`date(COALESCE(ended_at, archived_at), 'localtime') = ?`);
      params.push(exactDate);
    }

    const dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom.trim() : '';
    if (dateFrom) {
      whereClauses.push(`COALESCE(ended_at, archived_at) >= ?`);
      params.push(dateFrom);
    }

    const dateTo = typeof filters.dateTo === 'string' ? filters.dateTo.trim() : '';
    if (dateTo) {
      const upperBound = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo;
      whereClauses.push(`COALESCE(ended_at, archived_at) <= ?`);
      params.push(upperBound);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderDirection = filters.sort === 'oldest' ? 'ASC' : 'DESC';

    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM archived_sessions
        ${whereSql}
        ORDER BY COALESCE(ended_at, archived_at) ${orderDirection}, archived_at ${orderDirection}
      `
      )
      .all(...params) as unknown as ArchivedSessionRow[];

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM archived_sessions`)
      .get() as { cnt: number } | undefined;

    return {
      archives: rows.map(mapArchivedSessionRow),
      totalCount: Number(totalRow?.cnt ?? rows.length),
    };
  }

  getArchivedResultById(archiveId: string): ArchivedResultSessionDetails {
    const cleanArchiveId = typeof archiveId === 'string' ? archiveId.trim() : '';
    if (!cleanArchiveId) {
      throw new ResultsArchiveValidationError('معرّف أرشيف النتيجة غير صالح.');
    }

    const sessionRow = this.db
      .prepare(`SELECT * FROM archived_sessions WHERE id = ? LIMIT 1`)
      .get(cleanArchiveId) as unknown as ArchivedSessionRow | undefined;

    if (!sessionRow) {
      throw new ResultsArchiveNotFoundError();
    }

    const participantRows = this.db
      .prepare(
        `
        SELECT *
        FROM archived_session_participants
        WHERE archive_id = ?
        ORDER BY COALESCE(rank_position, 999999) ASC, total_score DESC, COALESCE(joined_at, '') ASC, id ASC
      `
      )
      .all(cleanArchiveId) as unknown as ArchivedParticipantRow[];

    return {
      session: mapArchivedSessionRow(sessionRow),
      participants: participantRows.map(mapArchivedParticipantRow),
    };
  }

  getArchivedParticipantDetails(
    archiveId: string,
    participantRowId: string
  ): ArchivedParticipantDetailsResponse {
    const cleanArchiveId = typeof archiveId === 'string' ? archiveId.trim() : '';
    const cleanParticipantId =
      typeof participantRowId === 'string' ? participantRowId.trim() : '';

    if (!cleanArchiveId || !cleanParticipantId) {
      throw new ResultsArchiveValidationError('معرّف الجلسة أو المشارك غير صالح.');
    }

    const sessionRow = this.db
      .prepare(`SELECT * FROM archived_sessions WHERE id = ? LIMIT 1`)
      .get(cleanArchiveId) as unknown as ArchivedSessionRow | undefined;

    if (!sessionRow) {
      throw new ResultsArchiveNotFoundError();
    }

    const participantRow = this.db
      .prepare(
        `
        SELECT *
        FROM archived_session_participants
        WHERE id = ? AND archive_id = ?
        LIMIT 1
      `
      )
      .get(cleanParticipantId, cleanArchiveId) as unknown as ArchivedParticipantRow | undefined;

    if (!participantRow) {
      throw new ResultsArchiveNotFoundError('لم يتم العثور على بيانات المشارك في هذا الأرشيف.');
    }

    const questionRows = this.db
      .prepare(
        `
        SELECT *
        FROM archived_session_questions
        WHERE archive_id = ?
        ORDER BY question_order ASC
      `
      )
      .all(cleanArchiveId) as unknown as ArchivedQuestionRow[];

    const optionsByQuestionId = new Map<string, ArchivedQuestionOption[]>();
    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => '?').join(', ');
      const optionRows = this.db
        .prepare(
          `
          SELECT *
          FROM archived_session_options
          WHERE archive_question_id IN (${placeholders})
          ORDER BY option_order ASC
        `
        )
        .all(...questionRows.map((q) => q.id)) as unknown as ArchivedOptionRow[];

      for (const opt of optionRows) {
        const list = optionsByQuestionId.get(opt.archive_question_id) ?? [];
        list.push(mapArchivedOptionRow(opt));
        optionsByQuestionId.set(opt.archive_question_id, list);
      }
    }

    const answerRows = this.db
      .prepare(
        `
        SELECT *
        FROM archived_session_answers
        WHERE archive_id = ? AND archive_participant_id = ?
      `
      )
      .all(cleanArchiveId, cleanParticipantId) as unknown as ArchivedAnswerRow[];

    const answerByQuestionId = new Map(
      answerRows.map((ans) => [ans.archive_question_id, ans])
    );

    const questions: ArchivedParticipantQuestionBreakdown[] = questionRows.map((qRow) => {
      const options = optionsByQuestionId.get(qRow.id) ?? [];
      const correctOption = options.find((opt) => opt.isCorrect) ?? null;
      const answer = answerByQuestionId.get(qRow.id);

      let selectedOptionText: string | null = null;
      let selectedOptionImageUrl: string | null = null;
      if (answer) {
        if (qRow.type === 'multiple_choice') {
          const matchedOpt = answer.selected_archive_option_id
            ? options.find((opt) => opt.id === answer.selected_archive_option_id)
            : undefined;
          selectedOptionText =
            matchedOpt?.optionText ?? answer.selected_option_text_snapshot ?? null;
          selectedOptionImageUrl = matchedOpt?.imageUrl ?? null;
        }
      }

      const outcome: ArchivedParticipantQuestionBreakdown['outcome'] = !answer
        ? 'unanswered'
        : answer.is_correct === 1
          ? 'correct'
          : 'wrong';

      return {
        archiveQuestionId: qRow.id,
        questionOrder: qRow.question_order,
        type: qRow.type,
        prompt: qRow.prompt,
        imageUrl: mediaRelativePathToUrl(qRow.image_path),
        points: Number(qRow.points ?? 1000),
        timeLimitSeconds: qRow.time_limit_seconds,
        subject: qRow.subject,
        grade: qRow.grade,
        topic: qRow.topic,
        difficulty: qRow.difficulty,
        options,
        correctBoolean:
          qRow.correct_boolean === null || qRow.correct_boolean === undefined
            ? null
            : qRow.correct_boolean === 1,
        correctOptionId: correctOption?.id ?? null,
        correctOptionText: correctOption?.optionText ?? null,
        correctOptionImageUrl: correctOption?.imageUrl ?? null,
        outcome,
        selectedOptionId: answer?.selected_archive_option_id ?? null,
        selectedOptionText,
        selectedOptionImageUrl,
        selectedBoolean:
          answer && answer.selected_boolean !== null && answer.selected_boolean !== undefined
            ? answer.selected_boolean === 1
            : null,
        pointsAwarded: answer ? Number(answer.points_awarded ?? 0) : 0,
        responseTimeMs:
          answer && answer.response_time_ms !== null && answer.response_time_ms !== undefined
            ? Number(answer.response_time_ms)
            : null,
        answeredAt: answer?.answered_at ?? null,
      };
    });

    return {
      session: mapArchivedSessionRow(sessionRow),
      participant: mapArchivedParticipantRow(participantRow),
      questions,
    };
  }
}

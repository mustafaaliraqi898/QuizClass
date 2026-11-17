import crypto from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import type {
  QuestionDifficulty,
  QuestionFilterParams,
  QuestionOption,
  QuestionRecord,
  QuestionType,
} from '../../src/types/questionBank.ts';
import type {
  QuizListResponse,
  QuizPayload,
  QuizQuestionInput,
  QuizQuestionSnapshot,
  QuizQuestionSnapshotOption,
  QuizRecord,
  QuizStats,
  QuizSummary,
  RandomSelectionRequest,
  RandomSelectionResponse,
} from '../../src/types/quiz.ts';
import {
  copyMediaToQuiz,
  deleteMediaFilesIfUnreferenced,
  mediaRelativePathToUrl,
  unlinkMediaFilesDirectly,
} from './mediaStorageService.ts';
import { SqliteQuestionBankRepository } from './questionBankRepository.ts';

interface QuizRow {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  description: string | null;
  default_time_seconds: number;
  created_at: string;
  updated_at: string;
  question_count?: number;
  total_duration_seconds?: number;
}

interface QuizQuestionRow {
  id: string;
  quiz_id: string;
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
}

interface QuizQuestionOptionRow {
  id: string;
  quiz_question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

interface BankQuestionRow {
  id: string;
  type: QuestionType;
  prompt: string;
  image_path: string | null;
  correct_boolean: number | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  created_at: string;
  updated_at: string;
}

interface BankOptionRow {
  id: string;
  question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

export class QuizValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'QuizValidationError';
    this.statusCode = statusCode;
  }
}

export class QuizNotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'لم يتم العثور على المسابقة المطلوبة.') {
    super(message);
    this.name = 'QuizNotFoundError';
  }
}

const MAX_TITLE_LENGTH = 200;
const MAX_CLASSIFICATION_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MIN_TIME_SECONDS = 5;
const MAX_TIME_SECONDS = 600;
const MAX_QUESTIONS_PER_QUIZ = 200;

function cleanOptionalText(
  value: string | null | undefined,
  fieldLabel?: string,
  maxLength = MAX_CLASSIFICATION_LENGTH
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (fieldLabel && trimmed.length > maxLength) {
    throw new QuizValidationError(
      `الحقل (${fieldLabel}) يتجاوز الحد الأقصى المسموح به (${maxLength} حرفاً).`
    );
  }
  return trimmed;
}

function escapeSqlLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function validateTimeSeconds(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new QuizValidationError(`${label} يجب أن يكون رقماً صحيحاً بالثواني.`);
  }
  if (value < MIN_TIME_SECONDS || value > MAX_TIME_SECONDS) {
    throw new QuizValidationError(
      `${label} يجب أن يكون بين ${MIN_TIME_SECONDS} و ${MAX_TIME_SECONDS} ثانية.`
    );
  }
  return value;
}

function mapSnapshotOptionRow(row: QuizQuestionOptionRow): QuizQuestionSnapshotOption {
  return {
    id: row.id,
    quizQuestionId: row.quiz_question_id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1,
  };
}

function mapSnapshotQuestionRow(
  row: QuizQuestionRow,
  options: QuizQuestionSnapshotOption[]
): QuizQuestionSnapshot {
  return {
    id: row.id,
    quizId: row.quiz_id,
    sourceQuestionId: row.source_question_id,
    questionOrder: row.question_order,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    correctBoolean: row.correct_boolean === null ? null : row.correct_boolean === 1,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    timeLimitSeconds: row.time_limit_seconds,
    options,
  };
}

function mapQuizSummaryRow(row: QuizRow): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade,
    description: row.description,
    defaultTimeSeconds: row.default_time_seconds,
    questionCount: row.question_count ?? 0,
    totalDurationSeconds: row.total_duration_seconds ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBankOptionRow(row: BankOptionRow): QuestionOption {
  return {
    id: row.id,
    questionId: row.question_id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1,
  };
}

function mapBankQuestionRow(row: BankQuestionRow, options: QuestionOption[]): QuestionRecord {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    correctBoolean: row.correct_boolean === null ? null : row.correct_boolean === 1,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    options,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PreparedSnapshotOption {
  optionOrder: number;
  optionText: string | null;
  imagePath: string | null;
  isCorrect: boolean;
}

interface PreparedSnapshotQuestion {
  sourceQuestionId: string | null;
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  correctBoolean: boolean | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  timeLimitSeconds: number;
  options: PreparedSnapshotOption[];
}

export class SqliteQuizRepository {
  private db: DatabaseSync;
  private storagePaths: StoragePaths;
  private questionBankRepo: SqliteQuestionBankRepository;

  constructor(db: DatabaseSync, storagePaths: StoragePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
    this.questionBankRepo = new SqliteQuestionBankRepository(db, storagePaths);
  }

  getStats(): QuizStats {
    const row = this.db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
          (SELECT COUNT(*) FROM quiz_questions) AS total_quiz_questions
      `
      )
      .get() as { total_quizzes: number; total_quiz_questions: number } | undefined;

    return {
      totalQuizzes: row?.total_quizzes ?? 0,
      totalQuizQuestions: row?.total_quiz_questions ?? 0,
    };
  }

  listQuizzes(): QuizListResponse {
    const rows = this.db
      .prepare(
        `
        SELECT
          q.id,
          q.title,
          q.subject,
          q.grade,
          q.description,
          q.default_time_seconds,
          q.created_at,
          q.updated_at,
          COUNT(qq.id) AS question_count,
          COALESCE(SUM(qq.time_limit_seconds), 0) AS total_duration_seconds
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
        GROUP BY q.id
        ORDER BY q.created_at DESC
      `
      )
      .all() as unknown as QuizRow[];

    return {
      quizzes: rows.map(mapQuizSummaryRow),
      stats: this.getStats(),
    };
  }

  getQuizById(id: string): QuizRecord {
    const row = this.db
      .prepare(
        `
        SELECT
          q.id,
          q.title,
          q.subject,
          q.grade,
          q.description,
          q.default_time_seconds,
          q.created_at,
          q.updated_at,
          COUNT(qq.id) AS question_count,
          COALESCE(SUM(qq.time_limit_seconds), 0) AS total_duration_seconds
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE q.id = ?
        GROUP BY q.id
      `
      )
      .get(id) as unknown as QuizRow | undefined;

    if (!row) {
      throw new QuizNotFoundError();
    }

    const questionRows = this.db
      .prepare(
        `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC`
      )
      .all(id) as unknown as QuizQuestionRow[];

    const optionsByQuestionId = new Map<string, QuizQuestionSnapshotOption[]>();

    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => '?').join(', ');
      const optionRows = this.db
        .prepare(
          `SELECT * FROM quiz_question_options WHERE quiz_question_id IN (${placeholders}) ORDER BY option_order ASC`
        )
        .all(...questionRows.map((q) => q.id)) as unknown as QuizQuestionOptionRow[];

      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.quiz_question_id) ?? [];
        list.push(mapSnapshotOptionRow(optRow));
        optionsByQuestionId.set(optRow.quiz_question_id, list);
      }
    }

    const questions = questionRows.map((qRow) =>
      mapSnapshotQuestionRow(qRow, optionsByQuestionId.get(qRow.id) ?? [])
    );

    return {
      ...mapQuizSummaryRow(row),
      questions,
    };
  }

  previewOrDrawRandom(request: RandomSelectionRequest = {}): RandomSelectionResponse {
    const filters: QuestionFilterParams = request.filters ?? {};
    const whereClauses: string[] = [];
    const params: SQLInputValue[] = [];

    const search = cleanOptionalText(filters.search);
    if (search) {
      const pattern = `%${escapeSqlLikePattern(search)}%`;
      whereClauses.push(
        `(
          prompt LIKE ? ESCAPE '\\'
          OR COALESCE(subject, '') LIKE ? ESCAPE '\\'
          OR COALESCE(grade, '') LIKE ? ESCAPE '\\'
          OR COALESCE(topic, '') LIKE ? ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM question_options qo
            WHERE qo.question_id = questions.id AND COALESCE(qo.option_text, '') LIKE ? ESCAPE '\\'
          )
        )`
      );
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (filters.type && filters.type !== 'all') {
      whereClauses.push('type = ?');
      params.push(filters.type);
    }

    const subject = cleanOptionalText(filters.subject);
    if (subject && subject !== 'all') {
      whereClauses.push('TRIM(subject) = ?');
      params.push(subject);
    }

    const grade = cleanOptionalText(filters.grade);
    if (grade && grade !== 'all') {
      whereClauses.push('TRIM(grade) = ?');
      params.push(grade);
    }

    const topic = cleanOptionalText(filters.topic);
    if (topic && topic !== 'all') {
      whereClauses.push('TRIM(topic) = ?');
      params.push(topic);
    }

    if (filters.difficulty && filters.difficulty !== 'all') {
      whereClauses.push('difficulty = ?');
      params.push(filters.difficulty);
    }

    const excludeIds = Array.isArray(request.excludeQuestionIds)
      ? Array.from(
          new Set(
            request.excludeQuestionIds
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id.trim())
              .filter((id) => id.length > 0)
          )
        )
      : [];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(', ');
      whereClauses.push(`id NOT IN (${placeholders})`);
      params.push(...excludeIds);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS available_count FROM questions ${whereSql}`)
      .get(...params) as { available_count: number } | undefined;

    const availableCount = countRow?.available_count ?? 0;

    if (!request.draw) {
      return {
        availableCount,
        questions: [],
      };
    }

    const count = request.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new QuizValidationError('يرجى تحديد عدد صحيح للأسئلة المطلوب سحبها (1 على الأقل).');
    }

    if (availableCount === 0) {
      throw new QuizValidationError('لا توجد أسئلة متاحة مطابقة للشروط المحددة في بنك الأسئلة.');
    }

    if (count > availableCount) {
      throw new QuizValidationError(
        `العدد المطلوب (${count}) أكبر من عدد الأسئلة المتاحة (${availableCount}).`
      );
    }

    const selectedRows = this.db
      .prepare(`SELECT * FROM questions ${whereSql} ORDER BY RANDOM() LIMIT ?`)
      .all(...params, count) as unknown as BankQuestionRow[];

    const optionsByQuestionId = new Map<string, QuestionOption[]>();
    if (selectedRows.length > 0) {
      const placeholders = selectedRows.map(() => '?').join(', ');
      const optionRows = this.db
        .prepare(
          `SELECT * FROM question_options WHERE question_id IN (${placeholders}) ORDER BY option_order ASC`
        )
        .all(...selectedRows.map((q) => q.id)) as unknown as BankOptionRow[];

      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.question_id) ?? [];
        list.push(mapBankOptionRow(optRow));
        optionsByQuestionId.set(optRow.question_id, list);
      }
    }

    return {
      availableCount,
      questions: selectedRows.map((row) =>
        mapBankQuestionRow(row, optionsByQuestionId.get(row.id) ?? [])
      ),
    };
  }

  private validateHeaderFields(payload: QuizPayload): {
    title: string;
    subject: string | null;
    grade: string | null;
    description: string | null;
    defaultTimeSeconds: number;
    questions: QuizQuestionInput[];
  } {
    if (!payload || typeof payload !== 'object') {
      throw new QuizValidationError('بيانات المسابقة غير صالحة.');
    }

    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (title.length === 0) {
      throw new QuizValidationError('يرجى إدخال اسم المسابقة قبل الحفظ.');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new QuizValidationError(
        `اسم المسابقة يتجاوز الحد الأقصى المسموح به (${MAX_TITLE_LENGTH} حرفاً).`
      );
    }

    const subject = cleanOptionalText(payload.subject, 'المادة الدراسية');
    const grade = cleanOptionalText(payload.grade, 'الصف الدراسي');
    const description = cleanOptionalText(
      payload.description,
      'وصف المسابقة',
      MAX_DESCRIPTION_LENGTH
    );

    const defaultTimeSeconds = validateTimeSeconds(
      payload.defaultTimeSeconds,
      'الوقت الافتراضي للإجابة'
    );

    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      throw new QuizValidationError('يجب إضافة سؤال واحد على الأقل إلى المسابقة.');
    }

    if (payload.questions.length > MAX_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError(
        `الحد الأقصى لعدد الأسئلة في المسابقة الواحدة هو ${MAX_QUESTIONS_PER_QUIZ} سؤالاً.`
      );
    }

    return {
      title,
      subject,
      grade,
      description,
      defaultTimeSeconds,
      questions: payload.questions,
    };
  }

  private prepareQuestionSnapshots(
    items: QuizQuestionInput[],
    existingQuizSnapshots: Map<string, QuizQuestionSnapshot> | null,
    newlyCopiedFiles: string[]
  ): PreparedSnapshotQuestion[] {
    const seenBankIds = new Set<string>();
    const seenSnapshotIds = new Set<string>();
    const prepared: PreparedSnapshotQuestion[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item || typeof item !== 'object') {
        throw new QuizValidationError(`بيانات السؤال رقم ${index + 1} غير صالحة.`);
      }

      const timeLimitSeconds = validateTimeSeconds(
        item.timeLimitSeconds,
        `وقت السؤال رقم ${index + 1}`
      );

      if (item.kind === 'existing_snapshot') {
        if (!existingQuizSnapshots) {
          throw new QuizValidationError('لا يمكن استخدام مرجع نسخة محفوظة عند إنشاء مسابقة جديدة.');
        }
        const snapshotId =
          typeof item.quizQuestionId === 'string' ? item.quizQuestionId.trim() : '';
        if (!snapshotId) {
          throw new QuizValidationError(`معرّف السؤال المحفوظ رقم ${index + 1} غير صالح.`);
        }
        if (seenSnapshotIds.has(snapshotId)) {
          throw new QuizValidationError('لا يمكن تكرار السؤال نفسه أكثر من مرة في نفس المسابقة.');
        }
        const existingSnap = existingQuizSnapshots.get(snapshotId);
        if (!existingSnap) {
          throw new QuizValidationError('أحد الأسئلة المحددة غير موجود في هذه المسابقة.');
        }
        if (existingSnap.sourceQuestionId) {
          if (seenBankIds.has(existingSnap.sourceQuestionId)) {
            throw new QuizValidationError('لا يمكن تكرار السؤال نفسه أكثر من مرة في نفس المسابقة.');
          }
          seenBankIds.add(existingSnap.sourceQuestionId);
        }
        seenSnapshotIds.add(snapshotId);

        prepared.push({
          sourceQuestionId: existingSnap.sourceQuestionId,
          type: existingSnap.type,
          prompt: existingSnap.prompt,
          imagePath: existingSnap.imagePath,
          correctBoolean: existingSnap.correctBoolean,
          subject: existingSnap.subject,
          grade: existingSnap.grade,
          topic: existingSnap.topic,
          difficulty: existingSnap.difficulty,
          timeLimitSeconds,
          options: existingSnap.options.map((opt, optIdx) => ({
            optionOrder: optIdx,
            optionText: opt.optionText,
            imagePath: opt.imagePath,
            isCorrect: opt.isCorrect,
          })),
        });
        continue;
      }

      if (item.kind === 'bank_question') {
        const sourceId =
          typeof item.sourceQuestionId === 'string' ? item.sourceQuestionId.trim() : '';
        if (!sourceId) {
          throw new QuizValidationError(`معرّف السؤال رقم ${index + 1} غير صالح.`);
        }
        if (seenBankIds.has(sourceId)) {
          throw new QuizValidationError('لا يمكن تكرار السؤال نفسه أكثر من مرة في نفس المسابقة.');
        }
        seenBankIds.add(sourceId);

        let bankQuestion: QuestionRecord;
        try {
          bankQuestion = this.questionBankRepo.getQuestionById(sourceId);
        } catch {
          throw new QuizValidationError(
            'أحد الأسئلة المختارة لم يعد موجوداً في بنك الأسئلة. يرجى مراجعة قائمة الأسئلة.'
          );
        }

        const copiedQuestionImage = copyMediaToQuiz(bankQuestion.imagePath, this.storagePaths);
        if (copiedQuestionImage) {
          newlyCopiedFiles.push(copiedQuestionImage);
        }

        const preparedOptions: PreparedSnapshotOption[] = bankQuestion.options.map((opt, optIdx) => {
          const copiedOptionImage = copyMediaToQuiz(opt.imagePath, this.storagePaths);
          if (copiedOptionImage) {
            newlyCopiedFiles.push(copiedOptionImage);
          }
          return {
            optionOrder: optIdx,
            optionText: opt.optionText,
            imagePath: copiedOptionImage,
            isCorrect: opt.isCorrect,
          };
        });

        prepared.push({
          sourceQuestionId: bankQuestion.id,
          type: bankQuestion.type,
          prompt: bankQuestion.prompt,
          imagePath: copiedQuestionImage,
          correctBoolean: bankQuestion.correctBoolean,
          subject: bankQuestion.subject,
          grade: bankQuestion.grade,
          topic: bankQuestion.topic,
          difficulty: bankQuestion.difficulty,
          timeLimitSeconds,
          options: preparedOptions,
        });
        continue;
      }

      throw new QuizValidationError(`نوع مصدر السؤال رقم ${index + 1} غير مدعوم.`);
    }

    return prepared;
  }

  private insertSnapshotQuestions(quizId: string, snapshots: PreparedSnapshotQuestion[]): void {
    const insertQuestion = this.db.prepare(
      `
      INSERT INTO quiz_questions (
        id, quiz_id, source_question_id, question_order, type, prompt,
        image_path, correct_boolean, subject, grade, topic, difficulty, time_limit_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    const insertOption = this.db.prepare(
      `
      INSERT INTO quiz_question_options (
        id, quiz_question_id, option_order, option_text, image_path, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    );

    snapshots.forEach((snap, orderIndex) => {
      const quizQuestionId = crypto.randomUUID();
      insertQuestion.run(
        quizQuestionId,
        quizId,
        snap.sourceQuestionId,
        orderIndex,
        snap.type,
        snap.prompt,
        snap.imagePath,
        snap.correctBoolean === null ? null : snap.correctBoolean ? 1 : 0,
        snap.subject,
        snap.grade,
        snap.topic,
        snap.difficulty,
        snap.timeLimitSeconds
      );

      if (snap.type === 'multiple_choice') {
        snap.options.forEach((opt, optIndex) => {
          insertOption.run(
            crypto.randomUUID(),
            quizQuestionId,
            optIndex,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
    });
  }

  createQuiz(payload: QuizPayload): QuizRecord {
    const validated = this.validateHeaderFields(payload);
    const quizId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newlyCopiedFiles: string[] = [];

    try {
      const snapshots = this.prepareQuestionSnapshots(
        validated.questions,
        null,
        newlyCopiedFiles
      );

      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db
          .prepare(
            `
            INSERT INTO quizzes (
              id, title, subject, grade, description, default_time_seconds, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            quizId,
            validated.title,
            validated.subject,
            validated.grade,
            validated.description,
            validated.defaultTimeSeconds,
            now,
            now
          );

        this.insertSnapshotQuestions(quizId, snapshots);
        this.db.exec('COMMIT');
      } catch (dbError) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure
        }
        throw dbError;
      }
    } catch (error) {
      unlinkMediaFilesDirectly(this.storagePaths, newlyCopiedFiles);
      throw error;
    }

    return this.getQuizById(quizId);
  }

  updateQuiz(id: string, payload: QuizPayload): QuizRecord {
    const existing = this.getQuizById(id);
    const validated = this.validateHeaderFields(payload);
    const now = new Date().toISOString();

    const existingMap = new Map<string, QuizQuestionSnapshot>();
    const oldMediaPaths: string[] = [];
    for (const q of existing.questions) {
      existingMap.set(q.id, q);
      if (q.imagePath) oldMediaPaths.push(q.imagePath);
      for (const opt of q.options) {
        if (opt.imagePath) oldMediaPaths.push(opt.imagePath);
      }
    }

    const newlyCopiedFiles: string[] = [];
    let retainedOrNewSet = new Set<string>();

    try {
      const snapshots = this.prepareQuestionSnapshots(
        validated.questions,
        existingMap,
        newlyCopiedFiles
      );

      retainedOrNewSet = new Set<string>(
        snapshots
          .flatMap((s) => [s.imagePath, ...s.options.map((o) => o.imagePath)])
          .filter((p): p is string => Boolean(p))
      );

      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = this.db
          .prepare(
            `
            UPDATE quizzes
            SET title = ?, subject = ?, grade = ?, description = ?,
                default_time_seconds = ?, updated_at = ?
            WHERE id = ?
          `
          )
          .run(
            validated.title,
            validated.subject,
            validated.grade,
            validated.description,
            validated.defaultTimeSeconds,
            now,
            id
          );

        if (result.changes === 0) {
          throw new QuizNotFoundError();
        }

        this.db.prepare('DELETE FROM quiz_questions WHERE quiz_id = ?').run(id);
        this.insertSnapshotQuestions(id, snapshots);
        this.db.exec('COMMIT');
      } catch (dbError) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure
        }
        throw dbError;
      }
    } catch (error) {
      unlinkMediaFilesDirectly(this.storagePaths, newlyCopiedFiles);
      throw error;
    }

    const removedMediaPaths = oldMediaPaths.filter((p) => !retainedOrNewSet.has(p));
    if (removedMediaPaths.length > 0) {
      deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, removedMediaPaths);
    }

    return this.getQuizById(id);
  }

  deleteQuiz(id: string): void {
    const existing = this.getQuizById(id);
    const candidatePaths: Array<string | null> = [];
    for (const q of existing.questions) {
      candidatePaths.push(q.imagePath);
      for (const opt of q.options) {
        candidatePaths.push(opt.imagePath);
      }
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare('DELETE FROM quizzes WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new QuizNotFoundError();
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

    deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, candidatePaths);
  }
}

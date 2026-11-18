import crypto from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import type {
  QuestionBankListResponse,
  QuestionBankStats,
  QuestionDifficulty,
  QuestionFacets,
  QuestionFilterParams,
  QuestionOption,
  QuestionPayload,
  QuestionRecord,
  QuestionType,
} from '../../src/types/questionBank.ts';
import {
  assertMediaFileExists,
  deleteMediaFilesIfUnreferenced,
  mediaRelativePathToUrl,
  normalizeMediaRelativePath,
} from './mediaStorageService.ts';

interface QuestionRow {
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

interface QuestionOptionRow {
  id: string;
  question_id: string;
  option_order: number;
  option_text: string | null;
  image_path: string | null;
  is_correct: number;
}

export class QuestionValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'QuestionValidationError';
    this.statusCode = statusCode;
  }
}

export class QuestionNotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'لم يتم العثور على السؤال المطلوب.') {
    super(message);
    this.name = 'QuestionNotFoundError';
  }
}

const MAX_PROMPT_LENGTH = 2000;
const MAX_OPTION_TEXT_LENGTH = 500;
const MAX_CLASSIFICATION_LENGTH = 120;

function cleanOptionalText(
  value: string | null | undefined,
  fieldLabel?: string,
  maxLength = MAX_CLASSIFICATION_LENGTH
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (fieldLabel && trimmed.length > maxLength) {
    throw new QuestionValidationError(
      `الحقل (${fieldLabel}) يتجاوز الحد الأقصى المسموح به (${maxLength} حرفاً).`
    );
  }
  return trimmed;
}

function escapeSqlLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function validateAndNormalizePayload(
  payload: QuestionPayload,
  storagePaths: StoragePaths
): {
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  correctBoolean: number | null;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  options: Array<{
    optionText: string | null;
    imagePath: string | null;
    isCorrect: boolean;
  }>;
} {
  if (!payload || typeof payload !== 'object') {
    throw new QuestionValidationError('بيانات السؤال غير صالحة.');
  }

  if (payload.type !== 'multiple_choice' && payload.type !== 'true_false') {
    throw new QuestionValidationError('نوع السؤال غير مدعوم.');
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  if (prompt.length === 0) {
    throw new QuestionValidationError('يرجى إدخال نص السؤال قبل الحفظ.');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new QuestionValidationError(
      `نص السؤال يتجاوز الحد الأقصى المسموح به (${MAX_PROMPT_LENGTH} حرفاً).`
    );
  }

  const imagePath = normalizeMediaRelativePath(payload.imagePath);
  assertMediaFileExists(imagePath, storagePaths);

  const subject = cleanOptionalText(payload.subject, 'المادة الدراسية');
  const grade = cleanOptionalText(payload.grade, 'الصف الدراسي');
  const topic = cleanOptionalText(payload.topic, 'الموضوع');

  let difficulty: QuestionDifficulty | null = null;
  if (payload.difficulty !== undefined && payload.difficulty !== null && payload.difficulty !== ('' as unknown)) {
    if (
      payload.difficulty !== 'easy' &&
      payload.difficulty !== 'medium' &&
      payload.difficulty !== 'hard'
    ) {
      throw new QuestionValidationError('مستوى الصعوبة المحدد غير صالح.');
    }
    difficulty = payload.difficulty;
  }

  if (payload.type === 'true_false') {
    if (typeof payload.correctBoolean !== 'boolean') {
      throw new QuestionValidationError('يرجى تحديد الإجابة الصحيحة (صح أو خطأ).');
    }

    return {
      type: 'true_false',
      prompt,
      imagePath,
      correctBoolean: payload.correctBoolean ? 1 : 0,
      subject,
      grade,
      topic,
      difficulty,
      options: [],
    };
  }

  // Multiple choice validation
  if (!Array.isArray(payload.options) || payload.options.length < 2) {
    throw new QuestionValidationError('يجب أن يحتوي سؤال الاختيار من متعدد على اختيارين على الأقل.');
  }

  if (payload.options.length > 6) {
    throw new QuestionValidationError('الحد الأقصى لعدد الاختيارات هو 6 اختيارات.');
  }

  const normalizedOptions = payload.options.map((opt, index) => {
    const optionText = cleanOptionalText(
      opt?.optionText,
      `الاختيار رقم ${index + 1}`,
      MAX_OPTION_TEXT_LENGTH
    );
    const optImagePath = normalizeMediaRelativePath(opt?.imagePath);
    assertMediaFileExists(optImagePath, storagePaths);
    if (!optionText && !optImagePath) {
      throw new QuestionValidationError(
        `الاختيار رقم ${index + 1} فارغ؛ يرجى إدخال نص أو إرفاق صورة للاختيار.`
      );
    }
    return {
      optionText,
      imagePath: optImagePath,
      isCorrect: Boolean(opt?.isCorrect),
    };
  });

  const correctCount = normalizedOptions.filter((opt) => opt.isCorrect).length;
  if (correctCount !== 1) {
    throw new QuestionValidationError(
      'يجب تحديد إجابة صحيحة واحدة فقط لسؤال الاختيار من متعدد.'
    );
  }

  return {
    type: 'multiple_choice',
    prompt,
    imagePath,
    correctBoolean: null,
    subject,
    grade,
    topic,
    difficulty,
    options: normalizedOptions,
  };
}

function mapOptionRow(row: QuestionOptionRow): QuestionOption {
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

function mapQuestionRow(row: QuestionRow, options: QuestionOption[]): QuestionRecord {
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

export class SqliteQuestionBankRepository {
  private db: DatabaseSync;
  private storagePaths: StoragePaths;

  constructor(db: DatabaseSync, storagePaths: StoragePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
  }

  getStats(): QuestionBankStats {
    const row = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS total_questions,
          COALESCE(SUM(CASE WHEN type = 'multiple_choice' THEN 1 ELSE 0 END), 0) AS mc_count,
          COALESCE(SUM(CASE WHEN type = 'true_false' THEN 1 ELSE 0 END), 0) AS tf_count,
          COUNT(DISTINCT CASE WHEN subject IS NOT NULL AND TRIM(subject) <> '' THEN TRIM(subject) END) AS subject_count
        FROM questions
      `
      )
      .get() as
      | {
          total_questions: number;
          mc_count: number;
          tf_count: number;
          subject_count: number;
        }
      | undefined;

    return {
      totalQuestions: row?.total_questions ?? 0,
      multipleChoiceCount: row?.mc_count ?? 0,
      trueFalseCount: row?.tf_count ?? 0,
      subjectCount: row?.subject_count ?? 0,
    };
  }

  getFacets(): QuestionFacets {
    const subjectRows = this.db
      .prepare(
        `SELECT DISTINCT TRIM(subject) AS value FROM questions WHERE subject IS NOT NULL AND TRIM(subject) <> '' ORDER BY value ASC`
      )
      .all() as Array<{ value: string }>;

    const gradeRows = this.db
      .prepare(
        `SELECT DISTINCT TRIM(grade) AS value FROM questions WHERE grade IS NOT NULL AND TRIM(grade) <> '' ORDER BY value ASC`
      )
      .all() as Array<{ value: string }>;

    const topicRows = this.db
      .prepare(
        `SELECT DISTINCT TRIM(topic) AS value FROM questions WHERE topic IS NOT NULL AND TRIM(topic) <> '' ORDER BY value ASC`
      )
      .all() as Array<{ value: string }>;

    return {
      subjects: subjectRows.map((r) => r.value),
      grades: gradeRows.map((r) => r.value),
      topics: topicRows.map((r) => r.value),
    };
  }

  listQuestions(filters: QuestionFilterParams = {}): QuestionBankListResponse {
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

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const questionRows = this.db
      .prepare(`SELECT * FROM questions ${whereSql} ORDER BY created_at DESC`)
      .all(...params) as unknown as QuestionRow[];

    const optionsByQuestionId = new Map<string, QuestionOption[]>();

    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => '?').join(', ');
      const optionRows = this.db
        .prepare(
          `SELECT * FROM question_options WHERE question_id IN (${placeholders}) ORDER BY option_order ASC`
        )
        .all(...questionRows.map((q) => q.id)) as unknown as QuestionOptionRow[];

      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.question_id) ?? [];
        list.push(mapOptionRow(optRow));
        optionsByQuestionId.set(optRow.question_id, list);
      }
    }

    const questions = questionRows.map((qRow) =>
      mapQuestionRow(qRow, optionsByQuestionId.get(qRow.id) ?? [])
    );

    return {
      questions,
      facets: this.getFacets(),
      stats: this.getStats(),
    };
  }

  getQuestionById(id: string): QuestionRecord {
    const qRow = this.db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(id) as unknown as QuestionRow | undefined;

    if (!qRow) {
      throw new QuestionNotFoundError();
    }

    const optionRows = this.db
      .prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY option_order ASC')
      .all(id) as unknown as QuestionOptionRow[];

    return mapQuestionRow(qRow, optionRows.map(mapOptionRow));
  }

  createQuestion(payload: QuestionPayload): QuestionRecord {
    const normalized = validateAndNormalizePayload(payload, this.storagePaths);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `
          INSERT INTO questions (
            id, type, prompt, image_path, correct_boolean,
            subject, grade, topic, difficulty, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          id,
          normalized.type,
          normalized.prompt,
          normalized.imagePath,
          normalized.correctBoolean,
          normalized.subject,
          normalized.grade,
          normalized.topic,
          normalized.difficulty,
          now,
          now
        );

      if (normalized.type === 'multiple_choice') {
        const insertOption = this.db.prepare(
          `
          INSERT INTO question_options (
            id, question_id, option_order, option_text, image_path, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        );

        normalized.options.forEach((opt, index) => {
          insertOption.run(
            crypto.randomUUID(),
            id,
            index,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
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

    return this.getQuestionById(id);
  }

  createQuestionsBatch(payloads: QuestionPayload[]): QuestionRecord[] {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      throw new QuestionValidationError('يرجى تقديم قائمة أسئلة صالحة للاستيراد.');
    }

    const normalizedList = payloads.map((p) => validateAndNormalizePayload(p, this.storagePaths));
    const createdIds: string[] = [];
    const now = new Date().toISOString();

    const insertQuestion = this.db.prepare(
      `
      INSERT INTO questions (
        id, type, prompt, image_path, correct_boolean,
        subject, grade, topic, difficulty, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    const insertOption = this.db.prepare(
      `
      INSERT INTO question_options (
        id, question_id, option_order, option_text, image_path, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    );

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const normalized of normalizedList) {
        const id = crypto.randomUUID();
        createdIds.push(id);

        insertQuestion.run(
          id,
          normalized.type,
          normalized.prompt,
          normalized.imagePath,
          normalized.correctBoolean,
          normalized.subject,
          normalized.grade,
          normalized.topic,
          normalized.difficulty,
          now,
          now
        );

        if (normalized.type === 'multiple_choice') {
          normalized.options.forEach((opt, index) => {
            insertOption.run(
              crypto.randomUUID(),
              id,
              index,
              opt.optionText,
              opt.imagePath,
              opt.isCorrect ? 1 : 0
            );
          });
        }
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

    return createdIds.map((id) => this.getQuestionById(id));
  }

  updateQuestion(id: string, payload: QuestionPayload): QuestionRecord {
    const existing = this.getQuestionById(id);
    const normalized = validateAndNormalizePayload(payload, this.storagePaths);
    const now = new Date().toISOString();

    const oldMediaPaths = [
      existing.imagePath,
      ...existing.options.map((opt) => opt.imagePath),
    ].filter((p): p is string => Boolean(p));

    const newMediaSet = new Set<string>(
      [
        normalized.imagePath,
        ...normalized.options.map((opt) => opt.imagePath),
      ].filter((p): p is string => Boolean(p))
    );

    const removedMediaPaths = oldMediaPaths.filter((p) => !newMediaSet.has(p));

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const updateResult = this.db
        .prepare(
          `
          UPDATE questions
          SET type = ?, prompt = ?, image_path = ?, correct_boolean = ?,
              subject = ?, grade = ?, topic = ?, difficulty = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .run(
          normalized.type,
          normalized.prompt,
          normalized.imagePath,
          normalized.correctBoolean,
          normalized.subject,
          normalized.grade,
          normalized.topic,
          normalized.difficulty,
          now,
          id
        );

      if (updateResult.changes === 0) {
        throw new QuestionNotFoundError();
      }

      this.db.prepare('DELETE FROM question_options WHERE question_id = ?').run(id);

      if (normalized.type === 'multiple_choice') {
        const insertOption = this.db.prepare(
          `
          INSERT INTO question_options (
            id, question_id, option_order, option_text, image_path, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        );

        normalized.options.forEach((opt, index) => {
          insertOption.run(
            crypto.randomUUID(),
            id,
            index,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
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

    if (removedMediaPaths.length > 0) {
      deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, removedMediaPaths);
    }

    return this.getQuestionById(id);
  }

  deleteQuestion(id: string): void {
    const existing = this.getQuestionById(id);
    const candidatePaths = [
      existing.imagePath,
      ...existing.options.map((opt) => opt.imagePath),
    ];

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare('DELETE FROM questions WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new QuestionNotFoundError();
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

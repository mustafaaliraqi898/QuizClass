import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import type {
  InteractiveActivityListResponse,
  InteractiveActivityPayload,
  InteractiveActivityRecord,
  InteractiveActivitySummary,
  InteractiveLearningQuestion,
} from '../../src/types/interactiveLearning.ts';
import { SqliteQuestionBankRepository } from './questionBankRepository.ts';

export class InteractiveActivityValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'InteractiveActivityValidationError';
    this.statusCode = statusCode;
  }
}

export class InteractiveActivityNotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'النشاط التعليمي المطلوب غير موجود.') {
    super(message);
    this.name = 'InteractiveActivityNotFoundError';
  }
}

interface RawActivityRow {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  auto_fullscreen: number;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

function normalizeOptionalText(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export class SqliteInteractiveLearningRepository {
  private db: DatabaseSync;
  private questionBankRepo: SqliteQuestionBankRepository;

  constructor(db: DatabaseSync, storagePaths: StoragePaths) {
    this.db = db;
    this.questionBankRepo = new SqliteQuestionBankRepository(db, storagePaths);
  }

  private mapSummaryRow(row: RawActivityRow, questionCountOverride?: number): InteractiveActivitySummary {
    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      grade: row.grade,
      autoFullscreen: row.auto_fullscreen === 1,
      questionCount: questionCountOverride ?? Number(row.question_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private validatePayload(payload: InteractiveActivityPayload): {
    title: string;
    subject: string | null;
    grade: string | null;
    autoFullscreen: boolean;
    questionIds: string[];
  } {
    if (!payload || typeof payload !== 'object') {
      throw new InteractiveActivityValidationError('بيانات النشاط التعليمي غير مكتملة.');
    }

    const title = typeof payload.title === 'string' ? payload.title.replace(/\s+/g, ' ').trim() : '';
    if (title.length < 2) {
      throw new InteractiveActivityValidationError('يرجى إدخال عنوان للنشاط التعليمي (حرفان على الأقل).');
    }
    if (title.length > 160) {
      throw new InteractiveActivityValidationError('عنوان النشاط طويل جداً (الحد الأقصى 160 حرفاً).');
    }

    if (!Array.isArray(payload.questionIds) || payload.questionIds.length === 0) {
      throw new InteractiveActivityValidationError('يجب اختيار سؤال واحد على الأقل من بنك الأسئلة.');
    }

    const seen = new Set<string>();
    const questionIds: string[] = [];
    for (const rawId of payload.questionIds) {
      if (typeof rawId !== 'string' || !rawId.trim()) {
        throw new InteractiveActivityValidationError('معرف أحد الأسئلة المحددة غير صالح.');
      }
      const cleanId = rawId.trim();
      if (seen.has(cleanId)) {
        throw new InteractiveActivityValidationError('لا يمكن تكرار السؤال نفسه داخل النشاط التعليمي.');
      }
      seen.add(cleanId);
      questionIds.push(cleanId);
    }

    // Verify all referenced questions exist in the Question Bank
    for (const qId of questionIds) {
      const exists = this.db.prepare('SELECT id FROM questions WHERE id = ?').get(qId);
      if (!exists) {
        throw new InteractiveActivityValidationError(
          'أحد الأسئلة المختارة غير موجود في بنك الأسئلة أو تم حذفه.',
          404
        );
      }
    }

    return {
      title,
      subject: normalizeOptionalText(payload.subject, 100),
      grade: normalizeOptionalText(payload.grade, 100),
      autoFullscreen: Boolean(payload.autoFullscreen),
      questionIds,
    };
  }

  listActivities(): InteractiveActivityListResponse {
    const rows = this.db
      .prepare(
        `SELECT a.id, a.title, a.subject, a.grade, a.auto_fullscreen, a.created_at, a.updated_at,
                COUNT(iaq.id) AS question_count
         FROM interactive_activities a
         LEFT JOIN interactive_activity_questions iaq ON iaq.activity_id = a.id
         GROUP BY a.id
         ORDER BY a.updated_at DESC, a.created_at DESC`
      )
      .all() as unknown as RawActivityRow[];

    return {
      activities: rows.map((row) => this.mapSummaryRow(row)),
    };
  }

  getActivityById(id: string): InteractiveActivityRecord {
    const row = this.db
      .prepare(
        `SELECT id, title, subject, grade, auto_fullscreen, created_at, updated_at
         FROM interactive_activities
         WHERE id = ?`
      )
      .get(id) as RawActivityRow | undefined;

    if (!row) {
      throw new InteractiveActivityNotFoundError();
    }

    const linkedRows = this.db
      .prepare(
        `SELECT question_id
         FROM interactive_activity_questions
         WHERE activity_id = ?
         ORDER BY question_order ASC`
      )
      .all(id) as Array<{ question_id: string }>;

    const questions: InteractiveLearningQuestion[] = [];
    for (const linked of linkedRows) {
      try {
        const question = this.questionBankRepo.getQuestionById(linked.question_id);
        questions.push(question);
      } catch {
        // Skip gracefully if a source question was somehow removed externally
      }
    }

    return {
      ...this.mapSummaryRow(row, questions.length),
      questions,
    };
  }

  createActivity(payload: InteractiveActivityPayload): InteractiveActivityRecord {
    const clean = this.validatePayload(payload);
    const id = randomUUID();
    const now = new Date().toISOString();

    const insertActivity = this.db.prepare(
      `INSERT INTO interactive_activities (id, title, subject, grade, auto_fullscreen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertItem = this.db.prepare(
      `INSERT INTO interactive_activity_questions (id, activity_id, question_id, question_order)
       VALUES (?, ?, ?, ?)`
    );

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      insertActivity.run(
        id,
        clean.title,
        clean.subject,
        clean.grade,
        clean.autoFullscreen ? 1 : 0,
        now,
        now
      );
      clean.questionIds.forEach((questionId, index) => {
        insertItem.run(randomUUID(), id, questionId, index);
      });
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }

    return this.getActivityById(id);
  }

  updateActivity(id: string, payload: InteractiveActivityPayload): InteractiveActivityRecord {
    const existing = this.db
      .prepare('SELECT id FROM interactive_activities WHERE id = ?')
      .get(id);
    if (!existing) {
      throw new InteractiveActivityNotFoundError();
    }

    const clean = this.validatePayload(payload);
    const now = new Date().toISOString();

    const updateStmt = this.db.prepare(
      `UPDATE interactive_activities
       SET title = ?, subject = ?, grade = ?, auto_fullscreen = ?, updated_at = ?
       WHERE id = ?`
    );
    const deleteItems = this.db.prepare(
      'DELETE FROM interactive_activity_questions WHERE activity_id = ?'
    );
    const insertItem = this.db.prepare(
      `INSERT INTO interactive_activity_questions (id, activity_id, question_id, question_order)
       VALUES (?, ?, ?, ?)`
    );

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      updateStmt.run(
        clean.title,
        clean.subject,
        clean.grade,
        clean.autoFullscreen ? 1 : 0,
        now,
        id
      );
      deleteItems.run(id);
      clean.questionIds.forEach((questionId, index) => {
        insertItem.run(randomUUID(), id, questionId, index);
      });
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }

    return this.getActivityById(id);
  }

  deleteActivity(id: string): void {
    const result = this.db
      .prepare('DELETE FROM interactive_activities WHERE id = ?')
      .run(id);
    if (result.changes === 0) {
      throw new InteractiveActivityNotFoundError();
    }
  }
}

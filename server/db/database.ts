import { DatabaseSync } from 'node:sqlite';

export function initializeDatabase(dbFilePath: string): DatabaseSync {
  const db = new DatabaseSync(dbFilePath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      UNIQUE (question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_grade ON questions(grade);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT,
      grade TEXT,
      description TEXT,
      default_time_seconds INTEGER NOT NULL DEFAULT 30 CHECK (default_time_seconds BETWEEN 5 AND 600),
      lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'started', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      source_question_id TEXT,
      question_order INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds BETWEEN 5 AND 600),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      UNIQUE (quiz_id, question_order)
    );

    CREATE TABLE IF NOT EXISTS quiz_question_options (
      id TEXT PRIMARY KEY,
      quiz_question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
      UNIQUE (quiz_question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id, question_order);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_source_id ON quiz_questions(source_question_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_question_options_qq_id ON quiz_question_options(quiz_question_id, option_order);
  `);

  const quizColumns = db.prepare('PRAGMA table_info(quizzes)').all() as Array<{ name: string }>;
  const hasLifecycleStatus = quizColumns.some((col) => col.name === 'lifecycle_status');
  if (!hasLifecycleStatus) {
    db.exec(
      `ALTER TABLE quizzes ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'started', 'completed'));`
    );
  }

  return db;
}

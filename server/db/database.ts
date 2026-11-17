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
  `);

  return db;
}

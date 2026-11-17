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

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      quiz_title TEXT NOT NULL,
      quiz_subject TEXT,
      quiz_grade TEXT,
      pin_code TEXT NOT NULL,
      host_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'completed', 'cancelled')),
      current_question_index INTEGER NOT NULL DEFAULT -1,
      current_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (current_phase IN ('lobby', 'question_intro', 'answering', 'question_results', 'final_results')),
      phase_started_at TEXT,
      phase_ends_at TEXT,
      question_intro_seconds INTEGER NOT NULL DEFAULT 5 CHECK (question_intro_seconds BETWEEN 1 AND 60),
      advance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (advance_mode IN ('auto', 'manual')),
      auto_advance_seconds INTEGER NOT NULL DEFAULT 5 CHECK (auto_advance_seconds BETWEEN 1 AND 60),
      allow_answer_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_answer_change IN (0, 1)),
      allow_late_join INTEGER NOT NULL DEFAULT 1 CHECK (allow_late_join IN (0, 1)),
      scoring_mode TEXT NOT NULL DEFAULT 'speed_and_accuracy' CHECK (scoring_mode IN ('speed_and_accuracy', 'accuracy_only')),
      question_started_at TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_active_pin
      ON live_sessions(pin_code)
      WHERE status IN ('waiting', 'running');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_active_quiz
      ON live_sessions(quiz_id)
      WHERE status IN ('waiting', 'running');

    CREATE INDEX IF NOT EXISTS idx_live_sessions_created_at ON live_sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

    CREATE TABLE IF NOT EXISTS live_session_questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source_quiz_question_id TEXT,
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
      points INTEGER NOT NULL DEFAULT 1000,
      results_finalized INTEGER NOT NULL DEFAULT 0 CHECK (results_finalized IN (0, 1)),
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      UNIQUE (session_id, question_order)
    );

    CREATE TABLE IF NOT EXISTS live_session_question_options (
      id TEXT PRIMARY KEY,
      session_question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (session_question_id) REFERENCES live_session_questions(id) ON DELETE CASCADE,
      UNIQUE (session_question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_questions_session_id
      ON live_session_questions(session_id, question_order);
    CREATE INDEX IF NOT EXISTS idx_live_session_question_options_sq_id
      ON live_session_question_options(session_question_id, option_order);

    CREATE TABLE IF NOT EXISTS live_session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      reconnect_token TEXT NOT NULL,
      connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected')),
      total_score INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      total_response_time_ms INTEGER NOT NULL DEFAULT 0,
      rank_position INTEGER,
      joined_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      disconnected_at TEXT,
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      UNIQUE (session_id, normalized_name)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_participants_session_id
      ON live_session_participants(session_id, joined_at ASC);

    CREATE TABLE IF NOT EXISTS live_session_answers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_question_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      selected_option_id TEXT,
      selected_boolean INTEGER CHECK (selected_boolean IS NULL OR selected_boolean IN (0, 1)),
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      response_time_ms INTEGER,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (session_question_id) REFERENCES live_session_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES live_session_participants(id) ON DELETE CASCADE,
      UNIQUE (session_question_id, participant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_answers_session_id
      ON live_session_answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_live_session_answers_participant_id
      ON live_session_answers(participant_id);
  `);

  const ensureColumns = (table: string, definitions: Array<{ name: string; sql: string }>) => {
    const existingCols = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (col) => col.name
      )
    );
    for (const def of definitions) {
      if (!existingCols.has(def.name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${def.sql};`);
      }
    }
  };

  ensureColumns('quizzes', [
    {
      name: 'lifecycle_status',
      sql: `lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'started', 'completed'))`,
    },
  ]);

  ensureColumns('live_sessions', [
    {
      name: 'current_phase',
      sql: `current_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (current_phase IN ('lobby', 'question_intro', 'answering', 'question_results', 'final_results'))`,
    },
    { name: 'phase_started_at', sql: 'phase_started_at TEXT' },
    { name: 'phase_ends_at', sql: 'phase_ends_at TEXT' },
    {
      name: 'question_intro_seconds',
      sql: 'question_intro_seconds INTEGER NOT NULL DEFAULT 5 CHECK (question_intro_seconds BETWEEN 1 AND 60)',
    },
    {
      name: 'advance_mode',
      sql: `advance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (advance_mode IN ('auto', 'manual'))`,
    },
    {
      name: 'auto_advance_seconds',
      sql: 'auto_advance_seconds INTEGER NOT NULL DEFAULT 5 CHECK (auto_advance_seconds BETWEEN 1 AND 60)',
    },
    {
      name: 'allow_answer_change',
      sql: 'allow_answer_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_answer_change IN (0, 1))',
    },
    {
      name: 'allow_late_join',
      sql: 'allow_late_join INTEGER NOT NULL DEFAULT 1 CHECK (allow_late_join IN (0, 1))',
    },
    {
      name: 'scoring_mode',
      sql: `scoring_mode TEXT NOT NULL DEFAULT 'speed_and_accuracy' CHECK (scoring_mode IN ('speed_and_accuracy', 'accuracy_only'))`,
    },
  ]);

  ensureColumns('live_session_questions', [
    {
      name: 'results_finalized',
      sql: 'results_finalized INTEGER NOT NULL DEFAULT 0 CHECK (results_finalized IN (0, 1))',
    },
  ]);

  ensureColumns('live_session_participants', [
    { name: 'wrong_count', sql: 'wrong_count INTEGER NOT NULL DEFAULT 0' },
    { name: 'total_response_time_ms', sql: 'total_response_time_ms INTEGER NOT NULL DEFAULT 0' },
  ]);

  return db;
}

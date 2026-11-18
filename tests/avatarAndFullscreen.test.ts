import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { SqliteLiveSessionRepository } from '../server/services/liveSessionRepository.ts';
import { NOOP_LIVE_SESSION_HUB } from '../server/services/liveSessionSocket.ts';
import { SqliteQuestionBankRepository } from '../server/services/questionBankRepository.ts';
import { SqliteQuizRepository } from '../server/services/quizRepository.ts';

describe('QuizClass Avatar Selection & Fullscreen Mode Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let httpServer: Server;
  let baseUrl: string;
  let port: number;
  let testQuizId: string;

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-avatar-fullscreen-test-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    db = initializeDatabase(storagePaths.dbFilePath);

    const app = createServerApp(db, storagePaths, NOOP_LIVE_SESSION_HUB);
    httpServer = http.createServer(app);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Create a question and a quiz to launch sessions with
    const qbRepo = new SqliteQuestionBankRepository(db, storagePaths);
    const q1 = qbRepo.createQuestion({
      type: 'multiple_choice',
      prompt: 'ما هي عاصمة العراق؟',
      imagePath: null,
      correctBoolean: null,
      options: [
        { optionText: 'بغداد', isCorrect: true, imagePath: null },
        { optionText: 'البصرة', isCorrect: false, imagePath: null },
        { optionText: 'أربيل', isCorrect: false, imagePath: null },
        { optionText: 'الموصل', isCorrect: false, imagePath: null },
      ],
    });

    const quizRepo = new SqliteQuizRepository(db, storagePaths);
    const quiz = quizRepo.createQuiz({
      title: 'اختبار الجغرافيا التجريبي',
      defaultTimeSeconds: 20,
      questions: [
        { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 20 },
      ],
    });
    testQuizId = quiz.id;
  });

  after(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    if (db) {
      db.close();
    }
    if (tempDataDir && fs.existsSync(tempDataDir)) {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
  });

  it('1. correctly configures and persists fullScreenMode in live sessions', async () => {
    const liveRepo = new SqliteLiveSessionRepository(db, storagePaths);

    // Create session with fullScreenMode: true
    const sessionDetails = await liveRepo.createSession(testQuizId, {
      settings: {
        fullScreenMode: true,
        advanceMode: 'manual',
        questionIntroSeconds: 3,
      },
    });

    assert.equal(sessionDetails.settings.fullScreenMode, true);
    assert.equal(sessionDetails.settings.advanceMode, 'manual');
    assert.equal(sessionDetails.settings.questionIntroSeconds, 3);

    // Verify directly in SQLite
    const row = db
      .prepare('SELECT full_screen_mode FROM live_sessions WHERE id = ?')
      .get(sessionDetails.id) as { full_screen_mode: number };
    assert.equal(row.full_screen_mode, 1);

    // Update settings to fullScreenMode: false
    const updated = await liveRepo.updateSessionSettings(sessionDetails.id, {
      fullScreenMode: false,
    });
    assert.equal(updated.settings.fullScreenMode, false);

    const rowUpdated = db
      .prepare('SELECT full_screen_mode FROM live_sessions WHERE id = ?')
      .get(sessionDetails.id) as { full_screen_mode: number };
    assert.equal(rowUpdated.full_screen_mode, 0);

    // Cancel session to clean up
    await liveRepo.cancelSession(sessionDetails.id);
  });

  it('2. registers student with avatarId, persists in SQLite, and preserves on reconnect', async () => {
    const liveRepo = new SqliteLiveSessionRepository(db, storagePaths);
    const session = await liveRepo.createSession(testQuizId);

    // Join with avatar_fox
    const joinRes = liveRepo.joinSession({
      pinCode: session.pinCode,
      displayName: 'سارة أحمد',
      avatarId: 'avatar_fox',
    });

    assert.equal(joinRes.participant.displayName, 'سارة أحمد');
    assert.equal(joinRes.participant.avatarId, 'avatar_fox');

    // Verify directly in SQLite
    const pRow = db
      .prepare('SELECT avatar_id FROM live_session_participants WHERE id = ?')
      .get(joinRes.participant.id) as { avatar_id: string };
    assert.equal(pRow.avatar_id, 'avatar_fox');

    // Verify student live state includes avatarId
    const studentLiveState = liveRepo.getStudentLiveState(session.id, joinRes.participant.id);
    assert.equal(studentLiveState.participant.avatarId, 'avatar_fox');

    // Verify teacher details includes avatarId for participants
    const teacherDetails = await liveRepo.getTeacherSessionDetails(session.id);
    const matchedP = teacherDetails.participants.find((p) => p.id === joinRes.participant.id);
    assert.ok(matchedP);
    assert.equal(matchedP.avatarId, 'avatar_fox');

    // Reconnect existing participant without specifying avatarId -> must preserve avatar_fox
    const reconnectRes = liveRepo.joinSession({
      pinCode: session.pinCode,
      displayName: 'سارة أحمد',
      existingParticipantId: joinRes.participant.id,
      reconnectToken: joinRes.reconnectToken,
    });
    assert.equal(reconnectRes.reconnected, true);
    assert.equal(reconnectRes.participant.avatarId, 'avatar_fox');

    // Join with an unknown avatarId -> safely defaults to avatar_cat
    const fallbackRes = liveRepo.joinSession({
      pinCode: session.pinCode,
      displayName: 'علي حسن',
      avatarId: 'invalid_avatar_xyz',
    });
    assert.equal(fallbackRes.participant.avatarId, 'avatar_cat');

    // Start and complete session -> finalResults must preserve avatarId
    await liveRepo.startSession(session.id);
    const completed = await liveRepo.completeSession(session.id);
    assert.ok(completed.finalResults);
    const saraFinal = completed.finalResults.find((e) => e.participantId === joinRes.participant.id);
    assert.equal(saraFinal?.avatarId, 'avatar_fox');
  });

  it('3. safely migrates older database without full_screen_mode or avatar_id columns', () => {
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-legacy-migration-test-'));
    const legacyDbPath = path.join(legacyDir, 'legacy.sqlite');
    const legacyDb = new DatabaseSync(legacyDbPath);

    // Create legacy tables without full_screen_mode and without avatar_id
    legacyDb.exec(`
      CREATE TABLE live_sessions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        quiz_title TEXT NOT NULL,
        quiz_subject TEXT,
        quiz_grade TEXT,
        pin_code TEXT NOT NULL,
        host_token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        current_question_index INTEGER NOT NULL DEFAULT -1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE live_session_participants (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        reconnect_token TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      INSERT INTO live_sessions (id, quiz_id, quiz_title, pin_code, host_token, created_at, updated_at)
      VALUES ('s1', 'q1', 'Legacy Quiz', '123456', 'tok1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

      INSERT INTO live_session_participants (id, session_id, display_name, normalized_name, reconnect_token, joined_at, last_seen_at)
      VALUES ('p1', 's1', 'أحمد', 'احمد', 'rec1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    `);
    legacyDb.close();

    // Now run initializeDatabase on the legacy file
    const migratedDb = initializeDatabase(legacyDbPath);

    // Verify existing rows are preserved
    const sessionCount = migratedDb
      .prepare('SELECT COUNT(*) as cnt FROM live_sessions')
      .get() as { cnt: number };
    assert.equal(sessionCount.cnt, 1);

    const participantCount = migratedDb
      .prepare('SELECT COUNT(*) as cnt FROM live_session_participants')
      .get() as { cnt: number };
    assert.equal(participantCount.cnt, 1);

    // Verify columns were added safely
    const sessionCols = (migratedDb.prepare('PRAGMA table_info(live_sessions)').all() as Array<{ name: string }>).map((c) => c.name);
    assert.ok(sessionCols.includes('full_screen_mode'));

    const participantCols = (migratedDb.prepare('PRAGMA table_info(live_session_participants)').all() as Array<{ name: string }>).map((c) => c.name);
    assert.ok(participantCols.includes('avatar_id'));

    // Verify default values on existing row
    const pRow = migratedDb.prepare('SELECT avatar_id FROM live_session_participants WHERE id = ?').get('p1') as { avatar_id: string };
    assert.equal(pRow.avatar_id, 'avatar_cat');

    migratedDb.close();
    fs.rmSync(legacyDir, { recursive: true, force: true });
  });
});

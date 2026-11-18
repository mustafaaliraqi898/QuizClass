import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { SqliteLiveSessionRepository } from '../server/services/liveSessionRepository.ts';
import { NOOP_LIVE_SESSION_HUB } from '../server/services/liveSessionSocket.ts';
import { SqliteResultsArchiveRepository } from '../server/services/resultsArchiveRepository.ts';

// 1x1 valid PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('QuizClass Results Archive System Integration Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let httpServer: Server;
  let baseUrl: string;

  async function startServerWithExistingDb() {
    db = initializeDatabase(storagePaths.dbFilePath);
    const app = createServerApp(db, storagePaths, NOOP_LIVE_SESSION_HUB);
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  }

  async function stopServerAndDb() {
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    if (db) {
      db.close();
    }
  }

  async function uploadQuestionImage(): Promise<{ imagePath: string; imageUrl: string }> {
    const form = new FormData();
    const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    form.append('image', blob, 'question.png');

    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      body: form,
    });
    assert.equal(res.status, 201);
    return res.json();
  }

  async function createBankQuestion(payload: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 201);
    return res.json();
  }

  async function createQuiz(payload: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 201);
    return res.json();
  }

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-results-archive-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    await startServerWithExistingDb();
  });

  after(async () => {
    await stopServerAndDb();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  let savedArchiveId = '';
  let savedQuizId = '';
  let savedQuestion1Id = '';
  let savedArchivedImageUrl = '';

  it('1. automatically archives a naturally completed live quiz with exact rankings, accuracy, images, and per-question answers', async () => {
    const uploadedImg = await uploadQuestionImage();

    const q1 = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'ما الكوكب الأحمر في المجموعة الشمسية؟',
      imagePath: uploadedImg.imagePath,
      correctBoolean: null,
      subject: 'العلوم',
      grade: 'الخامس الابتدائي',
      options: [
        { optionText: 'المريخ', imagePath: null, isCorrect: true },
        { optionText: 'الزهرة', imagePath: null, isCorrect: false },
        { optionText: 'عطارد', imagePath: null, isCorrect: false },
      ],
    });
    savedQuestion1Id = q1.id;

    const q2 = await createBankQuestion({
      type: 'true_false',
      prompt: 'الماء يغلي عند درجة 100 مئوية تحت الضغط القياسي.',
      imagePath: null,
      correctBoolean: true,
      subject: 'العلوم',
      grade: 'الخامس الابتدائي',
    });

    const quiz = await createQuiz({
      title: 'مسابقة العلوم - الفضاء والمادة',
      subject: 'العلوم',
      grade: 'الخامس الابتدائي',
      defaultTimeSeconds: 20,
      questions: [
        { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 20 },
        { kind: 'bank_question', sourceQuestionId: q2.id, timeLimitSeconds: 20 },
      ],
    });
    savedQuizId = quiz.id;

    const createSessionRes = await fetch(`${baseUrl}/api/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: quiz.id,
        settings: {
          questionIntroSeconds: 1,
          advanceMode: 'manual',
          autoAdvanceSeconds: 1,
          allowAnswerChange: false,
          allowLateJoin: true,
          scoringMode: 'accuracy_only',
        },
      }),
    });
    assert.equal(createSessionRes.status, 201);
    const session = await createSessionRes.json();

    const join = async (displayName: string, avatarId: string) => {
      const res = await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: session.pinCode, displayName, avatarId }),
      });
      assert.equal(res.status, 201);
      return res.json();
    };

    const pAli = await join('علي محمد', 'avatar_lion');
    const pNoura = await join('نورة خالد', 'avatar_owl');
    const pZaid = await join('زيد فهد', 'avatar_robot');

    // Start session & run Q1 + Q2 deterministically
    const startRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(startRes.status, 200);

    const repo = new SqliteLiveSessionRepository(db, storagePaths);
    assert.equal(repo.beginAnsweringPhase(session.id, 0), true);

    const q1State = await (await fetch(`${baseUrl}/api/live-sessions/${session.id}`)).json();
    const q1Id = q1State.currentQuestion.id;
    const correctOptQ1 = q1State.currentQuestion.options.find(
      (o: { optionText: string }) => o.optionText === 'المريخ'
    );
    const wrongOptQ1 = q1State.currentQuestion.options.find(
      (o: { optionText: string }) => o.optionText === 'الزهرة'
    );

    // Ali answers right, Noura answers wrong, Zaid skips Q1
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pAli.participant.id,
        reconnectToken: pAli.reconnectToken,
        sessionQuestionId: q1Id,
        selectedOptionId: correctOptQ1.id,
      }),
    });
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pNoura.participant.id,
        reconnectToken: pNoura.reconnectToken,
        sessionQuestionId: q1Id,
        selectedOptionId: wrongOptQ1.id,
      }),
    });

    assert.equal(repo.finalizeCurrentQuestion(session.id, 0), true);

    // Advance to Q2
    const nextRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/next-question`, {
      method: 'POST',
    });
    assert.equal(nextRes.status, 200);
    assert.equal(repo.beginAnsweringPhase(session.id, 1), true);

    const q2State = await (await fetch(`${baseUrl}/api/live-sessions/${session.id}`)).json();
    const q2Id = q2State.currentQuestion.id;

    // Ali answers right, Noura answers right, Zaid answers wrong
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pAli.participant.id,
        reconnectToken: pAli.reconnectToken,
        sessionQuestionId: q2Id,
        selectedBoolean: true,
      }),
    });
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pNoura.participant.id,
        reconnectToken: pNoura.reconnectToken,
        sessionQuestionId: q2Id,
        selectedBoolean: true,
      }),
    });
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pZaid.participant.id,
        reconnectToken: pZaid.reconnectToken,
        sessionQuestionId: q2Id,
        selectedBoolean: false,
      }),
    });

    assert.equal(repo.finalizeCurrentQuestion(session.id, 1), true);

    // Final advance triggers completed + automatic transactional archival
    const finishRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/next-question`, {
      method: 'POST',
    });
    assert.equal(finishRes.status, 200);
    const finishedSession = await finishRes.json();
    assert.equal(finishedSession.status, 'completed');

    // Verify archive list API
    const listRes = await fetch(`${baseUrl}/api/results`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.totalCount, 1);
    assert.equal(listData.archives.length, 1);

    const archive = listData.archives[0];
    savedArchiveId = archive.id;
    assert.equal(archive.liveSessionId, session.id);
    assert.equal(archive.quizTitle, 'مسابقة العلوم - الفضاء والمادة');
    assert.equal(archive.questionCount, 2);
    assert.equal(archive.participantCount, 3);
    assert.equal(archive.scoringMode, 'accuracy_only');

    // Verify Level 2 session results details
    const detailRes = await fetch(`${baseUrl}/api/results/${archive.id}`);
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.equal(detailData.participants.length, 3);

    const [first, second, third] = detailData.participants;
    assert.equal(first.displayName, 'علي محمد');
    assert.equal(first.avatarId, 'avatar_lion');
    assert.equal(first.rankPosition, 1);
    assert.equal(first.totalScore, 2000);
    assert.equal(first.correctCount, 2);
    assert.equal(first.wrongCount, 0);
    assert.equal(first.unansweredCount, 0);
    assert.equal(first.accuracyPercent, 100);

    assert.equal(second.displayName, 'نورة خالد');
    assert.equal(second.rankPosition, 2);
    assert.equal(second.totalScore, 1000);
    assert.equal(second.correctCount, 1);
    assert.equal(second.wrongCount, 1);
    assert.equal(second.unansweredCount, 0);
    assert.equal(second.accuracyPercent, 50);

    assert.equal(third.displayName, 'زيد فهد');
    assert.equal(third.rankPosition, 3);
    assert.equal(third.totalScore, 0);
    assert.equal(third.correctCount, 0);
    assert.equal(third.wrongCount, 1);
    assert.equal(third.unansweredCount, 1);
    assert.equal(third.accuracyPercent, 0);

    // Verify Level 3 participant breakdown for Noura & Zaid
    const nouraBreakdownRes = await fetch(
      `${baseUrl}/api/results/${archive.id}/participants/${second.id}`
    );
    assert.equal(nouraBreakdownRes.status, 200);
    const nouraBreakdown = await nouraBreakdownRes.json();
    assert.equal(nouraBreakdown.questions.length, 2);

    const nQ1 = nouraBreakdown.questions[0];
    assert.equal(nQ1.prompt, 'ما الكوكب الأحمر في المجموعة الشمسية؟');
    assert.ok(nQ1.imageUrl);
    savedArchivedImageUrl = nQ1.imageUrl;
    assert.equal(nQ1.selectedOptionText, 'الزهرة');
    assert.equal(nQ1.correctOptionText, 'المريخ');
    assert.equal(nQ1.outcome, 'wrong');
    assert.equal(nQ1.pointsAwarded, 0);

    const nQ2 = nouraBreakdown.questions[1];
    assert.equal(nQ2.selectedBoolean, true);
    assert.equal(nQ2.correctBoolean, true);
    assert.equal(nQ2.outcome, 'correct');
    assert.equal(nQ2.pointsAwarded, 1000);

    const zaidBreakdownRes = await fetch(
      `${baseUrl}/api/results/${archive.id}/participants/${third.id}`
    );
    const zaidBreakdown = await zaidBreakdownRes.json();
    assert.equal(zaidBreakdown.questions[0].outcome, 'unanswered');
    assert.equal(zaidBreakdown.questions[0].selectedOptionText, null);
    assert.equal(zaidBreakdown.questions[0].pointsAwarded, 0);
    assert.equal(zaidBreakdown.questions[1].outcome, 'wrong');
  });

  it('2. remains completely isolated and keeps archived images after editing bank questions AND deleting both bank questions and original quiz', async () => {
    // Edit question 1 in Question Bank completely (change prompt and correct answer)
    const updateBankRes = await fetch(`${baseUrl}/api/questions/${savedQuestion1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال معدّل كلياً بعد انتهاء المسابقة',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'خيار جديد أ', imagePath: null, isCorrect: false },
          { optionText: 'خيار جديد ب', imagePath: null, isCorrect: true },
        ],
      }),
    });
    assert.equal(updateBankRes.status, 200);

    // Delete original quiz AND question bank item
    const delQuizRes = await fetch(`${baseUrl}/api/quizzes/${savedQuizId}`, {
      method: 'DELETE',
    });
    assert.equal(delQuizRes.status, 204);

    const delQRes = await fetch(`${baseUrl}/api/questions/${savedQuestion1Id}`, {
      method: 'DELETE',
    });
    assert.equal(delQRes.status, 204);

    // Archive MUST still exist with original question prompt, options, and image!
    const detailRes = await fetch(`${baseUrl}/api/results/${savedArchiveId}`);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.session.quizTitle, 'مسابقة العلوم - الفضاء والمادة');
    assert.equal(detail.participants.length, 3);

    const aliDetail = await (
      await fetch(`${baseUrl}/api/results/${savedArchiveId}/participants/${detail.participants[0].id}`)
    ).json();
    assert.equal(aliDetail.questions[0].prompt, 'ما الكوكب الأحمر في المجموعة الشمسية؟');
    assert.equal(aliDetail.questions[0].selectedOptionText, 'المريخ');
    assert.equal(aliDetail.questions[0].correctOptionText, 'المريخ');

    // Preserved archived image file must still return HTTP 200
    const imgRes = await fetch(`${baseUrl}${savedArchivedImageUrl}`);
    assert.equal(imgRes.status, 200);
  });

  it('3. survives full database and server restart without losing any archived results', async () => {
    await stopServerAndDb();
    await startServerWithExistingDb();

    const listRes = await fetch(`${baseUrl}/api/results`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.totalCount, 1);
    assert.equal(listData.archives[0].id, savedArchiveId);

    const detailRes = await fetch(`${baseUrl}/api/results/${savedArchiveId}`);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.participants.length, 3);
  });

  it('4. archives manual early completeSession calls, prevents duplicates on repeated calls, and handles 0-participant sessions', async () => {
    const q = await createBankQuestion({
      type: 'true_false',
      prompt: 'الشمس نجم مضيء بذاته.',
      imagePath: null,
      correctBoolean: true,
    });
    const quiz = await createQuiz({
      title: 'مسابقة الفلك القصيرة',
      defaultTimeSeconds: 15,
      questions: [{ kind: 'bank_question', sourceQuestionId: q.id, timeLimitSeconds: 15 }],
    });

    // Session A: Manual complete during answering with 1 participant
    const sA = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id }),
      })
    ).json();

    const joinRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: sA.pinCode, displayName: 'ليلى', avatarId: 'avatar_panda' }),
    });
    assert.equal(joinRes.status, 201);
    const pLayla = await joinRes.json();

    await fetch(`${baseUrl}/api/live-sessions/${sA.id}/start`, { method: 'POST' });
    const repo = new SqliteLiveSessionRepository(db, storagePaths);
    assert.equal(repo.beginAnsweringPhase(sA.id, 0), true);

    const liveState = await (await fetch(`${baseUrl}/api/live-sessions/${sA.id}`)).json();
    await fetch(`${baseUrl}/api/live-sessions/${sA.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: pLayla.participant.id,
        reconnectToken: pLayla.reconnectToken,
        sessionQuestionId: liveState.currentQuestion.id,
        selectedBoolean: true,
      }),
    });

    // Complete manually
    const completeRes1 = await fetch(`${baseUrl}/api/live-sessions/${sA.id}/complete`, {
      method: 'POST',
    });
    assert.equal(completeRes1.status, 200);

    // Repeat complete + direct atomic archive call -> must stay idempotent!
    const completeRes2 = await fetch(`${baseUrl}/api/live-sessions/${sA.id}/complete`, {
      method: 'POST',
    });
    assert.equal(completeRes2.status, 200);
    const archiveRepo = new SqliteResultsArchiveRepository(db);
    assert.equal(archiveRepo.archiveCompletedSessionAtomic(sA.id), false);

    // Session B: 0 participants completed cleanly
    const sB = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id }),
      })
    ).json();
    await fetch(`${baseUrl}/api/live-sessions/${sB.id}/start`, { method: 'POST' });
    const emptyCompleteRes = await fetch(`${baseUrl}/api/live-sessions/${sB.id}/complete`, {
      method: 'POST',
    });
    assert.equal(emptyCompleteRes.status, 200);

    const listData = await (await fetch(`${baseUrl}/api/results`)).json();
    assert.equal(listData.totalCount, 3);

    const matchingSA = listData.archives.filter(
      (a: { liveSessionId: string }) => a.liveSessionId === sA.id
    );
    assert.equal(matchingSA.length, 1);

    const matchingSB = listData.archives.find(
      (a: { liveSessionId: string }) => a.liveSessionId === sB.id
    );
    assert.ok(matchingSB);
    assert.equal(matchingSB.participantCount, 0);

    const emptyDetail = await (await fetch(`${baseUrl}/api/results/${matchingSB.id}`)).json();
    assert.deepEqual(emptyDetail.participants, []);
  });

  it('5. supports search by quiz title, date filtering, newest-first ordering, and backfills legacy pre-archive completed sessions safely', async () => {
    // Search filter
    const searchRes = await fetch(`${baseUrl}/api/results?search=${encodeURIComponent('الفلك')}`);
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.equal(searchData.archives.length, 2);

    // Date filter matching today's local date + mismatching past date
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayRes = await fetch(`${baseUrl}/api/results?date=${todayLocal}`);
    assert.equal(todayRes.status, 200);
    assert.equal((await todayRes.json()).archives.length, 3);

    const oldRes = await fetch(`${baseUrl}/api/results?date=2001-01-01`);
    assert.equal(oldRes.status, 200);
    assert.equal((await oldRes.json()).archives.length, 0);

    // Validation errors for malformed date / missing archive ID
    const badDateRes = await fetch(`${baseUrl}/api/results?date=not-a-date`);
    assert.equal(badDateRes.status, 400);
    const missingArchiveRes = await fetch(`${baseUrl}/api/results/nonexistent-id`);
    assert.equal(missingArchiveRes.status, 404);

    // Simulate a legacy completed session present in live_sessions BEFORE archive tables existed
    const q = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال قديم محفوظ قبل التحديث.',
      imagePath: null,
      correctBoolean: false,
    });
    const legacyQuiz = await createQuiz({
      title: 'مسابقة تاريخية قديمة',
      defaultTimeSeconds: 10,
      questions: [{ kind: 'bank_question', sourceQuestionId: q.id, timeLimitSeconds: 10 }],
    });
    const legacySessionId = 'legacy-session-001';
    const legacyQId = 'legacy-sq-001';
    const legacyPId = 'legacy-part-001';
    db.prepare(
      `
      INSERT INTO live_sessions (
        id, quiz_id, quiz_title, pin_code, host_token, status,
        current_question_index, current_phase, created_at, started_at, ended_at, updated_at
      ) VALUES (?, ?, ?, '112233', 'tok', 'completed', 0, 'final_results', '2025-01-10T10:00:00.000Z', '2025-01-10T10:01:00.000Z', '2025-01-10T10:05:00.000Z', '2025-01-10T10:05:00.000Z')
    `
    ).run(legacySessionId, legacyQuiz.id, legacyQuiz.title);

    db.prepare(
      `
      INSERT INTO live_session_questions (
        id, session_id, question_order, type, prompt, correct_boolean, time_limit_seconds, points, results_finalized
      ) VALUES (?, ?, 0, 'true_false', 'سؤال قديم محفوظ قبل التحديث.', 0, 10, 1000, 1)
    `
    ).run(legacyQId, legacySessionId);

    db.prepare(
      `
      INSERT INTO live_session_participants (
        id, session_id, display_name, normalized_name, reconnect_token,
        total_score, correct_count, wrong_count, total_response_time_ms, rank_position,
        joined_at, last_seen_at
      ) VALUES (?, ?, 'طارق', 'طارق', 'rec', 1000, 1, 0, 1200, 1, '2025-01-10T10:00:30.000Z', '2025-01-10T10:05:00.000Z')
    `
    ).run(legacyPId, legacySessionId);

    db.prepare(
      `
      INSERT INTO live_session_answers (
        id, session_id, session_question_id, participant_id, selected_boolean, is_correct, response_time_ms, points_awarded, answered_at
      ) VALUES ('legacy-ans-001', ?, ?, ?, 0, 1, 1200, 1000, '2025-01-10T10:02:00.000Z')
    `
    ).run(legacySessionId, legacyQId, legacyPId);

    // Restart server -> initializeDatabase backfills legacy completed session once
    await stopServerAndDb();
    await startServerWithExistingDb();

    const allNewestRes = await fetch(`${baseUrl}/api/results?sort=newest`);
    const allNewest = await allNewestRes.json();
    assert.equal(allNewest.totalCount, 4);
    assert.equal(allNewest.archives[allNewest.archives.length - 1].liveSessionId, legacySessionId);
  });
});

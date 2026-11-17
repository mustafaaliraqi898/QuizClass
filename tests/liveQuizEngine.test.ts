import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { SqliteLiveSessionRepository } from '../server/services/liveSessionRepository.ts';
import {
  attachLiveSessionSocket,
  type LiveSessionBroadcastHub,
  NOOP_LIVE_SESSION_HUB,
} from '../server/services/liveSessionSocket.ts';

function connectClient(baseUrl: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Timed out connecting Socket.IO client'));
    }, 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emitWithAck<T = Record<string, unknown>>(
  socket: ClientSocket,
  event: string,
  payload: unknown
): Promise<{ ok: boolean; error?: string; data?: T }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack on ${event}`));
    }, 5000);
    socket.emit(event, payload, (res: { ok: boolean; error?: string; data?: T }) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function waitForSocketEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  predicate?: (payload: T) => boolean,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for event ${event}`));
    }, timeoutMs);
    const listener = (payload: T) => {
      if (!predicate || predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, listener);
        resolve(payload);
      }
    };
    socket.on(event, listener);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('QuizClass Live Quiz Engine (Phase 4 Part 2) Integration Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let httpServer: Server;
  let liveHub: LiveSessionBroadcastHub;
  let baseUrl: string;
  const openSockets: ClientSocket[] = [];

  function trackSocket(socket: ClientSocket): ClientSocket {
    openSockets.push(socket);
    return socket;
  }

  async function startServerWithExistingDb() {
    db = initializeDatabase(storagePaths.dbFilePath);
    let hubImpl: LiveSessionBroadcastHub = NOOP_LIVE_SESSION_HUB;
    const hubProxy: LiveSessionBroadcastHub = {
      broadcastTeacherSessionUpdate: (sessionId, requestOrigin) =>
        hubImpl.broadcastTeacherSessionUpdate(sessionId, requestOrigin),
      broadcastStudentSessionStatus: (sessionId) =>
        hubImpl.broadcastStudentSessionStatus(sessionId),
      syncSessionSchedule: (sessionId) => hubImpl.syncSessionSchedule(sessionId),
      close: () => hubImpl.close(),
    };

    const app = createServerApp(db, storagePaths, hubProxy);
    httpServer = http.createServer(app);
    liveHub = attachLiveSessionSocket(httpServer, db, storagePaths);
    hubImpl = liveHub;

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  }

  async function stopServerAndDb() {
    while (openSockets.length > 0) {
      const s = openSockets.pop();
      if (s && s.connected) {
        s.disconnect();
      }
    }
    if (liveHub) {
      await liveHub.close();
    }
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    if (db) {
      db.close();
    }
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
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-engine-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    await startServerWithExistingDb();
  });

  after(async () => {
    await stopServerAndDb();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  it('1. executes full 4-stage live quiz cycle (intro without options -> answering -> results reveal -> auto-advance -> final leaderboard) with speed+accuracy scoring, zero answer leakage, answer-change toggle ON, and reconnect sync', async () => {
    const q1 = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'ما عاصمة المملكة العربية السعودية؟',
      imagePath: null,
      correctBoolean: null,
      options: [
        { optionText: 'الرياض', imagePath: null, isCorrect: true },
        { optionText: 'جدة', imagePath: null, isCorrect: false },
        { optionText: 'الدمام', imagePath: null, isCorrect: false },
      ],
    });
    const q2 = await createBankQuestion({
      type: 'true_false',
      prompt: 'يدور القمر حول الأرض.',
      imagePath: null,
      correctBoolean: true,
    });

    const quiz = await createQuiz({
      title: 'مسابقة المحرك الكاملة التلقائية',
      defaultTimeSeconds: 5,
      questions: [
        { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 5 },
        { kind: 'bank_question', sourceQuestionId: q2.id, timeLimitSeconds: 5 },
      ],
    });

    const session = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          settings: {
            questionIntroSeconds: 1,
            advanceMode: 'auto',
            autoAdvanceSeconds: 1,
            allowAnswerChange: true,
            allowLateJoin: true,
            scoringMode: 'speed_and_accuracy',
          },
        }),
      })
    ).json();

    assert.equal(session.settings.questionIntroSeconds, 1);
    assert.equal(session.settings.allowAnswerChange, true);

    // Join 3 students (Student 3 will not answer Q1 to test unanswered count)
    const joinStudent = async (name: string) => {
      const res = await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: session.pinCode, displayName: name }),
      });
      assert.equal(res.status, 201);
      return res.json();
    };

    const s1 = await joinStudent('أحمد السالم');
    const s2 = await joinStudent('سارة الحربي');
    const s3 = await joinStudent('عمر الزهراني');

    const teacherSock = trackSocket(await connectClient(baseUrl));
    const s1Sock = trackSocket(await connectClient(baseUrl));
    const s2Sock = trackSocket(await connectClient(baseUrl));
    const s3Sock = trackSocket(await connectClient(baseUrl));

    await emitWithAck(teacherSock, 'teacher:subscribe', {
      sessionId: session.id,
      hostToken: session.hostToken,
    });
    await emitWithAck(s1Sock, 'student:subscribe', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
    });
    await emitWithAck(s2Sock, 'student:subscribe', {
      sessionId: session.id,
      participantId: s2.participant.id,
      reconnectToken: s2.reconnectToken,
    });
    await emitWithAck(s3Sock, 'student:subscribe', {
      sessionId: session.id,
      participantId: s3.participant.id,
      reconnectToken: s3.reconnectToken,
    });

    // Listen for Q1 Stage 1 (question_intro) on Student 1
    const s1IntroPromise = waitForSocketEvent<any>(
      s1Sock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'question_intro' && st.session?.currentQuestionIndex === 0
    );
    const s1AnsweringPromise = waitForSocketEvent<any>(
      s1Sock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'answering' && st.session?.currentQuestionIndex === 0
    );

    // Start session
    const startRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(startRes.status, 200);
    const startedDetails = await startRes.json();
    assert.equal(startedDetails.currentPhase, 'question_intro');

    // Stage 1 assertions: prompt present, options ABSENT, zero answer leakage, answers rejected!
    const introState = await s1IntroPromise;
    assert.equal(introState.currentQuestion.prompt, 'ما عاصمة المملكة العربية السعودية؟');
    assert.equal(introState.currentQuestion.options, undefined);
    const introJson = JSON.stringify(introState);
    assert.equal(introJson.includes('isCorrect'), false);
    assert.equal(introJson.includes('correctOptionId'), false);
    assert.equal(introJson.includes('correctBoolean'), false);

    // Submitting answer during intro must fail
    const earlyAck = await emitWithAck(s1Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
      sessionQuestionId: introState.currentQuestion.id,
      selectedOptionId: startedDetails.currentQuestion.options[0].id,
    });
    assert.equal(earlyAck.ok, false);

    // Wait for Stage 2 (answering) after 1s intro
    const answeringState = await s1AnsweringPromise;
    assert.equal(answeringState.currentQuestion.options.length, 3);
    // ZERO answer leakage during answering!
    const answeringJson = JSON.stringify(answeringState);
    assert.equal(answeringJson.includes('isCorrect'), false);
    assert.equal(answeringJson.includes('correctOptionId'), false);
    assert.equal(answeringJson.includes('correctBoolean'), false);

    const correctOpt = answeringState.currentQuestion.options.find(
      (o: any) => o.optionText === 'الرياض'
    );
    const wrongOpt = answeringState.currentQuestion.options.find(
      (o: any) => o.optionText === 'جدة'
    );

    // Student 1 initially picks WRONG option, then changes to RIGHT option (allowAnswerChange: true)
    const s1FirstAck = await emitWithAck<any>(s1Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
      sessionQuestionId: answeringState.currentQuestion.id,
      selectedOptionId: wrongOpt.id,
    });
    assert.equal(s1FirstAck.ok, true);
    assert.equal(s1FirstAck.data.updated, false);

    await sleep(300);

    const s1SecondAck = await emitWithAck<any>(s1Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
      sessionQuestionId: answeringState.currentQuestion.id,
      selectedOptionId: correctOpt.id,
    });
    assert.equal(s1SecondAck.ok, true);
    assert.equal(s1SecondAck.data.updated, true);

    // Student 2 picks wrong option
    const s2Ack = await emitWithAck<any>(s2Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s2.participant.id,
      reconnectToken: s2.reconnectToken,
      sessionQuestionId: answeringState.currentQuestion.id,
      selectedOptionId: wrongOpt.id,
    });
    assert.equal(s2Ack.ok, true);

    // Disconnect Student 1 mid-question and reconnect -> state + remainingMs + myAnswer restored without resetting timer!
    const beforeDisconnectRemaining = answeringState.session.remainingMs as number;
    s1Sock.disconnect();
    await sleep(350);
    const s1Reconnected = trackSocket(await connectClient(baseUrl));
    const reSubAck = await emitWithAck<any>(s1Reconnected, 'student:subscribe', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
    });
    assert.equal(reSubAck.ok, true);
    assert.equal(reSubAck.data.session.currentPhase, 'answering');
    assert.equal(reSubAck.data.myAnswer.selectedOptionId, correctOpt.id);
    assert.ok(reSubAck.data.session.remainingMs < beforeDisconnectRemaining);

    // Prepare listeners for Q1 results reveal on both teacher & student
    const teacherQ1ResultsPromise = waitForSocketEvent<any>(
      teacherSock,
      'session:teacher_state',
      (st) => st.currentPhase === 'question_results' && st.currentQuestionIndex === 0,
      9000
    );
    const s1Q1ResultsPromise = waitForSocketEvent<any>(
      s1Reconnected,
      'session:student_state',
      (st) =>
        st.session?.currentPhase === 'question_results' && st.session?.currentQuestionIndex === 0,
      9000
    );

    // Also listen for auto-advance to Q2 intro & Q2 answering
    const s1Q2AnsweringPromise = waitForSocketEvent<any>(
      s1Reconnected,
      'session:student_state',
      (st) => st.session?.currentPhase === 'answering' && st.session?.currentQuestionIndex === 1,
      12000
    );

    const [teacherQ1Res, s1Q1Res] = await Promise.all([
      teacherQ1ResultsPromise,
      s1Q1ResultsPromise,
    ]);

    // Verify Teacher Q1 results reveal
    assert.equal(teacherQ1Res.questionResults.correctCount, 1);
    assert.equal(teacherQ1Res.questionResults.wrongCount, 1);
    assert.equal(teacherQ1Res.questionResults.unansweredCount, 1);
    assert.deepEqual(teacherQ1Res.questionResults.correctParticipantNames, ['أحمد السالم']);
    assert.equal(teacherQ1Res.questionResults.points, 1000);

    // Verify Student 1 Q1 result & exact server speed+accuracy formula
    assert.equal(s1Q1Res.questionResult.myResult.answered, true);
    assert.equal(s1Q1Res.questionResult.myResult.isCorrect, true);
    assert.equal(s1Q1Res.questionResult.correctOptionId, correctOpt.id);
    const q1DbRow = db
      .prepare(
        `SELECT response_time_ms, points_awarded FROM live_session_answers WHERE session_id = ? AND participant_id = ?`
      )
      .get(session.id, s1.participant.id) as { response_time_ms: number; points_awarded: number };
    const expectedQ1Pts = Math.round(1000 * ((5000 - q1DbRow.response_time_ms) / 5000));
    assert.equal(q1DbRow.points_awarded, expectedQ1Pts);
    assert.equal(s1Q1Res.questionResult.myResult.pointsAwarded, expectedQ1Pts);

    // Late answer after Q1 ended must fail!
    const lateAnswerAck = await emitWithAck(s3Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s3.participant.id,
      reconnectToken: s3.reconnectToken,
      sessionQuestionId: answeringState.currentQuestion.id,
      selectedOptionId: correctOpt.id,
    });
    assert.equal(lateAnswerAck.ok, false);

    // Verify auto-advance triggered Q2 answering automatically!
    const q2AnsweringState = await s1Q2AnsweringPromise;
    assert.equal(q2AnsweringState.currentQuestion.type, 'true_false');

    // S1 & S2 answer Q2 correctly, S3 answers wrong
    await emitWithAck(s1Reconnected, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s1.participant.id,
      reconnectToken: s1.reconnectToken,
      sessionQuestionId: q2AnsweringState.currentQuestion.id,
      selectedBoolean: true,
    });
    await emitWithAck(s2Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s2.participant.id,
      reconnectToken: s2.reconnectToken,
      sessionQuestionId: q2AnsweringState.currentQuestion.id,
      selectedBoolean: true,
    });
    await emitWithAck(s3Sock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: s3.participant.id,
      reconnectToken: s3.reconnectToken,
      sessionQuestionId: q2AnsweringState.currentQuestion.id,
      selectedBoolean: false,
    });

    // Wait for session to complete automatically after Q2 results + auto-advance
    const teacherCompletedPromise = waitForSocketEvent<any>(
      teacherSock,
      'session:teacher_state',
      (st) => st.status === 'completed' && st.currentPhase === 'final_results',
      12000
    );
    const s1CompletedPromise = waitForSocketEvent<any>(
      s1Reconnected,
      'session:student_state',
      (st) => st.session?.status === 'completed' && st.session?.currentPhase === 'final_results',
      12000
    );

    const [finalTeacher, finalStudent1] = await Promise.all([
      teacherCompletedPromise,
      s1CompletedPromise,
    ]);

    assert.equal(finalTeacher.finalResults.length, 3);
    assert.equal(finalTeacher.finalResults[0].participantId, s1.participant.id);
    assert.equal(finalTeacher.finalResults[0].rankPosition, 1);
    assert.equal(finalTeacher.finalResults[0].correctCount, 2);
    assert.equal(finalTeacher.finalResults[0].wrongCount, 0);
    assert.equal(finalTeacher.finalResults[0].unansweredCount, 0);

    assert.equal(finalTeacher.finalResults[1].participantId, s2.participant.id);
    assert.equal(finalTeacher.finalResults[1].correctCount, 1);
    assert.equal(finalTeacher.finalResults[1].wrongCount, 1);

    assert.equal(finalTeacher.finalResults[2].participantId, s3.participant.id);
    assert.equal(finalTeacher.finalResults[2].totalScore, 0);
    assert.equal(finalTeacher.finalResults[2].wrongCount, 1);
    assert.equal(finalTeacher.finalResults[2].unansweredCount, 1);

    assert.equal(finalStudent1.finalSummary.mySummary.rankPosition, 1);

    // Double-scoring guard: calling finalizeCurrentQuestion again must return false and preserve scores
    const repo = new SqliteLiveSessionRepository(db, storagePaths);
    assert.equal(repo.finalizeCurrentQuestion(session.id, 1), false);

    // Persistence across full server + DB restart!
    await stopServerAndDb();
    await startServerWithExistingDb();

    const persistedTeacher = await (
      await fetch(`${baseUrl}/api/live-sessions/${session.id}`)
    ).json();
    assert.equal(persistedTeacher.status, 'completed');
    assert.equal(persistedTeacher.finalResults[0].totalScore, finalTeacher.finalResults[0].totalScore);
    assert.equal(persistedTeacher.finalResults[2].unansweredCount, 1);

    const persistedStudentRes = await fetch(
      `${baseUrl}/api/live-sessions/${session.id}/student-state?participantId=${s1.participant.id}`,
      { headers: { 'x-reconnect-token': s1.reconnectToken } }
    );
    assert.equal(persistedStudentRes.status, 200);
    const persistedStudentState = await persistedStudentRes.json();
    assert.equal(persistedStudentState.finalSummary.mySummary.rankPosition, 1);
  });

  it('2. enforces manual advance mode, answer-change OFF (locks first answer), accuracy-only 1000pts scoring, late-join OFF blocking, and mid-results late-join ON rules', async () => {
    const q1 = await createBankQuestion({
      type: 'true_false',
      prompt: 'السؤال الأول في الاختبار اليدوي',
      imagePath: null,
      correctBoolean: true,
    });
    const q2 = await createBankQuestion({
      type: 'true_false',
      prompt: 'السؤال الثاني في الاختبار اليدوي',
      imagePath: null,
      correctBoolean: false,
    });

    // Quiz A: Manual mode + allowAnswerChange OFF + allowLateJoin OFF + accuracy_only
    const quizA = await createQuiz({
      title: 'مسابقة يدوية مغلقة الانضمام',
      defaultTimeSeconds: 5,
      questions: [
        { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 5 },
        { kind: 'bank_question', sourceQuestionId: q2.id, timeLimitSeconds: 5 },
      ],
    });

    const sessionA = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quizA.id }),
      })
    ).json();

    // Update settings via PUT /settings before starting
    const updatedRes = await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionIntroSeconds: 1,
        advanceMode: 'manual',
        allowAnswerChange: false,
        allowLateJoin: false,
        scoringMode: 'accuracy_only',
      }),
    });
    assert.equal(updatedRes.status, 200);
    const updatedSessionA = await updatedRes.json();
    assert.equal(updatedSessionA.settings.advanceMode, 'manual');
    assert.equal(updatedSessionA.settings.allowLateJoin, false);
    assert.equal(updatedSessionA.settings.scoringMode, 'accuracy_only');

    // Join 1 student before start
    const st1 = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: sessionA.pinCode, displayName: 'طالب أول' }),
      })
    ).json();

    const st1Sock = trackSocket(await connectClient(baseUrl));
    const teacherSock = trackSocket(await connectClient(baseUrl));
    await emitWithAck(teacherSock, 'teacher:subscribe', {
      sessionId: sessionA.id,
      hostToken: sessionA.hostToken,
    });
    await emitWithAck(st1Sock, 'student:subscribe', {
      sessionId: sessionA.id,
      participantId: st1.participant.id,
      reconnectToken: st1.reconnectToken,
    });

    const q1AnsweringPromise = waitForSocketEvent<any>(
      st1Sock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'answering' && st.session?.currentQuestionIndex === 0
    );

    // Start session -> settings locked afterwards!
    await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Updating settings after start must fail (409)
    const lockedSettingsRes = await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowLateJoin: true }),
    });
    assert.equal(lockedSettingsRes.status, 409);

    // Late join NEW student when allowLateJoin is FALSE -> lookup & join fail (409)
    const blockedLookup = await fetch(
      `${baseUrl}/api/live-sessions/lookup?pin=${sessionA.pinCode}`
    );
    assert.equal(blockedLookup.status, 409);
    const blockedJoin = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: sessionA.pinCode, displayName: 'طالب متأخر مرفوض' }),
    });
    assert.equal(blockedJoin.status, 409);

    // Existing participant CAN reconnect even with allowLateJoin OFF
    const reconnectAllowed = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinCode: sessionA.pinCode,
        displayName: st1.participant.displayName,
        existingParticipantId: st1.participant.id,
        reconnectToken: st1.reconnectToken,
      }),
    });
    assert.equal(reconnectAllowed.status, 200);

    const q1State = await q1AnsweringPromise;

    // Wait 1.5s then answer correctly -> accuracy_only MUST award exact 1000 points!
    await sleep(1500);
    const firstAnsAck = await emitWithAck<any>(st1Sock, 'student:submit_answer', {
      sessionId: sessionA.id,
      participantId: st1.participant.id,
      reconnectToken: st1.reconnectToken,
      sessionQuestionId: q1State.currentQuestion.id,
      selectedBoolean: true,
    });
    assert.equal(firstAnsAck.ok, true);

    // Attempt changing answer with allowAnswerChange OFF -> rejected!
    const changeBlockedAck = await emitWithAck<any>(st1Sock, 'student:submit_answer', {
      sessionId: sessionA.id,
      participantId: st1.participant.id,
      reconnectToken: st1.reconnectToken,
      sessionQuestionId: q1State.currentQuestion.id,
      selectedBoolean: false,
    });
    assert.equal(changeBlockedAck.ok, false);

    // Wait for Q1 results -> should award 1000 points and STAY in question_results (manual mode)
    const st1Results = await waitForSocketEvent<any>(
      st1Sock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'question_results',
      8000
    );
    assert.equal(st1Results.questionResult.myResult.pointsAwarded, 1000);
    assert.equal(st1Results.participant.totalScore, 1000);

    // Wait 1.5s: manual mode MUST NOT auto-advance!
    await sleep(1500);
    const stillWaitingTeacher = await (
      await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}`)
    ).json();
    assert.equal(stillWaitingTeacher.currentPhase, 'question_results');
    assert.equal(stillWaitingTeacher.currentQuestionIndex, 0);

    // Teacher manually advances to Q2!
    const q2IntroPromise = waitForSocketEvent<any>(
      st1Sock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'question_intro' && st.session?.currentQuestionIndex === 1
    );
    const nextRes = await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/next-question`, {
      method: 'POST',
    });
    assert.equal(nextRes.status, 200);
    const q2IntroState = await q2IntroPromise;
    assert.equal(q2IntroState.session.currentQuestionIndex, 1);

    // Complete session A cleanly
    await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/complete`, { method: 'POST' });

    // Now test Late Join ON during question_results + session isolation!
    const quizB = await createQuiz({
      title: 'مسابقة الانضمام المتأخر',
      defaultTimeSeconds: 5,
      questions: [
        { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 5 },
        { kind: 'bank_question', sourceQuestionId: q2.id, timeLimitSeconds: 5 },
      ],
    });
    const sessionB = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quizB.id,
          settings: {
            questionIntroSeconds: 1,
            advanceMode: 'manual',
            allowLateJoin: true,
          },
        }),
      })
    ).json();

    await fetch(`${baseUrl}/api/live-sessions/${sessionB.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Late student joins during Q1 intro -> sees Q1 prompt & remaining time without options
    const lateIntroJoin = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: sessionB.pinCode, displayName: 'متأخر في التمهيدي' }),
      })
    ).json();
    assert.equal(lateIntroJoin.liveState.session.currentPhase, 'question_intro');
    assert.equal(lateIntroJoin.liveState.currentQuestion.options, undefined);

    // Security isolation: student from Session A cannot submit answer into Session B!
    const crossAnswerRes = await fetch(`${baseUrl}/api/live-sessions/${sessionB.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: st1.participant.id,
        reconnectToken: st1.reconnectToken,
        sessionQuestionId: lateIntroJoin.liveState.currentQuestion.id,
        selectedBoolean: true,
      }),
    });
    assert.equal(crossAnswerRes.status, 403);

    // Wait until Q1 moves to question_results (1s intro + 5s answering)
    const lateIntroSock = trackSocket(await connectClient(baseUrl));
    await emitWithAck(lateIntroSock, 'student:subscribe', {
      sessionId: sessionB.id,
      participantId: lateIntroJoin.participant.id,
      reconnectToken: lateIntroJoin.reconnectToken,
    });
    await waitForSocketEvent<any>(
      lateIntroSock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'question_results',
      9000
    );

    // Late joiner entering during question_results sees joinedMidResult = true and gets 0 previous points!
    const lateResultsJoin = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: sessionB.pinCode, displayName: 'متأخر في النتائج' }),
      })
    ).json();
    assert.equal(lateResultsJoin.liveState.session.currentPhase, 'question_results');
    assert.equal(lateResultsJoin.liveState.questionResult.joinedMidResult, true);
    assert.equal(lateResultsJoin.liveState.participant.totalScore, 0);

    // Student cannot invoke teacher control events (including session:update_settings)
    const forbiddenUpdate = await emitWithAck(lateIntroSock, 'session:update_settings', {
      sessionId: sessionB.id,
      allowLateJoin: false,
    });
    assert.equal(forbiddenUpdate.ok, false);

    // Cleanup sessionB
    await fetch(`${baseUrl}/api/live-sessions/${sessionB.id}/complete`, { method: 'POST' });
  });

  it('3. recovers expired in-progress phase cleanly on server restart without losing saved answers or double-scoring', async () => {
    const q1 = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال اختبار استعادة الخادم',
      imagePath: null,
      correctBoolean: true,
    });
    const quiz = await createQuiz({
      title: 'مسابقة استعادة الخادم',
      defaultTimeSeconds: 5,
      questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 5 }],
    });

    const session = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          settings: {
            questionIntroSeconds: 1,
            advanceMode: 'manual',
            scoringMode: 'accuracy_only',
          },
        }),
      })
    ).json();

    const student = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: session.pinCode, displayName: 'طالب الاستعادة' }),
      })
    ).json();

    const stSock = trackSocket(await connectClient(baseUrl));
    await emitWithAck(stSock, 'student:subscribe', {
      sessionId: session.id,
      participantId: student.participant.id,
      reconnectToken: student.reconnectToken,
    });

    const answeringPromise = waitForSocketEvent<any>(
      stSock,
      'session:student_state',
      (st) => st.session?.currentPhase === 'answering'
    );

    await fetch(`${baseUrl}/api/live-sessions/${session.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const answeringState = await answeringPromise;
    await emitWithAck(stSock, 'student:submit_answer', {
      sessionId: session.id,
      participantId: student.participant.id,
      reconnectToken: student.reconnectToken,
      sessionQuestionId: answeringState.currentQuestion.id,
      selectedBoolean: true,
    });

    // Simulate server crash/restart while answering phase already expired in SQLite
    db.prepare(`UPDATE live_sessions SET phase_ends_at = ? WHERE id = ?`).run(
      new Date(Date.now() - 2000).toISOString(),
      session.id
    );

    await stopServerAndDb();
    await startServerWithExistingDb();

    // Boot recovery must have automatically finalized Q1 without losing the student's 1000pts answer!
    const recoveredTeacher = await (
      await fetch(`${baseUrl}/api/live-sessions/${session.id}`)
    ).json();
    assert.equal(recoveredTeacher.status, 'running');
    assert.equal(recoveredTeacher.currentPhase, 'question_results');
    assert.equal(recoveredTeacher.questionResults.correctCount, 1);
    assert.equal(recoveredTeacher.participants[0].totalScore, 1000);
    assert.equal(recoveredTeacher.participants[0].correctCount, 1);

    await fetch(`${baseUrl}/api/live-sessions/${session.id}/complete`, { method: 'POST' });
  });
});

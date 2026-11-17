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
  predicate?: (payload: T) => boolean
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for event ${event}`));
    }, 5000);
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

describe('QuizClass Live Quiz Sessions & Local Network Foundation Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let httpServer: Server;
  let liveHub: LiveSessionBroadcastHub;
  let baseUrl: string;
  let port: number;
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
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
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
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-live-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    await startServerWithExistingDb();
  });

  after(async () => {
    await stopServerAndDb();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  it('1. validates quiz existence, creates live session with 6-digit PIN + offline QR + network addresses, and prevents conflicting active sessions', async () => {
    // Non-existent quiz -> 404
    const missingRes = await fetch(`${baseUrl}/api/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: 'non-existent-quiz-id' }),
    });
    assert.equal(missingRes.status, 404);

    // Create real question + quiz
    const q1 = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'ما هي وحدة قياس القوة في النظام الدولي؟',
      imagePath: null,
      correctBoolean: null,
      subject: 'الفيزياء',
      grade: 'الصف العاشر',
      options: [
        { optionText: 'نيوتن', imagePath: null, isCorrect: true },
        { optionText: 'جول', imagePath: null, isCorrect: false },
        { optionText: 'واط', imagePath: null, isCorrect: false },
      ],
    });

    const quiz = await createQuiz({
      title: 'مسابقة القوة والحركة',
      subject: 'الفيزياء',
      grade: 'الصف العاشر',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 30 }],
    });

    // Launch live session
    const createRes = await fetch(`${baseUrl}/api/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.id }),
    });
    assert.equal(createRes.status, 201);
    const session = await createRes.json();

    assert.match(session.pinCode, /^\d{6}$/);
    assert.equal(session.status, 'waiting');
    assert.equal(session.quizId, quiz.id);
    assert.equal(session.questionCount, 1);
    assert.equal(session.participantCount, 0);
    assert.ok(typeof session.hostToken === 'string' && session.hostToken.length >= 32);
    assert.ok(Array.isArray(session.networkAddresses) && session.networkAddresses.length >= 1);
    assert.ok(session.primaryJoinUrl.includes(`/join?pin=${session.pinCode}`));
    assert.ok(session.primaryQrDataUrl.startsWith('data:image/png;base64,'));

    // Conflict prevention: launching same quiz again returns 409 ACTIVE_SESSION_EXISTS
    const conflictRes = await fetch(`${baseUrl}/api/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.id }),
    });
    assert.equal(conflictRes.status, 409);
    const conflictBody = await conflictRes.json();
    assert.equal(conflictBody.code, 'ACTIVE_SESSION_EXISTS');
    assert.equal(conflictBody.existingSession.id, session.id);

    // Editing or deleting quiz while session is active is blocked (409)
    const editBlocked = await fetch(`${baseUrl}/api/quizzes/${quiz.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'محاولة تعديل أثناء البث',
        defaultTimeSeconds: 30,
        questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 30 }],
      }),
    });
    assert.equal(editBlocked.status, 409);

    const deleteBlocked = await fetch(`${baseUrl}/api/quizzes/${quiz.id}`, { method: 'DELETE' });
    assert.equal(deleteBlocked.status, 409);

    // Cancel waiting session -> quiz remains draft and a fresh session can be created
    const cancelRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelRes.status, 200);
    const cancelled = await cancelRes.json();
    assert.equal(cancelled.status, 'cancelled');

    const quizAfterCancel = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(quizAfterCancel.lifecycleStatus, 'draft');

    // Now creating a new session for the same quiz succeeds with a fresh session ID
    const secondRes = await fetch(`${baseUrl}/api/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.id }),
    });
    assert.equal(secondRes.status, 201);
    const secondSession = await secondRes.json();
    assert.notEqual(secondSession.id, session.id);

    // Cleanup second session for clean subsequent tests
    await fetch(`${baseUrl}/api/live-sessions/${secondSession.id}/cancel`, { method: 'POST' });
  });

  it('2. handles public PIN lookup, Arabic digit normalization, duplicate student name blocking, and zero answer/token leakage', async () => {
    const qTf = await createBankQuestion({
      type: 'true_false',
      prompt: 'تدور الأرض حول الشمس مرة كل سنة.',
      imagePath: null,
      correctBoolean: true,
    });

    const quiz = await createQuiz({
      title: 'مسابقة الفضاء',
      defaultTimeSeconds: 20,
      questions: [{ kind: 'bank_question', sourceQuestionId: qTf.id, timeLimitSeconds: 20 }],
    });

    const session = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id }),
      })
    ).json();

    // Convert ASCII digits to Arabic-Indic digits to verify normalization
    const arabicPin = session.pinCode.replace(/\d/g, (d: string) =>
      String.fromCharCode(0x0660 + Number(d))
    );

    const lookupRes = await fetch(
      `${baseUrl}/api/live-sessions/lookup?pin=${encodeURIComponent(arabicPin)}`
    );
    assert.equal(lookupRes.status, 200);
    const lookupBody = await lookupRes.json();
    assert.equal(lookupBody.session.sessionId, session.id);
    assert.equal(lookupBody.session.quizTitle, 'مسابقة الفضاء');
    // Must NEVER leak hostToken, questions, isCorrect, correctBoolean
    const lookupSerialized = JSON.stringify(lookupBody);
    assert.equal(lookupSerialized.includes('hostToken'), false);
    assert.equal(lookupSerialized.includes('correctBoolean'), false);
    assert.equal(lookupSerialized.includes('isCorrect'), false);
    assert.equal(lookupSerialized.includes(session.hostToken), false);

    // Invalid PINs rejected
    assert.equal((await fetch(`${baseUrl}/api/live-sessions/lookup?pin=123`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/live-sessions/lookup?pin=000000`)).status, 404);

    // First student joins
    const join1Res = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinCode: arabicPin,
        displayName: '  أحمد   محمد ',
      }),
    });
    assert.equal(join1Res.status, 201);
    const join1Body = await join1Res.json();
    assert.equal(join1Body.participant.displayName, 'أحمد محمد');
    assert.equal(join1Body.reconnected, false);
    assert.ok(typeof join1Body.reconnectToken === 'string' && join1Body.reconnectToken.length >= 32);

    const joinSerialized = JSON.stringify(join1Body);
    assert.equal(joinSerialized.includes('hostToken'), false);
    assert.equal(joinSerialized.includes('correctBoolean'), false);
    assert.equal(joinSerialized.includes('isCorrect'), false);
    assert.equal(joinSerialized.includes(session.hostToken), false);

    // Duplicate variants must be rejected with 409
    const dupVariants = ['احمد محمد', 'أَحمَد  مُحَمَّد', 'احمد   محمد'];
    for (const dupName of dupVariants) {
      const dupRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: session.pinCode, displayName: dupName }),
      });
      assert.equal(dupRes.status, 409);
    }

    // Latin case + space duplicate rejection
    const joinEnRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: session.pinCode, displayName: 'Sara Ali' }),
    });
    assert.equal(joinEnRes.status, 201);

    const dupEnRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: session.pinCode, displayName: 'sara   ali' }),
    });
    assert.equal(dupEnRes.status, 409);

    // Cancel session -> lookup and join must fail with 409
    await fetch(`${baseUrl}/api/live-sessions/${session.id}/cancel`, { method: 'POST' });
    const cancelledLookup = await fetch(
      `${baseUrl}/api/live-sessions/lookup?pin=${session.pinCode}`
    );
    assert.equal(cancelledLookup.status, 409);
    const cancelledJoin = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: session.pinCode, displayName: 'طالب متأخر' }),
    });
    assert.equal(cancelledJoin.status, 409);
  });

  it('3. streams real-time multi-client Socket.IO lobby updates, handles disconnect/reconnect without duplicates, and enforces participant & control security', async () => {
    const q1 = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'كم عدد كواكب المجموعة الشمسية؟',
      imagePath: null,
      correctBoolean: null,
      options: [
        { optionText: '8', imagePath: null, isCorrect: true },
        { optionText: '9', imagePath: null, isCorrect: false },
      ],
    });
    const quizA = await createQuiz({
      title: 'مسابقة الاتصال اللحظي',
      defaultTimeSeconds: 25,
      questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 25 }],
    });
    const quizB = await createQuiz({
      title: 'مسابقة أخرى لعزل الجلسات',
      defaultTimeSeconds: 25,
      questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 25 }],
    });

    const sessionA = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quizA.id }),
      })
    ).json();

    const sessionB = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quizB.id }),
      })
    ).json();

    // Connect Teacher Socket
    const teacherSocket = trackSocket(await connectClient(baseUrl));

    // Reject unauthorized teacher subscribe
    const badTeacherAck = await emitWithAck(teacherSocket, 'teacher:subscribe', {
      sessionId: sessionA.id,
      hostToken: 'wrong-host-token',
    });
    assert.equal(badTeacherAck.ok, false);

    // Valid teacher subscribe
    const goodTeacherAck = await emitWithAck<{ participantCount: number }>(
      teacherSocket,
      'teacher:subscribe',
      {
        sessionId: sessionA.id,
        hostToken: sessionA.hostToken,
      }
    );
    assert.equal(goodTeacherAck.ok, true);
    assert.equal(goodTeacherAck.data?.participantCount, 0);

    // Join 2 students via HTTP and watch Teacher Socket update in real time
    const s1Join = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: sessionA.pinCode, displayName: 'خالد العتيبي' }),
      })
    ).json();
    const s2Join = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: sessionA.pinCode, displayName: 'نورة القحطاني' }),
      })
    ).json();

    const student1Socket = trackSocket(await connectClient(baseUrl));
    const student2Socket = trackSocket(await connectClient(baseUrl));

    const teacherBothConnectedPromise = waitForSocketEvent<{
      participants: Array<{ id: string; connectionStatus: string }>;
      connectedParticipantCount: number;
    }>(
      teacherSocket,
      'session:teacher_state',
      (state) => state.participants.length === 2 && state.connectedParticipantCount === 2
    );

    const s1Ack = await emitWithAck(student1Socket, 'student:subscribe', {
      sessionId: sessionA.id,
      participantId: s1Join.participant.id,
      reconnectToken: s1Join.reconnectToken,
    });
    assert.equal(s1Ack.ok, true);

    const s2Ack = await emitWithAck(student2Socket, 'student:subscribe', {
      sessionId: sessionA.id,
      participantId: s2Join.participant.id,
      reconnectToken: s2Join.reconnectToken,
    });
    assert.equal(s2Ack.ok, true);

    const stateBothOnline = await teacherBothConnectedPromise;
    assert.equal(stateBothOnline.participants.length, 2);
    assert.equal(stateBothOnline.connectedParticipantCount, 2);

    // Security check 1: Student 1 cannot send teacher control commands
    for (const forbiddenEvent of [
      'session:start',
      'session:cancel',
      'session:complete',
      'session:next_question',
    ]) {
      const forbiddenAck = await emitWithAck(student1Socket, forbiddenEvent, {
        sessionId: sessionA.id,
      });
      assert.equal(forbiddenAck.ok, false);
    }

    // Security check 2: Cross-session participant spoofing rejected on both HTTP (403) and Socket.IO
    const crossHttpRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinCode: sessionB.pinCode,
        displayName: 'خالد العتيبي',
        existingParticipantId: s1Join.participant.id,
        reconnectToken: s1Join.reconnectToken,
      }),
    });
    assert.equal(crossHttpRes.status, 403);

    const crossSocket = trackSocket(await connectClient(baseUrl));
    const crossSocketAck = await emitWithAck(crossSocket, 'student:subscribe', {
      sessionId: sessionB.id,
      participantId: s1Join.participant.id,
      reconnectToken: s1Join.reconnectToken,
    });
    assert.equal(crossSocketAck.ok, false);
    crossSocket.disconnect();

    // Disconnect Student 1 -> Teacher sees Student 1 disconnected & Student 2 still connected
    const teacherDisconnectUpdate = waitForSocketEvent<{
      participants: Array<{ id: string; connectionStatus: string }>;
      connectedParticipantCount: number;
    }>(
      teacherSocket,
      'session:teacher_state',
      (state) =>
        state.connectedParticipantCount === 1 &&
        state.participants.find((p) => p.id === s1Join.participant.id)?.connectionStatus ===
          'disconnected' &&
        state.participants.find((p) => p.id === s2Join.participant.id)?.connectionStatus ===
          'connected'
    );
    student1Socket.disconnect();
    await teacherDisconnectUpdate;

    // Reconnect Student 1 via HTTP + Socket.IO -> NO duplicate participant created
    const reconnectHttpRes = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinCode: sessionA.pinCode,
        displayName: s1Join.participant.displayName,
        existingParticipantId: s1Join.participant.id,
        reconnectToken: s1Join.reconnectToken,
      }),
    });
    assert.equal(reconnectHttpRes.status, 200);
    const reconnectBody = await reconnectHttpRes.json();
    assert.equal(reconnectBody.reconnected, true);
    assert.equal(reconnectBody.participant.id, s1Join.participant.id);

    const student1ReconnectedSocket = trackSocket(await connectClient(baseUrl));
    const teacherReconnectUpdate = waitForSocketEvent<{
      participantCount: number;
      connectedParticipantCount: number;
    }>(
      teacherSocket,
      'session:teacher_state',
      (state) => state.participantCount === 2 && state.connectedParticipantCount === 2
    );

    const s1ReAck = await emitWithAck(student1ReconnectedSocket, 'student:subscribe', {
      sessionId: sessionA.id,
      participantId: s1Join.participant.id,
      reconnectToken: s1Join.reconnectToken,
    });
    assert.equal(s1ReAck.ok, true);
    const afterReconnectState = await teacherReconnectUpdate;
    assert.equal(afterReconnectState.participantCount, 2);

    // Start session -> students receive running status broadcast immediately!
    const s1RunningPromise = waitForSocketEvent<{ session: { status: string } }>(
      student1ReconnectedSocket,
      'session:student_status',
      (p) => p.session.status === 'running'
    );
    const s2RunningPromise = waitForSocketEvent<{ session: { status: string } }>(
      student2Socket,
      'session:student_status',
      (p) => p.session.status === 'running'
    );

    const startRes = await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/start`, {
      method: 'POST',
    });
    assert.equal(startRes.status, 200);
    const startedSession = await startRes.json();
    assert.equal(startedSession.status, 'running');

    await Promise.all([s1RunningPromise, s2RunningPromise]);

    // Cleanup sessionB
    await fetch(`${baseUrl}/api/live-sessions/${sessionB.id}/cancel`, { method: 'POST' });
    // Leave sessionA running for persistence / lock checks in next test
    await fetch(`${baseUrl}/api/live-sessions/${sessionA.id}/complete`, { method: 'POST' });
  });

  it('4. locks quiz snapshot on start against bank sync updates and persists sessions & participants across server restarts', async () => {
    const bankQ = await createBankQuestion({
      type: 'true_false',
      prompt: 'السؤال الأصلي قبل بدء الجلسة',
      imagePath: null,
      correctBoolean: true,
    });

    const quiz = await createQuiz({
      title: 'مسابقة اختبار التثبيت والاستمرارية',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: bankQ.id, timeLimitSeconds: 30 }],
    });

    const session = await (
      await fetch(`${baseUrl}/api/live-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id }),
      })
    ).json();

    const studentJoin = await (
      await fetch(`${baseUrl}/api/live-sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: session.pinCode, displayName: 'سلمان الدوسري' }),
      })
    ).json();

    // Start session -> sets quiz lifecycle_status = 'started' & freezes live_session_questions
    const startRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/start`, {
      method: 'POST',
    });
    assert.equal(startRes.status, 200);

    const lockedQuiz = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(lockedQuiz.lifecycleStatus, 'started');

    // Edit question in Question Bank & attempt sync -> started quiz MUST be skipped!
    await fetch(`${baseUrl}/api/questions/${bankQ.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'تم تعديل السؤال في البنك بعد البدء',
        imagePath: null,
        correctBoolean: false,
      }),
    });

    const syncRes = await fetch(`${baseUrl}/api/questions/${bankQ.id}/sync-quizzes`, {
      method: 'POST',
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.updatedQuizCount, 0);
    assert.equal(syncBody.skippedLockedQuizCount, 1);

    // Frozen live_session_questions and quiz snapshot remain unchanged
    const quizAfterSync = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(quizAfterSync.questions[0].prompt, 'السؤال الأصلي قبل بدء الجلسة');
    assert.equal(quizAfterSync.questions[0].correctBoolean, true);

    const frozenRow = db
      .prepare(`SELECT prompt, correct_boolean FROM live_session_questions WHERE session_id = ?`)
      .get(session.id) as { prompt: string; correct_boolean: number };
    assert.equal(frozenRow.prompt, 'السؤال الأصلي قبل بدء الجلسة');
    assert.equal(frozenRow.correct_boolean, 1);

    // Full server + SQLite DB restart check (persistence!)
    await stopServerAndDb();
    await startServerWithExistingDb();

    const listAfterRestart = await (await fetch(`${baseUrl}/api/live-sessions`)).json();
    assert.ok(listAfterRestart.activeSession);
    assert.equal(listAfterRestart.activeSession.id, session.id);
    assert.equal(listAfterRestart.activeSession.pinCode, session.pinCode);
    assert.equal(listAfterRestart.activeSession.status, 'running');
    assert.equal(listAfterRestart.activeSession.participantCount, 1);
    assert.equal(
      listAfterRestart.activeSession.participants[0].id,
      studentJoin.participant.id
    );
    assert.equal(listAfterRestart.activeSession.participants[0].displayName, 'سلمان الدوسري');
    // On server reboot, stale connected sockets are marked disconnected cleanly until student reconnects
    assert.equal(
      listAfterRestart.activeSession.participants[0].connectionStatus,
      'disconnected'
    );

    // Complete session -> quiz becomes completed, new joins rejected
    const completeRes = await fetch(`${baseUrl}/api/live-sessions/${session.id}/complete`, {
      method: 'POST',
    });
    assert.equal(completeRes.status, 200);
    const completed = await completeRes.json();
    assert.equal(completed.status, 'completed');

    const completedQuiz = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(completedQuiz.lifecycleStatus, 'completed');

    const lateJoin = await fetch(`${baseUrl}/api/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: session.pinCode, displayName: 'متأخر بعد الانتهاء' }),
    });
    assert.equal(lateJoin.status, 409);
  });
});

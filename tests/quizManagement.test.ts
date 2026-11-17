import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { localAdminGuard } from '../server/middleware/localAdminGuard.ts';

const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

const VALID_WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x18, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii'),
  Buffer.from([0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
]);

describe('QuizClass Quiz Creation & Management Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let server: Server;
  let baseUrl: string;

  async function startAppWithExistingDb() {
    db = initializeDatabase(storagePaths.dbFilePath);
    const app = createServerApp(db, storagePaths);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  }

  async function stopAppAndDb() {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  }

  async function uploadImage(buffer: Buffer, mime: string, filename: string) {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(buffer)], { type: mime }), filename);
    const res = await fetch(`${baseUrl}/api/media/upload`, { method: 'POST', body: form });
    assert.equal(res.status, 201);
    return res.json() as Promise<{ imagePath: string; imageUrl: string }>;
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

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-quizzes-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    await startAppWithExistingDb();
  });

  after(async () => {
    try {
      await stopAppAndDb();
    } catch {
      // Ignore if already closed
    }
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  it('1. starts with zero saved quizzes and empty stats', async () => {
    const [listRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/api/quizzes`),
      fetch(`${baseUrl}/api/quizzes/stats`),
    ]);
    assert.equal(listRes.status, 200);
    assert.equal(statsRes.status, 200);

    const listData = await listRes.json();
    const statsData = await statsRes.json();
    assert.equal(listData.quizzes.length, 0);
    assert.equal(statsData.totalQuizzes, 0);
    assert.equal(statsData.totalQuizQuestions, 0);
  });

  it('2. validates quiz payloads, prevents duplicate questions, and checks random availability', async () => {
    const q1 = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال فيزياء 1',
      imagePath: null,
      correctBoolean: true,
      subject: 'الفيزياء',
      grade: 'الصف العاشر',
      difficulty: 'easy',
    });

    const q2 = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال فيزياء 2',
      imagePath: null,
      correctBoolean: false,
      subject: 'الفيزياء',
      grade: 'الصف العاشر',
      difficulty: 'medium',
    });

    await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال كيمياء 1',
      imagePath: null,
      correctBoolean: true,
      subject: 'الكيمياء',
      grade: 'الصف الحادي عشر',
      difficulty: 'hard',
    });

    // Empty title rejected
    const emptyTitleRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '   ',
        defaultTimeSeconds: 30,
        questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 30 }],
      }),
    });
    assert.equal(emptyTitleRes.status, 400);

    // Duplicate question rejected
    const dupRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'مسابقة مكررة',
        defaultTimeSeconds: 30,
        questions: [
          { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 30 },
          { kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 20 },
        ],
      }),
    });
    assert.equal(dupRes.status, 400);

    // Random preview excluding q1 in الفيزياء should leave exactly 1 available (q2)
    const previewRes = await fetch(`${baseUrl}/api/quizzes/random-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { subject: 'الفيزياء' },
        excludeQuestionIds: [q1.id],
        draw: false,
      }),
    });
    assert.equal(previewRes.status, 200);
    const previewData = await previewRes.json();
    assert.equal(previewData.availableCount, 1);

    // Drawing more than available rejected
    const overDrawRes = await fetch(`${baseUrl}/api/quizzes/random-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { subject: 'الفيزياء' },
        excludeQuestionIds: [q1.id],
        count: 2,
        draw: true,
      }),
    });
    assert.equal(overDrawRes.status, 400);

    // Drawing exact available succeeds without returning excluded q1
    const drawRes = await fetch(`${baseUrl}/api/quizzes/random-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { subject: 'الفيزياء' },
        excludeQuestionIds: [q1.id],
        count: 1,
        draw: true,
      }),
    });
    assert.equal(drawRes.status, 200);
    const drawn = await drawRes.json();
    assert.equal(drawn.questions.length, 1);
    assert.equal(drawn.questions[0].id, q2.id);
  });

  it('3. stores independent question & media snapshots that survive edits and deletions in Question Bank', async () => {
    const qImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'quiz-q.png');
    const optImg = await uploadImage(VALID_WEBP_BUFFER, 'image/webp', 'quiz-opt.webp');

    const originalQ1 = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'النص الأصلي للسؤال المصوّر',
      imagePath: qImg.imagePath,
      correctBoolean: null,
      subject: 'الأحياء',
      grade: 'الصف التاسع',
      difficulty: 'medium',
      options: [
        { optionText: 'الإجابة الأصلية الصحيحة', imagePath: optImg.imagePath, isCorrect: true },
        { optionText: 'خيار بديل', imagePath: null, isCorrect: false },
      ],
    });

    const originalQ2 = await createBankQuestion({
      type: 'true_false',
      prompt: 'النص الأصلي لسؤال صح أو خطأ',
      imagePath: null,
      correctBoolean: true,
    });

    // Create quiz with custom order & per-question times
    const createRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'مسابقة الاستقلالية الكاملة',
        subject: 'الأحياء',
        grade: 'الصف التاسع',
        description: 'اختبار التحقق من النسخ المستقلة',
        defaultTimeSeconds: 30,
        questions: [
          { kind: 'bank_question', sourceQuestionId: originalQ2.id, timeLimitSeconds: 15 },
          { kind: 'bank_question', sourceQuestionId: originalQ1.id, timeLimitSeconds: 45 },
        ],
      }),
    });
    assert.equal(createRes.status, 201);
    const createdQuiz = await createRes.json();
    assert.equal(createdQuiz.questionCount, 2);
    assert.equal(createdQuiz.totalDurationSeconds, 60);
    assert.equal(createdQuiz.questions[0].prompt, 'النص الأصلي لسؤال صح أو خطأ');
    assert.equal(createdQuiz.questions[0].timeLimitSeconds, 15);
    assert.equal(createdQuiz.questions[1].prompt, 'النص الأصلي للسؤال المصوّر');
    assert.equal(createdQuiz.questions[1].timeLimitSeconds, 45);
    assert.ok(createdQuiz.questions[1].imagePath.startsWith('quizzes/'));
    assert.ok(createdQuiz.questions[1].options[0].imagePath.startsWith('quizzes/'));

    // Edit originalQ2 in Question Bank (change prompt & correctBoolean)
    const editBankRes = await fetch(`${baseUrl}/api/questions/${originalQ2.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'نص معدّل في بنك الأسئلة بعد إنشاء المسابقة',
        imagePath: null,
        correctBoolean: false,
      }),
    });
    assert.equal(editBankRes.status, 200);

    // Delete originalQ1 from Question Bank (also deletes its questions/ PNG & WEBP files!)
    const delBankRes = await fetch(`${baseUrl}/api/questions/${originalQ1.id}`, {
      method: 'DELETE',
    });
    assert.equal(delBankRes.status, 204);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, qImg.imagePath)), false);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, optImg.imagePath)), false);

    // Restart server & DB and verify saved quiz snapshot & copied images are 100% intact
    await stopAppAndDb();
    await startAppWithExistingDb();

    const fetchedRes = await fetch(`${baseUrl}/api/quizzes/${createdQuiz.id}`);
    assert.equal(fetchedRes.status, 200);
    const fetchedQuiz = await fetchedRes.json();

    assert.equal(fetchedQuiz.questions[0].prompt, 'النص الأصلي لسؤال صح أو خطأ');
    assert.equal(fetchedQuiz.questions[0].correctBoolean, true);
    assert.equal(fetchedQuiz.questions[1].prompt, 'النص الأصلي للسؤال المصوّر');
    assert.equal(
      fetchedQuiz.questions[1].options.find((o: { isCorrect: boolean }) => o.isCorrect)
        ?.optionText,
      'الإجابة الأصلية الصحيحة'
    );

    const quizImgRes = await fetch(`${baseUrl}${fetchedQuiz.questions[1].imageUrl}`);
    assert.equal(quizImgRes.status, 200);
    assert.equal(quizImgRes.headers.get('x-content-type-options'), 'nosniff');

    const quizOptImgRes = await fetch(
      `${baseUrl}${fetchedQuiz.questions[1].options[0].imageUrl}`
    );
    assert.equal(quizOptImgRes.status, 200);
  });

  it('4. supports editing quiz order/timers/questions, rollback safety on failure, and clean deletion', async () => {
    const listBefore = await (await fetch(`${baseUrl}/api/quizzes`)).json();
    const quizId = listBefore.quizzes[0].id as string;
    const quizBefore = await (await fetch(`${baseUrl}/api/quizzes/${quizId}`)).json();

    const snap0 = quizBefore.questions[0]; // true_false
    const snap1 = quizBefore.questions[1]; // multiple_choice with copied quizzes/* images
    const copiedQuestionImagePath = snap1.imagePath as string;
    const copiedOptionImagePath = snap1.options[0].imagePath as string;

    // Failed transaction test: valid question + non-existent bank question -> must rollback and leave no orphan copied media
    const beforeQuizMediaFiles = new Set(fs.readdirSync(storagePaths.quizzesMediaDir));
    const failingImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'fail.png');
    const qTemp = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال لاختبار التراجع الذري',
      imagePath: failingImg.imagePath,
      correctBoolean: true,
    });

    const failedCreateRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'مسابقة فاشلة للتراجع',
        defaultTimeSeconds: 30,
        questions: [
          { kind: 'bank_question', sourceQuestionId: qTemp.id, timeLimitSeconds: 30 },
          { kind: 'bank_question', sourceQuestionId: 'non-existent-id', timeLimitSeconds: 30 },
        ],
      }),
    });
    assert.equal(failedCreateRes.status, 400);
    const afterFailedFiles = new Set(fs.readdirSync(storagePaths.quizzesMediaDir));
    assert.deepEqual(afterFailedFiles, beforeQuizMediaFiles);

    // Edit existing quiz: reverse order, remove snap0, keep snap1 (whose bank original was deleted!), and add qTemp
    const updateRes = await fetch(`${baseUrl}/api/quizzes/${quizId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'مسابقة محدثة ومرتبة',
        subject: null,
        grade: 'الصف الحادي عشر',
        description: null,
        defaultTimeSeconds: 25,
        questions: [
          { kind: 'existing_snapshot', quizQuestionId: snap1.id, timeLimitSeconds: 50 },
          { kind: 'bank_question', sourceQuestionId: qTemp.id, timeLimitSeconds: 20 },
        ],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.title, 'مسابقة محدثة ومرتبة');
    assert.equal(updated.subject, null);
    assert.equal(updated.questionCount, 2);
    assert.equal(updated.totalDurationSeconds, 70);
    assert.equal(updated.questions[0].prompt, 'النص الأصلي للسؤال المصوّر');
    assert.equal(updated.questions[0].timeLimitSeconds, 50);
    assert.equal(updated.questions[1].prompt, 'سؤال لاختبار التراجع الذري');
    assert.equal(updated.questions[1].timeLimitSeconds, 20);

    // Retained snapshot images still exist on disk
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, copiedQuestionImagePath)), true);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, copiedOptionImagePath)), true);
    assert.notEqual(snap0.id, updated.questions[0].id);

    // Delete quiz: must remove its quizzes/* media while leaving qTemp intact in Question Bank
    const delQuizRes = await fetch(`${baseUrl}/api/quizzes/${quizId}`, { method: 'DELETE' });
    assert.equal(delQuizRes.status, 204);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, copiedQuestionImagePath)), false);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, copiedOptionImagePath)), false);
    assert.equal(fs.readdirSync(storagePaths.quizzesMediaDir).length, 0);

    // Verify qTemp and its Question Bank image still exist untouched!
    const bankCheck = await fetch(`${baseUrl}/api/questions/${qTemp.id}`);
    assert.equal(bankCheck.status, 200);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, failingImg.imagePath)), true);

    const statsAfterDelete = await (await fetch(`${baseUrl}/api/quizzes/stats`)).json();
    assert.equal(statsAfterDelete.totalQuizzes, 0);
    assert.equal(statsAfterDelete.totalQuizQuestions, 0);
  });

  it('5. protects quiz routes with localAdminGuard and handles DB errors cleanly', async () => {
    let statusCode = 200;
    let bodySent: unknown = null;
    let nextCalled = false;

    const fakeReq = {
      socket: { remoteAddress: '192.168.1.99' },
      headers: { host: '192.168.1.10:3000' },
    } as unknown as Parameters<typeof localAdminGuard>[0];

    const fakeRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        bodySent = payload;
        return this;
      },
    } as unknown as Parameters<typeof localAdminGuard>[1];

    localAdminGuard(fakeReq, fakeRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.ok(bodySent && typeof (bodySent as { error: string }).error === 'string');

    // Closed DB returns sanitized 500
    db.close();
    const errRes = await fetch(`${baseUrl}/api/quizzes`);
    assert.equal(errRes.status, 500);
    const errJson = await errRes.json();
    assert.ok(typeof errJson.error === 'string');
    assert.equal(JSON.stringify(errJson).includes('ERR_INVALID_STATE'), false);
  });
});

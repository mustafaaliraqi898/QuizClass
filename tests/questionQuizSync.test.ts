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
import { SqliteQuizRepository } from '../server/services/quizRepository.ts';

const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

const VALID_WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x18, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii'),
  Buffer.from([0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
]);

describe('QuizClass Question Bank -> Quizzes Synchronization Suite', () => {
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

  async function updateBankQuestion(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);
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
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-sync-'));
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

  it('1. reports zero linked quizzes when editing an unused question', async () => {
    const unusedQ = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال غير مستخدم في أي مسابقة',
      imagePath: null,
      correctBoolean: true,
    });

    const updated = await updateBankQuestion(unusedQ.id, {
      type: 'true_false',
      prompt: 'سؤال غير مستخدم محدّث',
      imagePath: null,
      correctBoolean: false,
    });

    assert.equal(updated.prompt, 'سؤال غير مستخدم محدّث');
    assert.equal(updated.linkedQuizSummary.updatableQuizCount, 0);
    assert.equal(updated.linkedQuizSummary.lockedQuizCount, 0);
    assert.deepEqual(updated.linkedQuizSummary.updatableQuizzes, []);
  });

  it('2. supports keeping existing quiz copies when editing a question used in 1 quiz, without silent sync', async () => {
    const q1 = await createBankQuestion({
      type: 'true_false',
      prompt: 'النص الأولي في المسابقة الواحدة',
      imagePath: null,
      correctBoolean: true,
      subject: 'العلوم',
    });

    const quiz = await createQuiz({
      title: 'مسابقة الاحتفاظ بالنسخة',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: q1.id, timeLimitSeconds: 45 }],
    });

    const updated = await updateBankQuestion(q1.id, {
      type: 'true_false',
      prompt: 'النص المعدل في البنك فقط',
      imagePath: null,
      correctBoolean: false,
      subject: 'الفيزياء',
    });

    assert.equal(updated.linkedQuizSummary.updatableQuizCount, 1);
    assert.equal(updated.linkedQuizSummary.updatableQuizzes[0].id, quiz.id);

    // Teacher chooses "الاحتفاظ بالنسخ الحالية" (does NOT call /sync-quizzes)
    const quizAfter = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(quizAfter.questions[0].prompt, 'النص الأولي في المسابقة الواحدة');
    assert.equal(quizAfter.questions[0].correctBoolean, true);
    assert.equal(quizAfter.questions[0].subject, 'العلوم');
    assert.equal(quizAfter.questions[0].timeLimitSeconds, 45);
  });

  it('3. syncs prompt, options, correct answer, classifications, and independent images across multiple quizzes while keeping order, timing, and sibling questions intact', async () => {
    const oldQImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'old-q.png');
    const oldOptImg = await uploadImage(VALID_WEBP_BUFFER, 'image/webp', 'old-opt.webp');
    const siblingImg = await uploadImage(VALID_JPEG_BUFFER, 'image/jpeg', 'sibling.jpg');

    const sharedBankQ = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'السؤال الأساسي قبل التحديث',
      imagePath: oldQImg.imagePath,
      correctBoolean: null,
      subject: 'الفيزياء',
      grade: 'الصف العاشر',
      topic: 'الحركة',
      difficulty: 'easy',
      options: [
        { optionText: 'خيار أ قديم', imagePath: oldOptImg.imagePath, isCorrect: true },
        { optionText: 'خيار ب قديم', imagePath: null, isCorrect: false },
      ],
    });

    const siblingQ = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال مرافق لا يجب أن يتأثر',
      imagePath: siblingImg.imagePath,
      correctBoolean: true,
    });

    // Quiz A: sharedBankQ at order 1 with custom time 55s
    const quizA = await createQuiz({
      title: 'المسابقة الأولى',
      defaultTimeSeconds: 20,
      questions: [
        { kind: 'bank_question', sourceQuestionId: siblingQ.id, timeLimitSeconds: 15 },
        { kind: 'bank_question', sourceQuestionId: sharedBankQ.id, timeLimitSeconds: 55 },
      ],
    });

    // Quiz B: sharedBankQ at order 0 with custom time 40s
    const quizB = await createQuiz({
      title: 'المسابقة الثانية',
      defaultTimeSeconds: 30,
      questions: [
        { kind: 'bank_question', sourceQuestionId: sharedBankQ.id, timeLimitSeconds: 40 },
        { kind: 'bank_question', sourceQuestionId: siblingQ.id, timeLimitSeconds: 25 },
      ],
    });

    // Quiz C (locked/started): must NOT be updated!
    const quizLocked = await createQuiz({
      title: 'مسابقة بدأت بالفعل',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: sharedBankQ.id, timeLimitSeconds: 35 }],
    });
    db.prepare(`UPDATE quizzes SET lifecycle_status = 'started' WHERE id = ?`).run(quizLocked.id);

    const oldQuizAImg = quizA.questions[1].imagePath as string;
    const oldQuizAOptImg = quizA.questions[1].options[0].imagePath as string;
    const oldQuizBImg = quizB.questions[0].imagePath as string;
    const lockedQuizImg = quizLocked.questions[0].imagePath as string;

    // Upload new images & edit sharedBankQ
    const newQImg = await uploadImage(VALID_JPEG_BUFFER, 'image/jpeg', 'new-q.jpg');
    const newOptImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'new-opt.png');

    const updateRes = await updateBankQuestion(sharedBankQ.id, {
      type: 'multiple_choice',
      prompt: 'السؤال الأساسي بعد التعديل الشامل',
      imagePath: newQImg.imagePath,
      correctBoolean: null,
      subject: 'الفيزياء المتقدمة',
      grade: 'الصف الحادي عشر',
      topic: 'الديناميكا',
      difficulty: 'hard',
      options: [
        { optionText: 'خيار 1 جديد خاطئ', imagePath: null, isCorrect: false },
        { optionText: 'خيار 2 جديد صحيح', imagePath: newOptImg.imagePath, isCorrect: true },
        { optionText: 'خيار 3 جديد', imagePath: null, isCorrect: false },
      ],
    });

    // Must report 2 updatable quizzes (A & B) and 1 locked quiz (C)
    assert.equal(updateRes.linkedQuizSummary.updatableQuizCount, 2);
    assert.equal(updateRes.linkedQuizSummary.lockedQuizCount, 1);

    // Trigger explicit sync
    const syncRes = await fetch(`${baseUrl}/api/questions/${sharedBankQ.id}/sync-quizzes`, {
      method: 'POST',
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.updatedQuizCount, 2);
    assert.equal(syncBody.updatedQuizQuestionCount, 2);
    assert.equal(syncBody.skippedLockedQuizCount, 1);

    // Check Quiz A: order preserved (index 1), time preserved (55s), content & classifications updated, independent media
    const fetchedA = await (await fetch(`${baseUrl}/api/quizzes/${quizA.id}`)).json();
    assert.equal(fetchedA.questions.length, 2);
    assert.equal(fetchedA.questions[0].prompt, 'سؤال مرافق لا يجب أن يتأثر');
    assert.equal(fetchedA.questions[0].timeLimitSeconds, 15);
    assert.equal(fetchedA.questions[1].questionOrder, 1);
    assert.equal(fetchedA.questions[1].timeLimitSeconds, 55);
    assert.equal(fetchedA.questions[1].prompt, 'السؤال الأساسي بعد التعديل الشامل');
    assert.equal(fetchedA.questions[1].subject, 'الفيزياء المتقدمة');
    assert.equal(fetchedA.questions[1].grade, 'الصف الحادي عشر');
    assert.equal(fetchedA.questions[1].topic, 'الديناميكا');
    assert.equal(fetchedA.questions[1].difficulty, 'hard');
    assert.equal(fetchedA.questions[1].options.length, 3);
    assert.equal(fetchedA.questions[1].options[1].isCorrect, true);
    assert.equal(fetchedA.questions[1].options[1].optionText, 'خيار 2 جديد صحيح');
    assert.ok(fetchedA.questions[1].imagePath.startsWith('quizzes/'));
    assert.notEqual(fetchedA.questions[1].imagePath, newQImg.imagePath);
    assert.ok(fetchedA.questions[1].options[1].imagePath.startsWith('quizzes/'));
    assert.notEqual(fetchedA.questions[1].options[1].imagePath, newOptImg.imagePath);

    // Check Quiz B: independent copy of images (different filenames from Quiz A!), order 0, time 40s
    const fetchedB = await (await fetch(`${baseUrl}/api/quizzes/${quizB.id}`)).json();
    assert.equal(fetchedB.questions[0].questionOrder, 0);
    assert.equal(fetchedB.questions[0].timeLimitSeconds, 40);
    assert.equal(fetchedB.questions[0].prompt, 'السؤال الأساسي بعد التعديل الشامل');
    assert.notEqual(fetchedB.questions[0].imagePath, fetchedA.questions[1].imagePath);
    assert.notEqual(
      fetchedB.questions[0].options[1].imagePath,
      fetchedA.questions[1].options[1].imagePath
    );

    // Both Quiz A & Quiz B new images serve 200 OK
    assert.equal((await fetch(`${baseUrl}${fetchedA.questions[1].imageUrl}`)).status, 200);
    assert.equal((await fetch(`${baseUrl}${fetchedB.questions[0].imageUrl}`)).status, 200);

    // Old unreferenced quiz images from A & B must be deleted
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, oldQuizAImg)), false);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, oldQuizAOptImg)), false);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, oldQuizBImg)), false);

    // Locked Quiz C MUST remain completely untouched with its original snapshot & image!
    const fetchedLocked = await (await fetch(`${baseUrl}/api/quizzes/${quizLocked.id}`)).json();
    assert.equal(fetchedLocked.questions[0].prompt, 'السؤال الأساسي قبل التحديث');
    assert.equal(fetchedLocked.questions[0].imagePath, lockedQuizImg);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, lockedQuizImg)), true);
  });

  it('4. handles question type conversion (MC <-> TF) cleanly during sync without stale options', async () => {
    const optImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'conv-opt.png');
    const q = await createBankQuestion({
      type: 'multiple_choice',
      prompt: 'سؤال سيتحول إلى صح وخطأ',
      imagePath: null,
      correctBoolean: null,
      options: [
        { optionText: 'خيار قديم 1', imagePath: optImg.imagePath, isCorrect: true },
        { optionText: 'خيار قديم 2', imagePath: null, isCorrect: false },
      ],
    });

    const quiz = await createQuiz({
      title: 'مسابقة التحويل',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: q.id, timeLimitSeconds: 33 }],
    });
    const oldQuizOptImg = quiz.questions[0].options[0].imagePath as string;

    // Convert MC -> TF
    await updateBankQuestion(q.id, {
      type: 'true_false',
      prompt: 'تحوّل إلى صح أو خطأ',
      imagePath: null,
      correctBoolean: false,
    });

    const sync1 = await fetch(`${baseUrl}/api/questions/${q.id}/sync-quizzes`, { method: 'POST' });
    assert.equal(sync1.status, 200);

    const afterMcToTf = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(afterMcToTf.questions[0].type, 'true_false');
    assert.equal(afterMcToTf.questions[0].correctBoolean, false);
    assert.equal(afterMcToTf.questions[0].options.length, 0);
    assert.equal(afterMcToTf.questions[0].timeLimitSeconds, 33);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, oldQuizOptImg)), false);

    // Convert TF -> MC
    const newOptImg = await uploadImage(VALID_WEBP_BUFFER, 'image/webp', 'conv-new.webp');
    await updateBankQuestion(q.id, {
      type: 'multiple_choice',
      prompt: 'عاد إلى اختيار من متعدد',
      imagePath: null,
      correctBoolean: null,
      options: [
        { optionText: 'اختيار جديد أ', imagePath: newOptImg.imagePath, isCorrect: false },
        { optionText: 'اختيار جديد ب', imagePath: null, isCorrect: true },
      ],
    });

    const sync2 = await fetch(`${baseUrl}/api/questions/${q.id}/sync-quizzes`, { method: 'POST' });
    assert.equal(sync2.status, 200);

    const afterTfToMc = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(afterTfToMc.questions[0].type, 'multiple_choice');
    assert.equal(afterTfToMc.questions[0].correctBoolean, null);
    assert.equal(afterTfToMc.questions[0].options.length, 2);
    assert.equal(afterTfToMc.questions[0].options[0].optionText, 'اختيار جديد أ');
    assert.equal(afterTfToMc.questions[0].options[1].isCorrect, true);
    assert.equal(afterTfToMc.questions[0].timeLimitSeconds, 33);
  });

  it('5. keeps quiz snapshots intact after original bank question is deleted and rolls back cleanly on sync failure', async () => {
    const img1 = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'rollback-1.png');
    const img2 = await uploadImage(VALID_JPEG_BUFFER, 'image/jpeg', 'rollback-2.jpg');

    const q = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال لاختبار التراجع والحذف',
      imagePath: img1.imagePath,
      correctBoolean: true,
    });

    const quiz = await createQuiz({
      title: 'مسابقة التراجع',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: q.id, timeLimitSeconds: 50 }],
    });
    const preFailQuizImg = quiz.questions[0].imagePath as string;

    // Update bank question with img2
    await updateBankQuestion(q.id, {
      type: 'true_false',
      prompt: 'نص يجب أن يتراجع عند الفشل',
      imagePath: img2.imagePath,
      correctBoolean: false,
    });

    const quizMediaBeforeFail = new Set(fs.readdirSync(storagePaths.quizzesMediaDir));
    const repo = new SqliteQuizRepository(db, storagePaths);

    assert.throws(() => {
      repo.syncQuestionToLinkedQuizzes(q.id, {
        testBeforeCommitHook: () => {
          throw new Error('Simulated mid-transaction failure');
        },
      });
    }, /Simulated mid-transaction failure/);

    // Verify full rollback: no orphan copied files, old quiz snapshot & image completely intact
    const quizMediaAfterFail = new Set(fs.readdirSync(storagePaths.quizzesMediaDir));
    assert.deepEqual(quizMediaAfterFail, quizMediaBeforeFail);
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, preFailQuizImg)), true);

    const quizAfterFail = await (await fetch(`${baseUrl}/api/quizzes/${quiz.id}`)).json();
    assert.equal(quizAfterFail.questions[0].prompt, 'سؤال لاختبار التراجع والحذف');
    assert.equal(quizAfterFail.questions[0].correctBoolean, true);

    // Also verify deleting original bank question leaves quiz intact & keeps shared bank image protected if shared elsewhere
    const sharedBankImg = await uploadImage(VALID_PNG_BUFFER, 'image/png', 'shared-bank.png');
    const qSharedA = await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال مشترك أ',
      imagePath: sharedBankImg.imagePath,
      correctBoolean: true,
    });
    await createBankQuestion({
      type: 'true_false',
      prompt: 'سؤال مشترك ب',
      imagePath: sharedBankImg.imagePath,
      correctBoolean: false,
    });

    const quizWithShared = await createQuiz({
      title: 'مسابقة السؤال المحذوف لاحقاً',
      defaultTimeSeconds: 30,
      questions: [{ kind: 'bank_question', sourceQuestionId: qSharedA.id, timeLimitSeconds: 20 }],
    });

    const delBank = await fetch(`${baseUrl}/api/questions/${qSharedA.id}`, { method: 'DELETE' });
    assert.equal(delBank.status, 204);

    // Shared image used by qSharedB still exists, and quiz snapshot still exists intact!
    assert.equal(fs.existsSync(path.join(storagePaths.mediaDir, sharedBankImg.imagePath)), true);
    const quizStillAlive = await (
      await fetch(`${baseUrl}/api/quizzes/${quizWithShared.id}`)
    ).json();
    assert.equal(quizStillAlive.questions[0].prompt, 'سؤال مشترك أ');
    assert.equal((await fetch(`${baseUrl}${quizStillAlive.questions[0].imageUrl}`)).status, 200);
  });
});

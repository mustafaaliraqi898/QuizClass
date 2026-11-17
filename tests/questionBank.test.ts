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

describe('QuizClass Question Bank Audit & Integration Suite', () => {
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

  async function uploadImageBuffer(buffer: Buffer, mime: string, filename: string) {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(buffer)], { type: mime }), filename);
    const res = await fetch(`${baseUrl}/api/media/upload`, { method: 'POST', body: form });
    return res;
  }

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-audit-'));
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

  it('1. starts with an empty SQLite database and zero stats', async () => {
    const [listRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/api/questions`),
      fetch(`${baseUrl}/api/questions/stats`),
    ]);
    assert.equal(listRes.status, 200);
    assert.equal(statsRes.status, 200);

    const listData = await listRes.json();
    const statsData = await statsRes.json();
    assert.equal(listData.questions.length, 0);
    assert.equal(statsData.totalQuestions, 0);
    assert.equal(statsData.multipleChoiceCount, 0);
    assert.equal(statsData.trueFalseCount, 0);
    assert.equal(statsData.subjectCount, 0);
  });

  it('2. enforces strict data integrity & input validation without leaking internals', async () => {
    // Malformed JSON
    const badJsonRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonBody = await badJsonRes.json();
    assert.ok(badJsonBody.error && !JSON.stringify(badJsonBody).includes('SyntaxError'));

    // Empty prompt
    const emptyPrompt = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: '   ',
        imagePath: null,
        correctBoolean: true,
      }),
    });
    assert.equal(emptyPrompt.status, 400);

    // MC with fewer than 2 options
    const oneOption = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال',
        imagePath: null,
        correctBoolean: null,
        options: [{ optionText: 'أ', imagePath: null, isCorrect: true }],
      }),
    });
    assert.equal(oneOption.status, 400);

    // MC with more than 6 options
    const sevenOptions = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال',
        imagePath: null,
        correctBoolean: null,
        options: Array.from({ length: 7 }, (_, i) => ({
          optionText: `خيار ${i + 1}`,
          imagePath: null,
          isCorrect: i === 0,
        })),
      }),
    });
    assert.equal(sevenOptions.status, 400);

    // MC with 0 or 2 correct answers
    const zeroCorrect = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'أ', imagePath: null, isCorrect: false },
          { optionText: 'ب', imagePath: null, isCorrect: false },
        ],
      }),
    });
    assert.equal(zeroCorrect.status, 400);

    const twoCorrect = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'أ', imagePath: null, isCorrect: true },
          { optionText: 'ب', imagePath: null, isCorrect: true },
        ],
      }),
    });
    assert.equal(twoCorrect.status, 400);

    // Non-existent imagePath reference rejected
    const missingMedia = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'سؤال بصورة مفقودة',
        imagePath: 'questions/00000000-0000-4000-8000-000000000000.png',
        correctBoolean: true,
      }),
    });
    assert.equal(missingMedia.status, 400);
  });

  it('3. creates MC and TF questions, preserves data across restart, and updates stats accurately', async () => {
    // MC without any classifications (optionality check)
    const mcRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'نسبة الماء على سطح الأرض تقارب 71% تقريباً، أي المحيطات أكبر؟',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'المحيط الهادئ', imagePath: null, isCorrect: true },
          { optionText: 'المحيط الأطلسي', imagePath: null, isCorrect: false },
          { optionText: 'المحيط الهندي', imagePath: null, isCorrect: false },
          { optionText: 'المحيط المتجمد', imagePath: null, isCorrect: false },
        ],
      }),
    });
    assert.equal(mcRes.status, 201);
    const mcQuestion = await mcRes.json();
    assert.equal(mcQuestion.subject, null);
    assert.equal(mcQuestion.grade, null);
    assert.equal(mcQuestion.topic, null);
    assert.equal(mcQuestion.difficulty, null);
    assert.equal(mcQuestion.options.length, 4);

    // TF with full optional classifications
    const tfRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'تتسارع الأجسام الساقطة سقوطاً حراً بعجلة ثابتة.',
        imagePath: null,
        correctBoolean: true,
        subject: 'الفيزياء',
        grade: 'الصف العاشر',
        topic: 'السقوط الحر',
        difficulty: 'medium',
      }),
    });
    assert.equal(tfRes.status, 201);

    // Full server + SQLite close & reopen simulation
    await stopAppAndDb();
    await startAppWithExistingDb();

    const statsRes = await fetch(`${baseUrl}/api/questions/stats`);
    const stats = await statsRes.json();
    assert.equal(stats.totalQuestions, 2);
    assert.equal(stats.multipleChoiceCount, 1);
    assert.equal(stats.trueFalseCount, 1);
    assert.equal(stats.subjectCount, 1);
  });

  it('4. validates PNG/JPEG/WEBP uploads, blocks bad/oversized files & path traversal, and protects shared images', async () => {
    // Reject unsupported MIME
    const svgRes = await uploadImageBuffer(
      Buffer.from('<svg></svg>'),
      'image/svg+xml',
      'bad.svg'
    );
    assert.equal(svgRes.status, 400);

    // Reject fake magic bytes
    const fakePngRes = await uploadImageBuffer(
      Buffer.from('fake-png-content'),
      'image/png',
      'fake.png'
    );
    assert.equal(fakePngRes.status, 400);

    // Reject > 5MB
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 100, 0x41);
    const bigRes = await uploadImageBuffer(bigBuffer, 'image/png', 'huge.png');
    assert.equal(bigRes.status, 413);

    // Path traversal blocked
    const traversalRes = await fetch(`${baseUrl}/api/media/questions/..%2Fquizclass.sqlite`);
    assert.equal(traversalRes.status, 404);

    // Upload valid PNG, JPEG, WEBP
    const [pngRes, jpgRes, webpRes] = await Promise.all([
      uploadImageBuffer(VALID_PNG_BUFFER, 'image/png', 'q.png'),
      uploadImageBuffer(VALID_JPEG_BUFFER, 'image/jpeg', 'o1.jpg'),
      uploadImageBuffer(VALID_WEBP_BUFFER, 'image/webp', 'o2.webp'),
    ]);
    assert.equal(pngRes.status, 201);
    assert.equal(jpgRes.status, 201);
    assert.equal(webpRes.status, 201);

    const pngAsset = await pngRes.json();
    const jpgAsset = await jpgRes.json();
    const webpAsset = await webpRes.json();

    // Verify served with nosniff header
    const servedImg = await fetch(`${baseUrl}${pngAsset.imageUrl}`);
    assert.equal(servedImg.status, 200);
    assert.equal(servedImg.headers.get('x-content-type-options'), 'nosniff');

    // Create MC with PNG on question, JPEG+text on option 1, WEBP-only on option 2
    const q1Res = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال مصوّر مع خيارات مصوّرة',
        imagePath: pngAsset.imagePath,
        correctBoolean: null,
        subject: 'الأحياء',
        grade: 'الصف التاسع',
        topic: 'الخلية',
        difficulty: 'hard',
        options: [
          { optionText: 'نواة الخلية', imagePath: jpgAsset.imagePath, isCorrect: true },
          { optionText: null, imagePath: webpAsset.imagePath, isCorrect: false },
        ],
      }),
    });
    assert.equal(q1Res.status, 201);
    const q1 = await q1Res.json();

    // Create second question sharing pngAsset.imagePath
    const q2Res = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'سؤال مشترك الصورة',
        imagePath: pngAsset.imagePath,
        correctBoolean: false,
      }),
    });
    assert.equal(q2Res.status, 201);
    const q2 = await q2Res.json();

    // Restart server & DB and verify images still exist and serve properly
    await stopAppAndDb();
    await startAppWithExistingDb();
    const afterRestartImg = await fetch(`${baseUrl}${pngAsset.imageUrl}`);
    assert.equal(afterRestartImg.status, 200);

    // Replace q1's option 1 image (jpg -> webp) via PUT: jpg must be deleted, webp & png remain
    const updateQ1Res = await fetch(`${baseUrl}/api/questions/${q1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'سؤال مصوّر محدث',
        imagePath: pngAsset.imagePath,
        correctBoolean: null,
        subject: 'الأحياء',
        grade: 'الصف التاسع',
        topic: 'الخلية',
        difficulty: 'hard',
        options: [
          { optionText: 'نواة الخلية المحدثة', imagePath: webpAsset.imagePath, isCorrect: true },
          { optionText: 'غشاء الخلية', imagePath: null, isCorrect: false },
        ],
      }),
    });
    assert.equal(updateQ1Res.status, 200);
    assert.equal(
      fs.existsSync(path.join(storagePaths.mediaDir, jpgAsset.imagePath)),
      false,
      'Replaced unshared option image must be deleted from disk'
    );
    assert.equal(
      fs.existsSync(path.join(storagePaths.mediaDir, webpAsset.imagePath)),
      true
    );

    // Delete q1: pngAsset MUST survive because q2 uses it; webpAsset MUST be deleted
    const delQ1 = await fetch(`${baseUrl}/api/questions/${q1.id}`, { method: 'DELETE' });
    assert.equal(delQ1.status, 204);
    assert.equal(
      fs.existsSync(path.join(storagePaths.mediaDir, pngAsset.imagePath)),
      true,
      'Shared image must NOT be deleted'
    );
    assert.equal(
      fs.existsSync(path.join(storagePaths.mediaDir, webpAsset.imagePath)),
      false,
      'Unreferenced option image must be deleted'
    );

    // Delete q2: now pngAsset has 0 refs and must be cleaned up
    const delQ2 = await fetch(`${baseUrl}/api/questions/${q2.id}`, { method: 'DELETE' });
    assert.equal(delQ2.status, 204);
    assert.equal(
      fs.existsSync(path.join(storagePaths.mediaDir, pngAsset.imagePath)),
      false
    );
  });

  it('5. accurately filters by LIKE-escaped search, type, subject, grade, topic, and difficulty, and updates stats on delete', async () => {
    // Search with literal '%' character should match ONLY the question containing '71%'
    const percentSearchRes = await fetch(
      `${baseUrl}/api/questions?search=${encodeURIComponent('71%')}`
    );
    const percentData = await percentSearchRes.json();
    assert.equal(percentData.questions.length, 1);
    assert.ok(percentData.questions[0].prompt.includes('71%'));

    // Filter by topic + difficulty + grade + subject + type
    const combinedFilterRes = await fetch(
      `${baseUrl}/api/questions?type=true_false&subject=${encodeURIComponent(
        'الفيزياء'
      )}&grade=${encodeURIComponent('الصف العاشر')}&topic=${encodeURIComponent(
        'السقوط الحر'
      )}&difficulty=medium`
    );
    const combinedData = await combinedFilterRes.json();
    assert.equal(combinedData.questions.length, 1);

    // Delete all remaining questions and verify stats return to 0
    const allRes = await fetch(`${baseUrl}/api/questions`);
    const allData = await allRes.json();
    for (const q of allData.questions) {
      const del = await fetch(`${baseUrl}/api/questions/${q.id}`, { method: 'DELETE' });
      assert.equal(del.status, 204);
    }

    const finalStatsRes = await fetch(`${baseUrl}/api/questions/stats`);
    const finalStats = await finalStatsRes.json();
    assert.equal(finalStats.totalQuestions, 0);
    assert.equal(finalStats.subjectCount, 0);
  });

  it('6. blocks unauthorized LAN device requests to admin endpoints and handles DB failure cleanly', async () => {
    // Test localAdminGuard directly against simulated LAN IP (192.168.1.50)
    let statusCode = 200;
    let bodySent: unknown = null;
    let nextCalled = false;

    const fakeReq = {
      socket: { remoteAddress: '192.168.1.50' },
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

    // Simulate closed SQLite DB failure
    db.close();
    const errRes = await fetch(`${baseUrl}/api/questions`);
    assert.equal(errRes.status, 500);
    const errJson = await errRes.json();
    assert.ok(typeof errJson.error === 'string');
    assert.equal(JSON.stringify(errJson).includes('ERR_INVALID_STATE'), false);
  });
});

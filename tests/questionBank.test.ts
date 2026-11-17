import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import type { DatabaseSync } from 'node:sqlite';

// Minimal valid 1x1 PNG buffer
const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

// Minimal valid RIFF/WEBP header buffer
const VALID_WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x18, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii'),
  Buffer.from([0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
]);

describe('QuizClass Question Bank (SQLite + Local Media Integration)', () => {
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

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-test-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    await startAppWithExistingDb();
  });

  after(async () => {
    try {
      await stopAppAndDb();
    } catch {
      // Already closed in error-handling test
    }
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  });

  it('starts with an empty SQLite database (no fake/default questions)', async () => {
    const res = await fetch(`${baseUrl}/api/questions`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.questions.length, 0);
    assert.equal(data.stats.totalQuestions, 0);
    assert.deepEqual(data.facets.subjects, []);
  });

  it('rejects invalid payloads (missing prompt or missing/multiple correct answers)', async () => {
    const noPrompt = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: '   ',
        imagePath: null,
        correctBoolean: true,
      }),
    });
    assert.equal(noPrompt.status, 400);

    const noCorrectMc = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'ما عاصمة الأردن؟',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'عمّان', imagePath: null, isCorrect: false },
          { optionText: 'إربد', imagePath: null, isCorrect: false },
        ],
      }),
    });
    assert.equal(noCorrectMc.status, 400);

    const twoCorrectMc = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'ما عاصمة الأردن؟',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'عمّان', imagePath: null, isCorrect: true },
          { optionText: 'إربد', imagePath: null, isCorrect: true },
        ],
      }),
    });
    assert.equal(twoCorrectMc.status, 400);
  });

  it('creates questions without classifications and persists them across DB restart', async () => {
    const createMc = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'ما وحدة قياس القوة في النظام الدولي؟',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'النيوتن', imagePath: null, isCorrect: true },
          { optionText: 'الجول', imagePath: null, isCorrect: false },
          { optionText: 'الواط', imagePath: null, isCorrect: false },
          { optionText: 'الباسكال', imagePath: null, isCorrect: false },
        ],
      }),
    });
    assert.equal(createMc.status, 201);
    const mcCreated = await createMc.json();
    assert.equal(mcCreated.subject, null);
    assert.equal(mcCreated.options.length, 4);

    const createTf = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'يدور القمر حول الأرض.',
        imagePath: null,
        correctBoolean: true,
        subject: 'العلوم',
        grade: 'الصف السابع',
        topic: 'الفضاء',
        difficulty: 'easy',
      }),
    });
    assert.equal(createTf.status, 201);

    // Simulate full application shutdown and restart
    await stopAppAndDb();
    await startAppWithExistingDb();

    const listRes = await fetch(`${baseUrl}/api/questions`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.stats.totalQuestions, 2);
    assert.equal(listData.stats.multipleChoiceCount, 1);
    assert.equal(listData.stats.trueFalseCount, 1);
    assert.deepEqual(listData.facets.subjects, ['العلوم']);
  });

  it('uploads valid PNG/WEBP images, rejects invalid files, and attaches images to question & options', async () => {
    // Invalid fake text file pretending to be PNG
    const invalidForm = new FormData();
    invalidForm.append(
      'image',
      new Blob([Buffer.from('not-a-real-image')], { type: 'image/png' }),
      'fake.png'
    );
    const invalidRes = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      body: invalidForm,
    });
    assert.equal(invalidRes.status, 400);

    // Upload question PNG
    const qForm = new FormData();
    qForm.append('image', new Blob([VALID_PNG_BUFFER], { type: 'image/png' }), 'q.png');
    const qUploadRes = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      body: qForm,
    });
    assert.equal(qUploadRes.status, 201);
    const qAsset = await qUploadRes.json();
    assert.ok(qAsset.imagePath.startsWith('questions/'));

    // Upload option WEBP
    const optForm = new FormData();
    optForm.append('image', new Blob([VALID_WEBP_BUFFER], { type: 'image/webp' }), 'o.webp');
    const optUploadRes = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      body: optForm,
    });
    assert.equal(optUploadRes.status, 201);
    const optAsset = await optUploadRes.json();

    // Verify serving uploaded file
    const serveRes = await fetch(`${baseUrl}${qAsset.imageUrl}`);
    assert.equal(serveRes.status, 200);

    // Create question with question image + image-only option + text+image option
    const createRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'multiple_choice',
        prompt: 'اختر الشكل الصحيح للخلية النباتية',
        imagePath: qAsset.imagePath,
        correctBoolean: null,
        subject: 'الأحياء',
        grade: 'الصف العاشر',
        difficulty: 'medium',
        options: [
          { optionText: 'الشكل الأول', imagePath: optAsset.imagePath, isCorrect: true },
          { optionText: null, imagePath: optAsset.imagePath, isCorrect: false },
        ],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.imagePath, qAsset.imagePath);
    assert.equal(created.options[0].imagePath, optAsset.imagePath);

    // Create a second question sharing qAsset.imagePath to verify shared-image protection
    const sharedRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'سؤال آخر يشارك نفس الصورة',
        imagePath: qAsset.imagePath,
        correctBoolean: false,
      }),
    });
    assert.equal(sharedRes.status, 201);
    const sharedQ = await sharedRes.json();

    // Delete the first question: qAsset must remain on disk (still used by sharedQ),
    // while optAsset must be removed from disk (no longer referenced).
    const delRes = await fetch(`${baseUrl}/api/questions/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 204);

    const qFilePath = path.join(storagePaths.mediaDir, qAsset.imagePath);
    const optFilePath = path.join(storagePaths.mediaDir, optAsset.imagePath);
    assert.equal(fs.existsSync(qFilePath), true, 'Shared image must NOT be deleted');
    assert.equal(fs.existsSync(optFilePath), false, 'Unreferenced option image must be deleted');

    // Now delete sharedQ -> qAsset has 0 references and must be cleaned up
    const delShared = await fetch(`${baseUrl}/api/questions/${sharedQ.id}`, {
      method: 'DELETE',
    });
    assert.equal(delShared.status, 204);
    assert.equal(fs.existsSync(qFilePath), false, 'Unreferenced question image must be deleted');
  });

  it('updates questions, filters by search and classifications, and handles delete + DB errors cleanly', async () => {
    const listRes = await fetch(`${baseUrl}/api/questions?subject=${encodeURIComponent('العلوم')}`);
    const listData = await listRes.json();
    assert.equal(listData.questions.length, 1);
    const target = listData.questions[0];

    const updateRes = await fetch(`${baseUrl}/api/questions/${target.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'true_false',
        prompt: 'يدور القمر حول كوكب الأرض في مدار إهليلجي.',
        imagePath: null,
        correctBoolean: true,
        subject: 'الفيزياء الفلكية',
        grade: 'الصف السابع',
        topic: 'حركة الأجرام',
        difficulty: 'medium',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.subject, 'الفيزياء الفلكية');
    assert.equal(updated.difficulty, 'medium');

    const searchRes = await fetch(
      `${baseUrl}/api/questions?search=${encodeURIComponent('إهليلجي')}&difficulty=medium`
    );
    const searchData = await searchRes.json();
    assert.equal(searchData.questions.length, 1);
    assert.equal(searchData.questions[0].id, target.id);

    // Delete and verify 404 afterwards
    const deleteRes = await fetch(`${baseUrl}/api/questions/${target.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 204);

    const missingRes = await fetch(`${baseUrl}/api/questions/${target.id}`);
    assert.equal(missingRes.status, 404);

    // Simulate DB failure when reading
    db.close();
    const dbErrRes = await fetch(`${baseUrl}/api/questions`);
    assert.equal(dbErrRes.status, 500);
    const errPayload = await dbErrRes.json();
    assert.ok(typeof errPayload.error === 'string' && errPayload.error.length > 0);
  });
});

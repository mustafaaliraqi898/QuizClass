import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { localAdminGuard } from '../server/middleware/localAdminGuard.ts';
import { SqliteInteractiveLearningRepository } from '../server/services/interactiveLearningRepository.ts';
import { NOOP_LIVE_SESSION_HUB } from '../server/services/liveSessionSocket.ts';
import { SqliteQuestionBankRepository } from '../server/services/questionBankRepository.ts';
import {
  createInitialSmartboardState,
  extractRealQuestionExplanation,
  extractSmartboardCorrectAnswerText,
  moveQuestionIdInOrder,
  navigateSmartboardQuestion,
  retrySmartboardQuestion,
  revealSmartboardCorrectAnswer,
  selectSmartboardChoice,
  verifySmartboardAnswer,
} from '../src/components/interactive-learning/interactiveLearningLogic.ts';
import { SmartboardStageView } from '../src/components/interactive-learning/SmartboardStageView.tsx';
import { Sidebar } from '../src/components/layout/Sidebar.tsx';
import { NAVIGATION_ITEMS, TEACHER_PROFILE } from '../src/data/previewDashboardData.ts';
import type { InteractiveActivityRecord } from '../src/types/interactiveLearning.ts';

describe('QuizClass Interactive Learning Mode (Smartboard) Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let httpServer: Server;
  let baseUrl: string;

  let mcQuestionId: string;
  let tfQuestionId: string;
  let imageQuestionId: string;

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizclass-interactive-learning-test-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    db = initializeDatabase(storagePaths.dbFilePath);

    const qbRepo = new SqliteQuestionBankRepository(db, storagePaths);

    // 1. Real MC question
    const qMc = qbRepo.createQuestion({
      type: 'multiple_choice',
      prompt: 'ما هي وحدة قياس القوة في النظام الدولي؟',
      imagePath: null,
      correctBoolean: null,
      subject: 'الفيزياء',
      grade: 'التاسع',
      topic: 'الحركة والقوى',
      difficulty: 'easy',
      options: [
        { optionText: 'النيوتن', isCorrect: true, imagePath: null },
        { optionText: 'الجول', isCorrect: false, imagePath: null },
        { optionText: 'الواط', isCorrect: false, imagePath: null },
        { optionText: 'الأمبير', isCorrect: false, imagePath: null },
      ],
    });
    mcQuestionId = qMc.id;

    // 2. Real TF question
    const qTf = qbRepo.createQuestion({
      type: 'true_false',
      prompt: 'يدور القمر حول الأرض في مدار إهليلجي.',
      imagePath: null,
      correctBoolean: true,
      subject: 'العلوم',
      grade: 'السادس',
      topic: 'الفضاء',
      difficulty: 'easy',
    });
    tfQuestionId = qTf.id;

    // 3. Real MC question with a real local image file saved in storagePaths
    const sampleImgFilename = 'sample-diagram.png';
    fs.writeFileSync(
      path.join(storagePaths.questionsMediaDir, sampleImgFilename),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const qImg = qbRepo.createQuestion({
      type: 'multiple_choice',
      prompt: 'تعرّف على الجزء المشار إليه في الرسم التوضيحي:',
      imagePath: `questions/${sampleImgFilename}`,
      correctBoolean: null,
      subject: 'الأحياء',
      grade: 'الثامن',
      topic: 'الخلية',
      difficulty: 'medium',
      options: [
        { optionText: 'النواة', isCorrect: true, imagePath: null },
        { optionText: 'السيتوبلازم', isCorrect: false, imagePath: null },
        { optionText: 'الغشاء البلازمي', isCorrect: false, imagePath: null },
        { optionText: 'الميتوكوندريا', isCorrect: false, imagePath: null },
      ],
    });
    imageQuestionId = qImg.id;

    const app = createServerApp(db, storagePaths, NOOP_LIVE_SESSION_HUB);
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
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

  it('1. registers التعلم التفاعلي as an independent item in Sidebar navigation', () => {
    const item = NAVIGATION_ITEMS.find((nav) => nav.id === 'interactive-learning');
    assert.ok(item);
    assert.equal(item.label, 'التعلم التفاعلي');

    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        items: NAVIGATION_ITEMS,
        activeSection: 'interactive-learning',
        onSelectSection: () => {},
        collapsed: false,
        mobileOpen: false,
        onCloseMobile: () => {},
        teacher: TEACHER_PROFILE,
      })
    );
    assert.match(html, /التعلم التفاعلي/);
    assert.match(html, /aria-current="page"/);
  });

  it('2. creates, orders, persists, and updates interactive activities using real SQLite Question Bank references without duplicating rows', async () => {
    // Create via API referencing real question IDs in custom order
    const createRes = await fetch(`${baseUrl}/api/interactive-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'نشاط مراجعة الفيزياء والعلوم',
        subject: 'العلوم',
        grade: 'الإعدادي',
        autoFullscreen: true,
        questionIds: [imageQuestionId, tfQuestionId, mcQuestionId],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as InteractiveActivityRecord;

    assert.equal(created.title, 'نشاط مراجعة الفيزياء والعلوم');
    assert.equal(created.autoFullscreen, true);
    assert.equal(created.questionCount, 3);
    assert.deepEqual(
      created.questions.map((q) => q.id),
      [imageQuestionId, tfQuestionId, mcQuestionId]
    );

    // Reorder helper check
    const reorderedIds = moveQuestionIdInOrder(
      [imageQuestionId, tfQuestionId, mcQuestionId],
      2,
      'up'
    );
    assert.deepEqual(reorderedIds, [imageQuestionId, mcQuestionId, tfQuestionId]);

    // Update order via API
    const updateRes = await fetch(`${baseUrl}/api/interactive-activities/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'نشاط مراجعة محدث',
        autoFullscreen: false,
        questionIds: reorderedIds,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = (await updateRes.json()) as InteractiveActivityRecord;
    assert.deepEqual(
      updated.questions.map((q) => q.id),
      reorderedIds
    );
    assert.equal(updated.autoFullscreen, false);

    // Verify activity does NOT duplicate prompt/options and deletes cleanly without affecting Question Bank
    const delRes = await fetch(`${baseUrl}/api/interactive-activities/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 204);

    const qbRepo = new SqliteQuestionBankRepository(db, storagePaths);
    assert.equal(qbRepo.getStats().totalQuestions, 3);
  });

  it('3. filters real Question Bank questions for activity building and protects admin routes via localAdminGuard', async () => {
    // Real filtering via /api/questions (reused by ActivityBuilderView)
    const filteredRes = await fetch(`${baseUrl}/api/questions?subject=${encodeURIComponent('الفيزياء')}`);
    assert.equal(filteredRes.status, 200);
    const filteredJson = (await filteredRes.json()) as { questions: Array<{ id: string }>; facets: { subjects: string[] } };
    assert.equal(filteredJson.questions.length, 1);
    assert.equal(filteredJson.questions[0].id, mcQuestionId);
    assert.ok(filteredJson.facets.subjects.includes('الفيزياء'));

    // Verify localAdminGuard rejects external LAN access
    let statusCode = 200;
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
      json() {
        return this;
      },
    } as unknown as Parameters<typeof localAdminGuard>[1];

    localAdminGuard(fakeReq, fakeRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
  });

  it('4. renders real Question Bank images with aspect-ratio preservation & multiple-choice touch cards on SmartboardStageView', () => {
    const repo = new SqliteInteractiveLearningRepository(db, storagePaths);
    const activity = repo.createActivity({
      title: 'حصة الأحياء التفاعلية',
      autoFullscreen: false,
      questionIds: [imageQuestionId, tfQuestionId],
    });

    const html = renderToStaticMarkup(
      React.createElement(SmartboardStageView, {
        activity,
        onExitToActivities: () => {},
      })
    );

    assert.match(html, /السؤال 1 من 2/);
    assert.match(html, /تعرّف على الجزء المشار إليه في الرسم التوضيحي/);
    assert.match(html, /\/api\/media\/questions\/sample-diagram\.png/);
    assert.match(html, /object-contain/);
    assert.match(html, /النواة/);
    assert.match(html, /السيتوبلازم/);
    // Smartboard touch targets and required controls
    assert.match(html, /min-h-\[96px\]/);
    assert.match(html, /تحقق من الإجابة/);
    assert.match(html, /كشف الإجابة الصحيحة/);
    assert.match(html, /إعادة المحاولة/);
    assert.match(html, /السؤال التالي/);
    assert.match(html, /data-testid="smartboard-fullscreen-btn"/);
    // Must NOT include competitive quiz elements (PIN, timer, leaderboard, score)
    assert.doesNotMatch(html, /رمز PIN/);
    assert.doesNotMatch(html, /لوحة الصدارة/);
  });

  it('5. supports True/False questions, changing selection before check, and strict check -> wrong -> reveal -> retry -> navigate lifecycle', () => {
    const repo = new SqliteInteractiveLearningRepository(db, storagePaths);
    const activity = repo.createActivity({
      title: 'درس القوى والفضاء',
      autoFullscreen: true,
      questionIds: [mcQuestionId, tfQuestionId],
    });

    const mcQ = activity.questions[0];
    const tfQ = activity.questions[1];

    // Step A: Select wrong option first, then CHANGE selection to another wrong option, then check
    let state = createInitialSmartboardState();
    const wrongOpt1 = mcQ.options.find((o) => !o.isCorrect)!;
    const wrongOpt2 = mcQ.options.filter((o) => !o.isCorrect)[1];
    const correctOpt = mcQ.options.find((o) => o.isCorrect)!;

    state = selectSmartboardChoice(state, { selectedOptionId: wrongOpt1.id });
    assert.equal(state.status, 'selected');
    assert.equal(state.selection.selectedOptionId, wrongOpt1.id);

    // Changing choice before verification must work freely
    state = selectSmartboardChoice(state, { selectedOptionId: wrongOpt2.id });
    assert.equal(state.status, 'selected');
    assert.equal(state.selection.selectedOptionId, wrongOpt2.id);

    // Verify wrong answer: status becomes checked_wrong and does NOT auto-reveal correct answer
    state = verifySmartboardAnswer(state, mcQ);
    assert.equal(state.status, 'checked_wrong');

    // Manual Reveal shows actual correct answer and respects missing explanation (returns null)
    const revealedState = revealSmartboardCorrectAnswer(state);
    assert.equal(revealedState.status, 'revealed');
    assert.equal(extractSmartboardCorrectAnswerText(mcQ), 'أ. النيوتن');
    assert.equal(extractRealQuestionExplanation(mcQ), null);

    // Retry resets selection and status back to idle so another student can try
    state = retrySmartboardQuestion(revealedState);
    assert.equal(state.status, 'idle');
    assert.equal(state.selection.selectedOptionId, null);

    // Student tries again with the correct choice and verifies
    state = selectSmartboardChoice(state, { selectedOptionId: correctOpt.id });
    state = verifySmartboardAnswer(state, mcQ);
    assert.equal(state.status, 'checked_correct');

    // Navigate to Next question (True/False): previous selection & result MUST clear completely
    state = navigateSmartboardQuestion(state, 1, activity.questions.length);
    assert.equal(state.currentIndex, 1);
    assert.equal(state.status, 'idle');
    assert.equal(state.selection.selectedOptionId, null);
    assert.equal(state.selection.selectedBoolean, null);

    // True/False interaction: change from false -> true -> verify
    state = selectSmartboardChoice(state, { selectedBoolean: false });
    state = selectSmartboardChoice(state, { selectedBoolean: true });
    state = verifySmartboardAnswer(state, tfQ);
    assert.equal(state.status, 'checked_correct');
    assert.equal(extractSmartboardCorrectAnswerText(tfQ), 'صح');

    // Advance past last question -> shows completion state cleanly
    state = navigateSmartboardQuestion(state, 2, activity.questions.length);
    assert.equal(state.completedSession, true);

    // Back to previous question clears selection safely
    state = navigateSmartboardQuestion(state, 0, activity.questions.length);
    assert.equal(state.completedSession, false);
    assert.equal(state.currentIndex, 0);
    assert.equal(state.status, 'idle');
  });

  it('6. renders real stored explanation only if present on the question and omits it when absent', () => {
    const repo = new SqliteInteractiveLearningRepository(db, storagePaths);
    const activity = repo.createActivity({
      title: 'اختبار الشرح',
      questionIds: [tfQuestionId],
    });

    const tfWithExplanation = {
      ...activity.questions[0],
      explanation: 'القمر يتبع مداراً إهليلجياً حول الأرض بفعل الجاذبية.',
    };

    assert.equal(extractRealQuestionExplanation(activity.questions[0]), null);
    assert.equal(
      extractRealQuestionExplanation(tfWithExplanation),
      'القمر يتبع مداراً إهليلجياً حول الأرض بفعل الجاذبية.'
    );
  });
});

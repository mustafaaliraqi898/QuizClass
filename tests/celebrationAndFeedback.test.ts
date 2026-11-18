import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedFullBodyAvatar } from '../src/components/live/AnimatedFullBodyAvatar.tsx';
import { LiveFinalResultsView } from '../src/components/live/LiveFinalResultsView.tsx';
import { buildPodiumPlan } from '../src/components/live/podiumUtils.ts';
import { StudentAnswerFeedbackBanner } from '../src/components/live/StudentAnswerFeedbackBanner.tsx';
import {
  buildStudentFeedbackBannerData,
  extractActualCorrectAnswerText,
  shouldDisplayFeedbackBanner,
} from '../src/components/live/studentFeedbackLogic.ts';
import { STUDENT_AVATARS } from '../src/data/studentAvatars.ts';
import type {
  FinalLeaderboardEntry,
  StudentLiveSessionState,
  TeacherLiveSessionDetails,
} from '../src/types/liveSession.ts';

function makeStudentState(
  overrides: Partial<StudentLiveSessionState> & {
    phase?: StudentLiveSessionState['session']['currentPhase'];
    status?: StudentLiveSessionState['session']['status'];
    remainingMs?: number | null;
  } = {}
): StudentLiveSessionState {
  const {
    phase = 'question_results',
    status = 'running',
    remainingMs = 5000,
    ...rest
  } = overrides;

  return {
    session: {
      sessionId: 'sess-100',
      quizTitle: 'مسابقة العلوم التفاعلية',
      quizSubject: 'العلوم',
      quizGrade: 'السادس',
      pinCode: '654321',
      status,
      currentPhase: phase,
      settings: {
        questionIntroSeconds: 3,
        advanceMode: 'auto',
        autoAdvanceSeconds: 6,
        allowAnswerChange: false,
        allowLateJoin: true,
        scoringMode: 'speed_and_accuracy',
        fullScreenMode: false,
      },
      questionCount: 4,
      participantCount: 5,
      currentQuestionIndex: 0,
      phaseStartedAt: '2026-11-18T10:00:00.000Z',
      phaseEndsAt: '2026-11-18T10:00:06.000Z',
      phaseDurationMs: 6000,
      serverNowMs: 1795000001000,
      remainingMs,
    },
    participant: {
      id: 'p-1',
      sessionId: 'sess-100',
      displayName: 'فهد المنصور',
      avatarId: 'avatar_lion',
      connectionStatus: 'connected',
      totalScore: 950,
      correctCount: 1,
      wrongCount: 0,
      unansweredCount: 0,
      rankPosition: 1,
      joinedAt: '2026-11-18T09:59:00.000Z',
    },
    currentQuestion: null,
    myAnswer: null,
    questionResult: {
      sessionQuestionId: 'sq-1',
      questionOrder: 0,
      type: 'multiple_choice',
      prompt: 'ما هو أقرب كوكب إلى الشمس؟',
      imageUrl: null,
      points: 1000,
      correctOptionId: 'opt-1',
      correctBoolean: null,
      options: [
        { id: 'opt-1', optionOrder: 0, optionText: 'عطارد', imageUrl: null, isCorrect: true },
        { id: 'opt-2', optionOrder: 1, optionText: 'المريخ', imageUrl: null, isCorrect: false },
        { id: 'opt-3', optionOrder: 2, optionText: 'زحل', imageUrl: null, isCorrect: false },
      ],
      myResult: {
        answered: true,
        selectedOptionId: 'opt-1',
        selectedBoolean: null,
        isCorrect: true,
        responseTimeMs: 1450,
        pointsAwarded: 950,
      },
      joinedMidResult: false,
    },
    finalSummary: null,
    ...rest,
  };
}

function makeTeacherSession(finalResults: FinalLeaderboardEntry[]): TeacherLiveSessionDetails {
  return {
    id: 'sess-live-1',
    quizId: 'quiz-1',
    quizTitle: 'مسابقة الأبطال النهائية',
    quizSubject: 'الرياضيات',
    quizGrade: 'الخامس',
    pinCode: '882211',
    status: 'completed',
    currentPhase: 'final_results',
    settings: {
      questionIntroSeconds: 3,
      advanceMode: 'auto',
      autoAdvanceSeconds: 5,
      allowAnswerChange: false,
      allowLateJoin: true,
      scoringMode: 'speed_and_accuracy',
      fullScreenMode: true,
    },
    questionCount: 5,
    participantCount: finalResults.length,
    connectedParticipantCount: finalResults.length,
    currentQuestionIndex: 4,
    phaseStartedAt: null,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNowMs: 1795000000000,
    remainingMs: null,
    createdAt: '2026-11-18T09:00:00.000Z',
    startedAt: '2026-11-18T09:05:00.000Z',
    endedAt: '2026-11-18T09:15:00.000Z',
    updatedAt: '2026-11-18T09:15:00.000Z',
    hostToken: 'host-secret',
    participants: finalResults.map((entry) => ({
      id: entry.participantId,
      sessionId: 'sess-live-1',
      displayName: entry.displayName,
      avatarId: entry.avatarId ?? 'avatar_cat',
      connectionStatus: 'connected',
      totalScore: entry.totalScore,
      correctCount: entry.correctCount,
      wrongCount: entry.wrongCount,
      unansweredCount: entry.unansweredCount,
      totalResponseTimeMs: entry.totalResponseTimeMs,
      rankPosition: entry.rankPosition,
      joinedAt: '2026-11-18T09:01:00.000Z',
      lastSeenAt: '2026-11-18T09:15:00.000Z',
      disconnectedAt: null,
    })),
    networkAddresses: [],
    primaryJoinUrl: 'http://127.0.0.1:3000/?join=1&pin=882211',
    primaryQrDataUrl: '',
    answeredCount: 0,
    currentQuestion: null,
    questionResults: null,
    finalResults,
  };
}

describe('QuizClass Celebration Podium & Animated Student Feedback Banners', () => {
  it('1. renders green animated feedback banner for correct answers with praise and server points', () => {
    const state = makeStudentState();
    const bannerData = buildStudentFeedbackBannerData(state);

    assert.ok(bannerData);
    assert.equal(bannerData.kind, 'correct');
    assert.equal(bannerData.title, 'إجابة صحيحة!');
    assert.equal(bannerData.subtitle, 'أحسنت!');
    assert.equal(bannerData.pointsAwarded, 950);

    const html = renderToStaticMarkup(
      React.createElement(StudentAnswerFeedbackBanner, { banner: bannerData })
    );
    assert.match(html, /data-feedback-kind="correct"/);
    assert.match(html, /qc-feedback-slide-in/);
    assert.match(html, /bg-emerald-600/);
    assert.match(html, /إجابة صحيحة!/);
    assert.match(html, /أحسنت!/);
    assert.match(html, /\+950 نقطة/);
  });

  it('2. renders red animated feedback banner with actual server-verified correct answer for wrong answers', () => {
    const mcWrongState = makeStudentState();
    mcWrongState.questionResult!.myResult = {
      answered: true,
      selectedOptionId: 'opt-2',
      selectedBoolean: null,
      isCorrect: false,
      responseTimeMs: 2300,
      pointsAwarded: 0,
    };

    const mcBanner = buildStudentFeedbackBannerData(mcWrongState);
    assert.ok(mcBanner);
    assert.equal(mcBanner.kind, 'wrong');
    assert.equal(mcBanner.title, 'إجابة خاطئة!');
    assert.equal(mcBanner.correctAnswerText, 'عطارد');

    const mcHtml = renderToStaticMarkup(
      React.createElement(StudentAnswerFeedbackBanner, { banner: mcBanner })
    );
    assert.match(mcHtml, /data-feedback-kind="wrong"/);
    assert.match(mcHtml, /bg-red-600/);
    assert.match(mcHtml, /إجابة خاطئة!/);
    assert.match(mcHtml, /الإجابة الصحيحة:/);
    assert.match(mcHtml, /عطارد/);

    // Verify true_false server extraction
    const tfWrongState = makeStudentState({
      questionResult: {
        sessionQuestionId: 'sq-tf',
        questionOrder: 1,
        type: 'true_false',
        prompt: 'الأرض كروية الشكل',
        imageUrl: null,
        points: 1000,
        correctOptionId: null,
        correctBoolean: true,
        options: [],
        myResult: {
          answered: true,
          selectedOptionId: null,
          selectedBoolean: false,
          isCorrect: false,
          responseTimeMs: 1800,
          pointsAwarded: 0,
        },
        joinedMidResult: false,
      },
    });
    const tfBanner = buildStudentFeedbackBannerData(tfWrongState);
    assert.equal(tfBanner?.correctAnswerText, 'صح');

    // Verify image-only MCQ option fallback uses option letter rather than null/blank
    assert.equal(
      extractActualCorrectAnswerText({
        sessionQuestionId: 'sq-img',
        questionOrder: 2,
        type: 'multiple_choice',
        prompt: 'اختر الشكل الصحيح',
        imageUrl: null,
        points: 1000,
        correctOptionId: 'opt-img-2',
        correctBoolean: null,
        options: [
          { id: 'opt-img-1', optionOrder: 0, optionText: null, imageUrl: '/uploads/a.png', isCorrect: false },
          { id: 'opt-img-2', optionOrder: 1, optionText: null, imageUrl: '/uploads/b.png', isCorrect: true },
        ],
        myResult: {
          answered: true,
          selectedOptionId: 'opt-img-1',
          selectedBoolean: null,
          isCorrect: false,
          responseTimeMs: 1500,
          pointsAwarded: 0,
        },
        joinedMidResult: false,
      }),
      'الخيار ب'
    );
  });

  it('3. renders amber timeout banner with actual correct answer when student does not answer in time', () => {
    const timeoutState = makeStudentState();
    timeoutState.questionResult!.myResult = {
      answered: false,
      selectedOptionId: null,
      selectedBoolean: null,
      isCorrect: false,
      responseTimeMs: null,
      pointsAwarded: 0,
    };

    const bannerData = buildStudentFeedbackBannerData(timeoutState);
    assert.ok(bannerData);
    assert.equal(bannerData.kind, 'timeout');
    assert.equal(bannerData.title, 'انتهى الوقت!');
    assert.equal(bannerData.correctAnswerText, 'عطارد');

    const html = renderToStaticMarkup(
      React.createElement(StudentAnswerFeedbackBanner, { banner: bannerData })
    );
    assert.match(html, /data-feedback-kind="timeout"/);
    assert.match(html, /bg-amber-500/);
    assert.match(html, /انتهى الوقت!/);
    assert.match(html, /عطارد/);
  });

  it('4. suppresses feedback banner outside question_results and unmounts cleanly when null', () => {
    assert.equal(buildStudentFeedbackBannerData(makeStudentState({ phase: 'question_intro' })), null);
    assert.equal(buildStudentFeedbackBannerData(makeStudentState({ phase: 'answering' })), null);
    assert.equal(
      buildStudentFeedbackBannerData(makeStudentState({ phase: 'final_results', status: 'completed' })),
      null
    );

    const midJoinState = makeStudentState();
    midJoinState.questionResult!.joinedMidResult = true;
    assert.equal(buildStudentFeedbackBannerData(midJoinState), null);

    const emptyHtml = renderToStaticMarkup(
      React.createElement(StudentAnswerFeedbackBanner, { banner: null })
    );
    assert.equal(emptyHtml, '');
  });

  it('5. deduplicates repeated Socket.IO state broadcasts and blocks expired reconnect banners', () => {
    const state = makeStudentState();
    const banner = buildStudentFeedbackBannerData(state);
    const shownKeys = new Set<string>();

    // First delivery should show
    assert.equal(shouldDisplayFeedbackBanner(banner, shownKeys, 5000), true);
    shownKeys.add(banner!.dedupKey);

    // Duplicate Socket.IO session:student_state broadcast for the same question must NOT repeat
    assert.equal(shouldDisplayFeedbackBanner(banner, shownKeys, 4200), false);

    // Expired phase tail (<250ms remaining) on reconnect must NOT flash a stale banner
    const otherQuestion = makeStudentState();
    otherQuestion.questionResult!.sessionQuestionId = 'sq-99';
    const otherBanner = buildStudentFeedbackBannerData(otherQuestion);
    assert.equal(shouldDisplayFeedbackBanner(otherBanner, new Set<string>(), 150), false);
  });

  it('6. prevents feedback leakage across consecutive questions while triggering Q2 freshly', () => {
    const shownKeys = new Set<string>();
    const q1Results = buildStudentFeedbackBannerData(makeStudentState());
    assert.ok(q1Results);
    assert.equal(shouldDisplayFeedbackBanner(q1Results, shownKeys, 4500), true);
    shownKeys.add(q1Results.dedupKey);

    // Transition to Q2 answering -> null (clears banner)
    const q2Answering = makeStudentState({
      phase: 'answering',
      questionResult: null,
    });
    assert.equal(buildStudentFeedbackBannerData(q2Answering), null);

    // Transition to Q2 results -> distinct dedupKey -> displays cleanly
    const q2State = makeStudentState();
    q2State.questionResult!.sessionQuestionId = 'sq-2';
    q2State.questionResult!.questionOrder = 1;
    const q2Results = buildStudentFeedbackBannerData(q2State);
    assert.ok(q2Results);
    assert.notEqual(q2Results.dedupKey, q1Results.dedupKey);
    assert.equal(shouldDisplayFeedbackBanner(q2Results, shownKeys, 5000), true);
  });

  it('7. renders articulated full-body SVG characters matching all 12 student avatars', () => {
    for (const avatar of STUDENT_AVATARS) {
      const html = renderToStaticMarkup(
        React.createElement(AnimatedFullBodyAvatar, {
          avatarId: avatar.id,
          showCrown: avatar.id === 'avatar_lion',
        })
      );
      assert.match(html, new RegExp(`data-avatar-id="${avatar.id}"`));
      assert.match(html, /qc-avatar-body/);
      assert.match(html, /qc-avatar-arm-left/);
      assert.match(html, /qc-avatar-arm-right/);
      assert.match(html, /qc-avatar-leg-left/);
      assert.match(html, /qc-avatar-leg-right/);
    }
  });

  it('8. preserves exact server winner ordering and tie ranks without client re-sorting', () => {
    const tiedServerLeaderboard: FinalLeaderboardEntry[] = [
      {
        participantId: 'p-fast',
        displayName: 'سارة',
        avatarId: 'avatar_owl',
        rankPosition: 1,
        totalScore: 1900,
        correctCount: 2,
        wrongCount: 0,
        unansweredCount: 0,
        totalResponseTimeMs: 1800,
      },
      {
        participantId: 'p-tie',
        displayName: 'ليلى',
        avatarId: 'avatar_panda',
        rankPosition: 1,
        totalScore: 1900,
        correctCount: 2,
        wrongCount: 0,
        unansweredCount: 0,
        totalResponseTimeMs: 2400,
      },
      {
        participantId: 'p-third',
        displayName: 'عمر',
        avatarId: 'avatar_robot',
        rankPosition: 3,
        totalScore: 1200,
        correctCount: 1,
        wrongCount: 1,
        unansweredCount: 0,
        totalResponseTimeMs: 3000,
      },
    ];

    const plan = buildPodiumPlan(tiedServerLeaderboard);
    const centerSlot = plan.slots.find((s) => s.displayRank === 1)!;
    const secondPedestal = plan.slots.find((s) => s.displayRank === 2)!;
    const thirdPedestal = plan.slots.find((s) => s.displayRank === 3)!;

    assert.equal(centerSlot.entry.participantId, 'p-fast');
    assert.equal(centerSlot.entry.avatarId, 'avatar_owl');
    assert.equal(secondPedestal.entry.participantId, 'p-tie');
    assert.equal(secondPedestal.entry.rankPosition, 1);
    assert.equal(thirdPedestal.entry.participantId, 'p-third');
    assert.equal(thirdPedestal.entry.rankPosition, 3);
  });

  it('9. starts with an empty podium stage and enforces 3rd -> 2nd -> 1st sequential reveal order', () => {
    const topFour: FinalLeaderboardEntry[] = [
      { participantId: 'p1', displayName: 'أحمد', avatarId: 'avatar_lion', rankPosition: 1, totalScore: 2800, correctCount: 3, wrongCount: 0, unansweredCount: 0, totalResponseTimeMs: 3200 },
      { participantId: 'p2', displayName: 'مريم', avatarId: 'avatar_fox', rankPosition: 2, totalScore: 2400, correctCount: 3, wrongCount: 0, unansweredCount: 0, totalResponseTimeMs: 4100 },
      { participantId: 'p3', displayName: 'يوسف', avatarId: 'avatar_penguin', rankPosition: 3, totalScore: 1800, correctCount: 2, wrongCount: 1, unansweredCount: 0, totalResponseTimeMs: 5000 },
      { participantId: 'p4', displayName: 'نور', avatarId: 'avatar_koala', rankPosition: 4, totalScore: 1100, correctCount: 1, wrongCount: 2, unansweredCount: 0, totalResponseTimeMs: 6200 },
    ];

    const plan = buildPodiumPlan(topFour);
    assert.deepEqual(plan.revealSequenceSteps, [1, 2, 3]);
    assert.equal(plan.slots.find((s) => s.displayRank === 3)?.revealAtStep, 1);
    assert.equal(plan.slots.find((s) => s.displayRank === 2)?.revealAtStep, 2);
    assert.equal(plan.slots.find((s) => s.displayRank === 1)?.revealAtStep, 3);
    assert.equal(plan.slots.find((s) => s.displayRank === 3)?.entranceMode, 'run-in');
    assert.equal(plan.slots.find((s) => s.displayRank === 2)?.entranceMode, 'hop-in');
    assert.equal(plan.slots.find((s) => s.displayRank === 1)?.entranceMode, 'hero-leap');

    // Initial SSR render starts at revealStage = 0 (empty podium, no winners or confetti yet)
    const initialHtml = renderToStaticMarkup(
      React.createElement(LiveFinalResultsView, {
        session: makeTeacherSession(topFour),
        onLaunchNewSession: () => {},
        onBackToQuizzes: () => {},
      })
    );
    assert.match(initialHtml, /data-reveal-stage="0"/);
    assert.doesNotMatch(initialHtml, /data-revealed="true"/);
    assert.doesNotMatch(initialHtml, /data-testid="podium-confetti"/);
    // Rank 4 appears in remaining list below podium
    assert.match(initialHtml, /data-testid="podium-remaining-list"/);
    assert.match(initialHtml, /نور/);
    assert.match(initialHtml, /data-avatar-id="avatar_koala"/);
  });

  it('10. handles 0, 1, 2, and 3+ participants accurately without creating fake ranks', () => {
    // 0 participants
    const emptyPlan = buildPodiumPlan([]);
    assert.equal(emptyPlan.slots.length, 0);
    assert.deepEqual(emptyPlan.revealSequenceSteps, []);
    const emptyView = renderToStaticMarkup(
      React.createElement(LiveFinalResultsView, {
        session: makeTeacherSession([]),
        onLaunchNewSession: () => {},
        onBackToQuizzes: () => {},
      })
    );
    assert.match(emptyView, /data-testid="podium-empty-state"/);
    assert.match(emptyView, /لم يشارك أي طالب في هذه الجلسة/);

    // 1 participant -> only 1st slot, no 2nd or 3rd
    const onePlayer: FinalLeaderboardEntry[] = [
      { participantId: 'solo', displayName: 'زينب', avatarId: 'avatar_bunny', rankPosition: 1, totalScore: 1000, correctCount: 1, wrongCount: 0, unansweredCount: 0, totalResponseTimeMs: 1200 },
    ];
    const onePlan = buildPodiumPlan(onePlayer);
    assert.equal(onePlan.slots.length, 1);
    assert.equal(onePlan.slots[0].displayRank, 1);
    assert.deepEqual(onePlan.revealSequenceSteps, [3]);

    const oneView = renderToStaticMarkup(
      React.createElement(LiveFinalResultsView, {
        session: makeTeacherSession(onePlayer),
        onLaunchNewSession: () => {},
        onBackToQuizzes: () => {},
      })
    );
    assert.match(oneView, /data-testid="podium-slot-1"/);
    assert.doesNotMatch(oneView, /data-testid="podium-slot-2"/);
    assert.doesNotMatch(oneView, /data-testid="podium-slot-3"/);

    // 2 participants -> 1st & 2nd slots only, no 3rd
    const twoPlayers: FinalLeaderboardEntry[] = [
      onePlayer[0],
      { participantId: 'duo', displayName: 'خالد', avatarId: 'avatar_tiger', rankPosition: 2, totalScore: 800, correctCount: 1, wrongCount: 0, unansweredCount: 0, totalResponseTimeMs: 2500 },
    ];
    const twoPlan = buildPodiumPlan(twoPlayers);
    assert.equal(twoPlan.slots.length, 2);
    assert.deepEqual(twoPlan.revealSequenceSteps, [2, 3]);

    const twoView = renderToStaticMarkup(
      React.createElement(LiveFinalResultsView, {
        session: makeTeacherSession(twoPlayers),
        onLaunchNewSession: () => {},
        onBackToQuizzes: () => {},
      })
    );
    assert.match(twoView, /data-testid="podium-slot-1"/);
    assert.match(twoView, /data-testid="podium-slot-2"/);
    assert.doesNotMatch(twoView, /data-testid="podium-slot-3"/);
  });
});

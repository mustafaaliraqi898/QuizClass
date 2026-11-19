import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityLaunchSetupView } from '../src/components/interactive-learning/ActivityLaunchSetupView.tsx';
import { SmartboardStageView } from '../src/components/interactive-learning/SmartboardStageView.tsx';
import {
  canRevealTwoPlayerRound,
  createInitialTwoPlayerSession,
  createQuestionOptionOrder,
  determineTwoPlayerWinner,
  ensureQuestionOptionOrderInMap,
  extractTwoPlayerCorrectAnswerText,
  getOrderedOptionsForPlayer,
  getPlayerOrderedOptionsForSession,
  navigateTwoPlayerSession,
  POINTS_PER_CORRECT_ANSWER,
  revealTwoPlayerRound,
  selectPlayerChoiceInRound,
  tickTwoPlayerTimer,
  toggleTwoPlayerPause,
  type TwoPlayerConfig,
} from '../src/components/interactive-learning/twoPlayerCompetitionLogic.ts';
import { TwoPlayerCompetitionStageView } from '../src/components/interactive-learning/TwoPlayerCompetitionStageView.tsx';
import type {
  InteractiveActivityRecord,
  InteractiveLearningQuestion,
} from '../src/types/interactiveLearning.ts';

describe('QuizClass Two-Player Competition Mode Complete Suite', () => {
  const sampleQuestion1: InteractiveLearningQuestion = {
    id: 'q-1',
    type: 'multiple_choice',
    prompt: 'ما عاصمة فلسطين؟',
    subject: 'التاريخ',
    grade: 'الثامن',
    topic: 'القدس',
    difficulty: 'easy',
    imagePath: null,
    imageUrl: null,
    correctBoolean: null,
    explanation: 'القدس هي العاصمة.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    options: [
      { id: 'opt-1', questionId: 'q-1', optionOrder: 0, optionText: 'القدس', isCorrect: true, imagePath: null, imageUrl: null },
      { id: 'opt-2', questionId: 'q-1', optionOrder: 1, optionText: 'عمان', isCorrect: false, imagePath: null, imageUrl: null },
      { id: 'opt-3', questionId: 'q-1', optionOrder: 2, optionText: 'بيروت', isCorrect: false, imagePath: null, imageUrl: null },
      { id: 'opt-4', questionId: 'q-1', optionOrder: 3, optionText: 'دمشق', isCorrect: false, imagePath: null, imageUrl: null },
    ],
  };

  const sampleQuestion2: InteractiveLearningQuestion = {
    id: 'q-2',
    type: 'true_false',
    prompt: 'الشمس نجم مضيء بذاته.',
    subject: 'العلوم',
    grade: 'السادس',
    topic: 'الفضاء',
    difficulty: 'easy',
    imagePath: null,
    imageUrl: null,
    correctBoolean: true,
    explanation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    options: [],
  };

  const sampleActivity: InteractiveActivityRecord = {
    id: 'act-1',
    title: 'مسابقة التحدي الثنائي',
    subject: 'متنوع',
    grade: 'الثامن',
    autoFullscreen: false,
    questionCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [sampleQuestion1, sampleQuestion2],
  };

  const playerConfig: TwoPlayerConfig = {
    p1Name: 'أحمد',
    p1AvatarId: 'avatar_lion',
    p2Name: 'سارة',
    p2AvatarId: 'avatar_bunny',
    roundDurationSeconds: 20,
  };

  it('1. renders modern launch mode selector (السبورة العادية vs منافسة طالبين) and two-player setup with 12 avatars', () => {
    const modeHtml = renderToStaticMarkup(
      React.createElement(ActivityLaunchSetupView, {
        activity: sampleActivity,
        initialStep: 'mode',
        onStartStandard: () => {},
        onStartTwoPlayer: () => {},
        onBackToActivities: () => {},
      })
    );

    assert.match(modeHtml, /data-testid="launch-mode-selector"/);
    assert.match(modeHtml, /data-testid="mode-card-standard"/);
    assert.match(modeHtml, /data-testid="mode-card-two-player"/);
    assert.match(modeHtml, /السبورة العادية/);
    assert.match(modeHtml, /منافسة طالبين/);

    const playersSetupHtml = renderToStaticMarkup(
      React.createElement(ActivityLaunchSetupView, {
        activity: sampleActivity,
        initialConfig: playerConfig,
        initialStep: 'players',
        onStartStandard: () => {},
        onStartTwoPlayer: () => {},
        onBackToActivities: () => {},
      })
    );

    assert.match(playersSetupHtml, /data-testid="two-player-setup-screen"/);
    assert.match(playersSetupHtml, /data-testid="setup-player-1-card"/);
    assert.match(playersSetupHtml, /data-testid="setup-player-2-card"/);
    assert.match(playersSetupHtml, /data-avatar-id="avatar_lion"/);
    assert.match(playersSetupHtml, /data-avatar-id="avatar_bunny"/);
    assert.match(playersSetupHtml, /قطة لطيفة/);
    assert.match(playersSetupHtml, /روبوت ذكي/);
    assert.match(playersSetupHtml, /بدء المنافسة/);
  });

  it('2. keeps Player 1 & Player 2 selections independent and conceals correctness while timer runs and when paused', () => {
    let session = createInitialTwoPlayerSession(5);
    assert.equal(session.roundState.phase, 'answering');
    assert.equal(canRevealTwoPlayerRound(session.roundState), false);

    // P1 chooses opt-2 then changes to opt-1; P2 remains null
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-2' }),
    };
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-1' }),
    };
    assert.equal(session.roundState.p1Selection.selectedOptionId, 'opt-1');
    assert.equal(session.roundState.p2Selection.selectedOptionId, null);

    // Only P1 answered -> reveal is blocked while timer is running
    assert.equal(canRevealTwoPlayerRound(session.roundState), false);
    const prematureReveal = revealTwoPlayerRound(session.roundState, sampleQuestion1);
    assert.equal(prematureReveal.phase, 'answering');
    assert.equal(prematureReveal.p1Score, 0);

    // Pausing timer stops countdown without revealing answers
    session = toggleTwoPlayerPause(session);
    assert.equal(session.isPaused, true);
    const afterPausedTick = tickTwoPlayerTimer(session);
    assert.equal(afterPausedTick.timeLeft, 5);
    assert.equal(afterPausedTick.roundState.phase, 'answering');
  });

  it('3. reveals immediately when both players answer with teacher early finish button «إنهاء السؤال وكشف الإجابة»', () => {
    let session = createInitialTwoPlayerSession(15);
    assert.equal(session.roundState.phase, 'answering');

    // P1 chooses correct answer opt-1
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-1' }),
    };
    // P2 chooses wrong answer opt-3
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedOptionId: 'opt-3' }),
    };

    // Both players have answered before time runs out!
    assert.equal(session.timeLeft, 15);
    assert.equal(canRevealTwoPlayerRound(session.roundState), true);

    // In Stage View, teacher sees «إنهاء السؤال وكشف الإجابة» button
    const stageHtml = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        initialSession: session,
        onExitToActivities: () => {},
      })
    );
    assert.match(stageHtml, /data-testid="two-player-finish-early-btn"/);
    assert.match(stageHtml, /إنهاء السؤال وكشف الإجابة/);
    assert.doesNotMatch(stageHtml, /data-testid="two-player-next-btn"/);

    // Teacher clicks early finish: timer stops, results revealed, +10 points to P1
    const revealed = revealTwoPlayerRound(session.roundState, sampleQuestion1);
    assert.equal(revealed.phase, 'revealed');
    assert.equal(revealed.p1Outcome, 'correct');
    assert.equal(revealed.p2Outcome, 'wrong');
    assert.equal(revealed.p1Score, POINTS_PER_CORRECT_ANSWER);
    assert.equal(revealed.p2Score, 0);
    assert.equal(revealed.p1CorrectCount, 1);
    assert.equal(revealed.p2WrongCount, 1);

    // Repeated reveal call does NOT duplicate score
    const secondReveal = revealTwoPlayerRound(revealed, sampleQuestion1);
    assert.equal(secondReveal.p1Score, POINTS_PER_CORRECT_ANSWER);
    assert.equal(secondReveal.p1CorrectCount, 1);
  });

  it('4. locks choices on timer expiry without revealing answers, shows «إظهار النتيجة والتحقق» and flags unanswered player', () => {
    let session = createInitialTwoPlayerSession(5);
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-1' }), // correct
      timeLeft: 1,
    };

    // Timer hits 0 -> phase transitions to 'time_up', choices locked, answers still concealed
    session = tickTwoPlayerTimer(session);
    assert.equal(session.timeLeft, 0);
    assert.equal(session.roundState.phase, 'time_up');
    assert.equal(session.roundState.p1Outcome, null);
    assert.equal(session.roundState.p2Outcome, null);
    assert.equal(canRevealTwoPlayerRound(session.roundState), true);

    // Further selection attempts are locked
    const lockedAttempt = selectPlayerChoiceInRound(session.roundState, 2, {
      selectedOptionId: 'opt-1',
    });
    assert.equal(lockedAttempt.p2Selection.selectedOptionId, null);

    // Stage view shows teacher reveal button «إظهار النتيجة والتحقق»
    const timeoutHtml = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        initialSession: session,
        onExitToActivities: () => {},
      })
    );
    assert.match(timeoutHtml, /data-testid="two-player-reveal-btn"/);
    assert.match(timeoutHtml, /إظهار النتيجة والتحقق/);
    assert.doesNotMatch(timeoutHtml, /data-testid="two-player-next-btn"/);

    // Teacher clicks reveal: P1 is correct (+10), P2 is unanswered (0 points and unanswered feedback)
    const revealed = revealTwoPlayerRound(session.roundState, sampleQuestion1);
    assert.equal(revealed.phase, 'revealed');
    assert.equal(revealed.p1Outcome, 'correct');
    assert.equal(revealed.p2Outcome, 'unanswered');
    assert.equal(revealed.p1Score, POINTS_PER_CORRECT_ANSWER);
    assert.equal(revealed.p2Score, 0);
    assert.equal(revealed.p1CorrectCount, 1);
    assert.equal(revealed.p2UnansweredCount, 1);
  });

  it('5. preserves cumulative scores across True/False questions and computes winner or tie accurately', () => {
    let session = createInitialTwoPlayerSession(5);

    // Question 1: P1 correct, P2 wrong
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-1' }),
    };
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedOptionId: 'opt-2' }),
      timeLeft: 1,
    };
    session = tickTwoPlayerTimer(session);
    session = {
      ...session,
      roundState: revealTwoPlayerRound(session.roundState, sampleQuestion1),
    };
    assert.equal(session.roundState.p1Outcome, 'correct');
    assert.equal(session.roundState.p2Outcome, 'wrong');

    // Navigate to Question 2: selections clear, scores persist
    session = navigateTwoPlayerSession(session, 1, 2);
    assert.equal(session.currentIndex, 1);
    assert.equal(session.roundState.phase, 'answering');
    assert.equal(session.roundState.p1Selection.selectedOptionId, null);
    assert.equal(session.roundState.p1Score, POINTS_PER_CORRECT_ANSWER);
    assert.equal(session.roundState.p2Score, 0);

    // Question 2 (True/False): P1 wrong (false), P2 correct (true) -> results in TIE (10 - 10)
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedBoolean: false }),
    };
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedBoolean: true }),
      timeLeft: 1,
    };
    session = tickTwoPlayerTimer(session);
    session = {
      ...session,
      roundState: revealTwoPlayerRound(session.roundState, sampleQuestion2),
    };

    assert.equal(session.roundState.p1Score, 10);
    assert.equal(session.roundState.p2Score, 10);
    assert.deepEqual(
      determineTwoPlayerWinner(session.roundState, playerConfig.p1Name, playerConfig.p2Name),
      { result: 'tie', winnerName: null }
    );

    // Advance past final question -> completed
    session = navigateTwoPlayerSession(session, 2, 2);
    assert.equal(session.completed, true);
  });

  it('6. renders TwoPlayerCompetitionStageView with duplicated questions/options inside blue & green panels and no premature feedback bars', () => {
    const html = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        onExitToActivities: () => {},
      })
    );

    // Both panels exist with blue & green themes
    assert.match(html, /data-testid="player-1-panel"[^>]*data-player-theme="blue"/);
    assert.match(html, /data-testid="player-2-panel"[^>]*data-player-theme="green"/);

    // Student names & AnimatedFullBodyAvatar rendered in both panels
    assert.match(html, /أحمد/);
    assert.match(html, /سارة/);
    assert.match(html, /data-avatar-id="avatar_lion"/);
    assert.match(html, /data-avatar-id="avatar_bunny"/);

    // Question prompt is duplicated inside BOTH panels (not shared once in the middle)
    assert.match(html, /data-testid="p1-question-prompt"[^>]*>ما عاصمة فلسطين؟</);
    assert.match(html, /data-testid="p2-question-prompt"[^>]*>ما عاصمة فلسطين؟</);

    // Options are rendered independently inside BOTH panels
    assert.match(html, /data-testid="p1-option-0"/);
    assert.match(html, /data-testid="p2-option-0"/);

    // No feedback banners or next-question button before timer expires and reveal is clicked
    assert.doesNotMatch(html, /data-testid="p1-feedback-bar"/);
    assert.doesNotMatch(html, /data-testid="p2-feedback-bar"/);
    assert.doesNotMatch(html, /إجابة صحيحة! أحسنت/);
    assert.doesNotMatch(html, /data-testid="two-player-next-btn"/);
  });

  it('7. renders animated green/red/unanswered feedback bars ONLY after reveal and renders next button', () => {
    let session = createInitialTwoPlayerSession(20);
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-1' }), // correct
    };
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedOptionId: 'opt-2' }), // wrong
      timeLeft: 1,
    };
    session = tickTwoPlayerTimer(session);
    session = {
      ...session,
      roundState: revealTwoPlayerRound(session.roundState, sampleQuestion1),
    };

    const revealedHtml = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        initialSession: session,
        onExitToActivities: () => {},
      })
    );

    assert.match(revealedHtml, /data-testid="p1-feedback-bar"[^>]*data-outcome="correct"/);
    assert.match(revealedHtml, /إجابة صحيحة! أحسنت/);
    assert.match(revealedHtml, /data-testid="p2-feedback-bar"[^>]*data-outcome="wrong"/);
    assert.match(revealedHtml, /إجابة خاطئة، حاول مرة أخرى في السؤال القادم/);
    assert.match(revealedHtml, /data-testid="two-player-next-btn"/);
  });

  it('8. renders festive winner and tie celebration screens with persistent stage container, crown, confetti, and manual exit controls', () => {
    let winnerSession = createInitialTwoPlayerSession(20);
    winnerSession = {
      ...winnerSession,
      completed: true,
      roundState: {
        ...winnerSession.roundState,
        p1Score: 20,
        p1CorrectCount: 2,
        p2Score: 10,
        p2CorrectCount: 1,
        p2WrongCount: 1,
      },
    };

    const winnerHtml = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        initialSession: winnerSession,
        onExitToActivities: () => {},
      })
    );

    // Persistent root container keeps mounted to prevent fullscreen drop
    assert.match(winnerHtml, /data-testid="two-player-stage"/);
    assert.match(winnerHtml, /data-testid="two-player-completion"[^>]*data-winner-result="p1"/);
    assert.match(winnerHtml, /data-testid="winner-celebration"/);
    assert.match(winnerHtml, /data-testid="two-player-confetti"/);
    assert.match(winnerHtml, /data-avatar-id="avatar_lion"[^>]*data-celebration="victory"/);
    assert.match(winnerHtml, /data-testid="replay-two-player-btn"/);
    assert.match(winnerHtml, /إعادة المنافسة/);

    // Celebration controls: manual exit and fullscreen toggle
    assert.match(winnerHtml, /data-testid="celebration-fullscreen-btn"/);
    assert.match(winnerHtml, /data-testid="exit-two-player-btn"/);
    assert.match(winnerHtml, /إنهاء والعودة إلى الأنشطة/);

    const tieSession = {
      ...winnerSession,
      roundState: {
        ...winnerSession.roundState,
        p1Score: 10,
        p2Score: 10,
      },
    };

    const tieHtml = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        playerConfig,
        initialSession: tieSession,
        onExitToActivities: () => {},
      })
    );

    assert.match(tieHtml, /data-testid="two-player-stage"/);
    assert.match(tieHtml, /data-testid="two-player-completion"[^>]*data-winner-result="tie"/);
    assert.match(tieHtml, /data-testid="tie-celebration"/);
    assert.match(tieHtml, /data-avatar-id="avatar_lion"/);
    assert.match(tieHtml, /data-avatar-id="avatar_bunny"/);
    assert.match(tieHtml, /data-testid="celebration-fullscreen-btn"/);
    assert.match(tieHtml, /data-testid="exit-two-player-btn"/);
  });

  it('9. gives Player 1 and Player 2 identical option sets in two different randomized orders on screen', () => {
    const qCountry: InteractiveLearningQuestion = {
      ...sampleQuestion1,
      id: 'q-country',
      prompt: 'ما عاصمة العراق؟',
      options: [
        { id: 'c-1', questionId: 'q-country', optionOrder: 0, optionText: 'العراق', isCorrect: true, imagePath: null, imageUrl: null },
        { id: 'c-2', questionId: 'q-country', optionOrder: 1, optionText: 'إيران', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'c-3', questionId: 'q-country', optionOrder: 2, optionText: 'السعودية', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'c-4', questionId: 'q-country', optionOrder: 3, optionText: 'الكويت', isCorrect: false, imagePath: null, imageUrl: null },
      ],
    };
    const twoPlayerActivity: InteractiveActivityRecord = {
      ...sampleActivity,
      questions: [qCountry],
      questionCount: 1,
    };

    const html = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: twoPlayerActivity,
        playerConfig,
        onExitToActivities: () => {},
      })
    );

    const p1Matches = [...html.matchAll(/data-testid="p1-option-\d+" data-option-id="([^"]+)"/g)].map(
      (m) => m[1]
    );
    const p2Matches = [...html.matchAll(/data-testid="p2-option-\d+" data-option-id="([^"]+)"/g)].map(
      (m) => m[1]
    );

    assert.equal(p1Matches.length, 4);
    assert.equal(p2Matches.length, 4);
    assert.deepEqual([...p1Matches].sort(), ['c-1', 'c-2', 'c-3', 'c-4']);
    assert.deepEqual([...p2Matches].sort(), ['c-1', 'c-2', 'c-3', 'c-4']);
    assert.notDeepEqual(p1Matches, p2Matches, 'Player 1 and Player 2 option orders must differ');

    // Even with a completely constant RNG (worst-case collision), orders must differ
    const forcedCollisionOrder = createQuestionOptionOrder(qCountry, () => 0.5);
    assert.notDeepEqual(forcedCollisionOrder.p1OptionIds, forcedCollisionOrder.p2OptionIds);
    assert.deepEqual([...forcedCollisionOrder.p1OptionIds].sort(), ['c-1', 'c-2', 'c-3', 'c-4']);
    assert.deepEqual([...forcedCollisionOrder.p2OptionIds].sort(), ['c-1', 'c-2', 'c-3', 'c-4']);
  });

  it('10. scores correct & wrong answers accurately by option ID regardless of shuffled position, and keeps feedback letters per-panel', () => {
    const qCountry: InteractiveLearningQuestion = {
      ...sampleQuestion1,
      id: 'q-country-score',
      prompt: 'اختر الدولة الصحيحة',
      options: [
        { id: 'c-1', questionId: 'q-country-score', optionOrder: 0, optionText: 'العراق', isCorrect: true, imagePath: null, imageUrl: null },
        { id: 'c-2', questionId: 'q-country-score', optionOrder: 1, optionText: 'إيران', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'c-3', questionId: 'q-country-score', optionOrder: 2, optionText: 'السعودية', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'c-4', questionId: 'q-country-score', optionOrder: 3, optionText: 'الكويت', isCorrect: false, imagePath: null, imageUrl: null },
      ],
    };

    // P1 sees correct answer 'c-1' at index 2 (ج); P2 sees correct answer 'c-1' at index 3 (د)
    let session = createInitialTwoPlayerSession(20, [qCountry]);
    session = {
      ...session,
      optionOrdersByQuestion: {
        [qCountry.id]: {
          p1OptionIds: ['c-2', 'c-3', 'c-1', 'c-4'],
          p2OptionIds: ['c-4', 'c-2', 'c-3', 'c-1'],
        },
      },
    };

    const p1Ordered = getPlayerOrderedOptionsForSession(session, qCountry, 1);
    const p2Ordered = getPlayerOrderedOptionsForSession(session, qCountry, 2);
    assert.equal(p1Ordered[2].id, 'c-1');
    assert.equal(p2Ordered[3].id, 'c-1');

    // Feedback text uses each player's OWN position letter, never leaking the other player's order
    assert.equal(extractTwoPlayerCorrectAnswerText(qCountry, p1Ordered), 'ج. العراق');
    assert.equal(extractTwoPlayerCorrectAnswerText(qCountry, p2Ordered), 'د. العراق');

    // P1 picks c-1 (at P1 index 2 -> correct), P2 picks c-4 (at P2 index 0 -> wrong)
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: p1Ordered[2].id }),
    };
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedOptionId: p2Ordered[0].id }),
    };

    const revealed = revealTwoPlayerRound(session.roundState, qCountry);
    assert.equal(revealed.p1Outcome, 'correct');
    assert.equal(revealed.p2Outcome, 'wrong');
    assert.equal(revealed.p1Score, POINTS_PER_CORRECT_ANSWER);
    assert.equal(revealed.p2Score, 0);

    // Now test the reverse: P1 picks wrong at index 0 (c-2), P2 picks correct at index 3 (c-1)
    let session2 = createInitialTwoPlayerSession(20, [qCountry]);
    session2 = {
      ...session2,
      optionOrdersByQuestion: session.optionOrdersByQuestion,
      roundState: selectPlayerChoiceInRound(session2.roundState, 1, { selectedOptionId: p1Ordered[0].id }),
    };
    session2 = {
      ...session2,
      roundState: selectPlayerChoiceInRound(session2.roundState, 2, { selectedOptionId: p2Ordered[3].id }),
    };
    const revealed2 = revealTwoPlayerRound(session2.roundState, qCountry);
    assert.equal(revealed2.p1Outcome, 'wrong');
    assert.equal(revealed2.p2Outcome, 'correct');
    assert.equal(revealed2.p1Score, 0);
    assert.equal(revealed2.p2Score, POINTS_PER_CORRECT_ANSWER);
  });

  it('11. freezes option order during active question updates (selection, pause, timer tick, reveal)', () => {
    let session = createInitialTwoPlayerSession(5, [sampleQuestion1, sampleQuestion2]);
    const initialOrder = session.optionOrdersByQuestion[sampleQuestion1.id];
    assert.ok(initialOrder);

    // Ensure repeated calls to ensureQuestionOptionOrderInMap with different RNG do NOT reshuffle
    const preservedMap = ensureQuestionOptionOrderInMap(
      session.optionOrdersByQuestion,
      sampleQuestion1,
      () => 0.99
    );
    assert.deepEqual(preservedMap[sampleQuestion1.id], initialOrder);

    // Select, pause, tick, unpause, tick to expiry, reveal -> order never changes
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 1, { selectedOptionId: 'opt-2' }),
    };
    session = toggleTwoPlayerPause(session);
    session = tickTwoPlayerTimer(session);
    session = toggleTwoPlayerPause(session);
    session = tickTwoPlayerTimer(session);
    session = {
      ...session,
      roundState: selectPlayerChoiceInRound(session.roundState, 2, { selectedOptionId: 'opt-1' }),
    };
    session = {
      ...session,
      roundState: revealTwoPlayerRound(session.roundState, sampleQuestion1),
    };

    assert.deepEqual(session.optionOrdersByQuestion[sampleQuestion1.id], initialOrder);
  });

  it('12. generates a new order when advancing to a new question and restores previous order when returning to an earlier question', () => {
    const sampleQuestion3: InteractiveLearningQuestion = {
      ...sampleQuestion1,
      id: 'q-3',
      prompt: 'سؤال اختيارات ثاني',
      options: [
        { id: 'q3-1', questionId: 'q-3', optionOrder: 0, optionText: 'أ1', isCorrect: true, imagePath: null, imageUrl: null },
        { id: 'q3-2', questionId: 'q-3', optionOrder: 1, optionText: 'ب2', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'q3-3', questionId: 'q-3', optionOrder: 2, optionText: 'ج3', isCorrect: false, imagePath: null, imageUrl: null },
        { id: 'q3-4', questionId: 'q-3', optionOrder: 3, optionText: 'د4', isCorrect: false, imagePath: null, imageUrl: null },
      ],
    };

    const qs = [sampleQuestion1, sampleQuestion3];
    let step = 0;
    const seqRng = () => {
      step = (step + 1) % 7;
      return (step * 0.13) % 1;
    };

    let session = createInitialTwoPlayerSession(20, qs, seqRng);
    const q1InitialOrder = session.optionOrdersByQuestion[sampleQuestion1.id];
    assert.ok(q1InitialOrder);
    assert.equal(session.optionOrdersByQuestion[sampleQuestion3.id], undefined);

    // Move forward to Question 2 -> generates new independent order for q-3
    session = navigateTwoPlayerSession(session, 1, qs.length, qs, seqRng);
    assert.equal(session.currentIndex, 1);
    const q3Order = session.optionOrdersByQuestion[sampleQuestion3.id];
    assert.ok(q3Order);
    assert.notDeepEqual(q3Order.p1OptionIds, q3Order.p2OptionIds);
    assert.deepEqual(session.optionOrdersByQuestion[sampleQuestion1.id], q1InitialOrder);

    // Navigate BACK to Question 1 with a completely different RNG -> MUST restore exact q1InitialOrder
    session = navigateTwoPlayerSession(session, 0, qs.length, qs, () => 0.01);
    assert.equal(session.currentIndex, 0);
    assert.deepEqual(session.optionOrdersByQuestion[sampleQuestion1.id], q1InitialOrder);

    // Navigate forward again to Question 2 -> MUST restore exact q3Order
    session = navigateTwoPlayerSession(session, 1, qs.length, qs, () => 0.95);
    assert.deepEqual(session.optionOrdersByQuestion[sampleQuestion3.id], q3Order);

    // getOrderedOptionsForPlayer handles missing or partial order gracefully
    assert.equal(getOrderedOptionsForPlayer(sampleQuestion3, undefined).length, 4);
  });

  it('13. leaves standard Smartboard mode option order completely unaffected', () => {
    const standardHtml = renderToStaticMarkup(
      React.createElement(SmartboardStageView, {
        activity: sampleActivity,
        onExitToActivities: () => {},
      })
    );

    const optPositions = ['القدس', 'عمان', 'بيروت', 'دمشق'].map((label) =>
      standardHtml.indexOf(label)
    );
    assert.ok(
      optPositions[0] < optPositions[1] &&
        optPositions[1] < optPositions[2] &&
        optPositions[2] < optPositions[3],
      'Standard Smartboard mode must preserve exact original option order'
    );
  });
});

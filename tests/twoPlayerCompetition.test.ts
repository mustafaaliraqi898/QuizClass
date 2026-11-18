import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createInitialTwoPlayerSession,
  navigateTwoPlayerSession,
  revealTwoPlayerRound,
  selectPlayerChoiceInRound,
} from '../src/components/interactive-learning/twoPlayerCompetitionLogic.ts';
import { TwoPlayerCompetitionStageView } from '../src/components/interactive-learning/TwoPlayerCompetitionStageView.tsx';
import type { InteractiveActivityRecord, InteractiveLearningQuestion } from '../src/types/interactiveLearning.ts';

describe('QuizClass Two-Player Competition Mode Suite', () => {
  const sampleQuestion: InteractiveLearningQuestion = {
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
    explanation: 'القدس هي العاصمة الأبدية لفلسطين.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    options: [
      { id: 'opt-1', questionId: 'q-1', optionOrder: 0, optionText: 'القدس', isCorrect: true, imagePath: null, imageUrl: null },
      { id: 'opt-2', questionId: 'q-1', optionOrder: 1, optionText: 'عمان', isCorrect: false, imagePath: null, imageUrl: null },
      { id: 'opt-3', questionId: 'q-1', optionOrder: 2, optionText: 'بيروت', isCorrect: false, imagePath: null, imageUrl: null },
      { id: 'opt-4', questionId: 'q-1', optionOrder: 3, optionText: 'دمشق', isCorrect: false, imagePath: null, imageUrl: null },
    ],
  };

  const sampleActivity: InteractiveActivityRecord = {
    id: 'act-1',
    title: 'مسابقة التحدي الثنائي',
    subject: 'التاريخ',
    grade: 'الثامن',
    autoFullscreen: false,
    questionCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [sampleQuestion],
  };

  it('1. initializes two-player session with independent default states and zero scores', () => {
    const session = createInitialTwoPlayerSession(30);
    assert.equal(session.currentIndex, 0);
    assert.equal(session.completed, false);
    assert.equal(session.timeLeft, 30);
    assert.equal(session.roundState.p1Score, 0);
    assert.equal(session.roundState.p2Score, 0);
    assert.equal(session.roundState.status, 'playing');
    assert.equal(session.roundState.p1Selection.selectedOptionId, null);
    assert.equal(session.roundState.p2Selection.selectedOptionId, null);
  });

  it('2. supports independent selections for Player 1 and Player 2 without revealing correctness', () => {
    let roundState = createInitialTwoPlayerSession(30).roundState;

    // Player 1 selects correct option opt-1
    roundState = selectPlayerChoiceInRound(roundState, 1, { selectedOptionId: 'opt-1' });
    assert.equal(roundState.p1Selection.selectedOptionId, 'opt-1');
    assert.equal(roundState.p2Selection.selectedOptionId, null);
    assert.equal(roundState.status, 'playing'); // Concealed!

    // Player 2 selects wrong option opt-2
    roundState = selectPlayerChoiceInRound(roundState, 2, { selectedOptionId: 'opt-2' });
    assert.equal(roundState.p1Selection.selectedOptionId, 'opt-1');
    assert.equal(roundState.p2Selection.selectedOptionId, 'opt-2');
    assert.equal(roundState.status, 'playing'); // Still concealed until reveal
  });

  it('3. reveals round simultaneously, calculates scores correctly, and tracks stats', () => {
    let roundState = createInitialTwoPlayerSession(30).roundState;
    roundState = selectPlayerChoiceInRound(roundState, 1, { selectedOptionId: 'opt-1' }); // correct
    roundState = selectPlayerChoiceInRound(roundState, 2, { selectedOptionId: 'opt-3' }); // wrong

    const revealed = revealTwoPlayerRound(roundState, sampleQuestion);
    assert.equal(revealed.status, 'revealed');

    // P1 got it right -> +10 points, 1 correct count
    assert.equal(revealed.p1Score, 10);
    assert.equal(revealed.p1CorrectCount, 1);
    assert.equal(revealed.p1WrongCount, 0);

    // P2 got it wrong -> 0 points, 1 wrong count
    assert.equal(revealed.p2Score, 0);
    assert.equal(revealed.p2CorrectCount, 0);
    assert.equal(revealed.p2WrongCount, 1);
  });

  it('4. navigates session and marks completion upon reaching final question limit', () => {
    let session = createInitialTwoPlayerSession(30);
    session = navigateTwoPlayerSession(session, 1, 1, 30);
    assert.equal(session.completed, true);
  });

  it('5. renders TwoPlayerCompetitionStageView correctly with side-by-side panels and countdown timer', () => {
    const html = renderToStaticMarkup(
      React.createElement(TwoPlayerCompetitionStageView, {
        activity: sampleActivity,
        onExitToActivities: () => {},
      })
    );

    assert.match(html, /منافسة طالبين/);
    assert.match(html, /الطالب الأول \(أحمد\)/);
    assert.match(html, /الطالب الثاني \(سارة\)/);
    assert.match(html, /ما عاصمة فلسطين؟/);
    assert.match(html, /data-testid="player-1-panel"/);
    assert.match(html, /data-testid="player-2-panel"/);
    assert.match(html, /data-testid="two-player-timer"/);
    assert.match(html, /إظهار النتيجة والتحقق/);
  });
});

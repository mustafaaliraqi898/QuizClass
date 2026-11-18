import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { InteractiveActivityRecord } from '../../types/interactiveLearning';
import { extractSmartboardCorrectAnswerText } from './interactiveLearningLogic';
import {
  createInitialTwoPlayerSession,
  navigateTwoPlayerSession,
  revealTwoPlayerRound,
  selectPlayerChoiceInRound,
  type TwoPlayerSessionState,
} from './twoPlayerCompetitionLogic';

interface TwoPlayerCompetitionStageViewProps {
  activity: InteractiveActivityRecord;
  onExitToActivities: () => void;
  onSwitchToStandard?: () => void;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const QUESTION_TIME_SECONDS = 30;

export function TwoPlayerCompetitionStageView({
  activity,
  onExitToActivities,
  onSwitchToStandard,
}: TwoPlayerCompetitionStageViewProps) {
  const [session, setSession] = useState<TwoPlayerSessionState>(() =>
    createInitialTwoPlayerSession(QUESTION_TIME_SECONDS)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const questions = activity.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[session.currentIndex] ?? null;

  // Reset session when activity changes
  useEffect(() => {
    setSession(createInitialTwoPlayerSession(QUESTION_TIME_SECONDS));
  }, [activity.id]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) setFullscreenNote(null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (session.completed || session.isPaused || session.roundState.status === 'revealed') {
      return;
    }

    if (session.timeLeft <= 0) {
      // Time expired: automatically reveal round
      if (currentQuestion) {
        setSession((prev) => ({
          ...prev,
          roundState: revealTwoPlayerRound(prev.roundState, currentQuestion),
        }));
      }
      return;
    }

    const timer = setInterval(() => {
      setSession((prev) => {
        if (prev.timeLeft <= 1) {
          const revealedRound = currentQuestion
            ? revealTwoPlayerRound(prev.roundState, currentQuestion)
            : prev.roundState;
          return {
            ...prev,
            roundState: revealedRound,
            timeLeft: 0,
          };
        }
        return {
          ...prev,
          timeLeft: prev.timeLeft - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session.completed, session.isPaused, session.roundState.status, session.timeLeft, currentQuestion]);

  const handleToggleFullscreen = () => {
    setFullscreenNote(null);
    if (typeof document === 'undefined') return;

    if (!document.fullscreenElement) {
      const target = stageRef.current;
      if (!target || typeof target.requestFullscreen !== 'function') {
        setFullscreenNote('المتصفح الحالي لا يدعم وضع ملء الشاشة.');
        return;
      }
      target.requestFullscreen().catch(() => {
        setFullscreenNote('تعذر تفعيل ملء الشاشة.');
      });
    } else if (typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleExit = () => {
    if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
    onExitToActivities();
  };

  if (totalQuestions === 0) {
    return (
      <div className="qc-card rounded-3xl p-10 text-center">
        <Users className="mx-auto h-12 w-12 text-ink-muted" />
        <h2 className="font-display mt-3 text-xl font-extrabold text-ink">
          لا توجد أسئلة متاحة في هذا النشاط
        </h2>
        <button
          type="button"
          onClick={handleExit}
          className="qc-btn-primary mt-5 inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold"
        >
          العودة إلى الأنشطة
        </button>
      </div>
    );
  }

  // Final Completion Summary View
  if (session.completed) {
    const p1Score = session.roundState.p1Score;
    const p2Score = session.roundState.p2Score;
    let winnerText = 'تعادل مثير بين الطالبين!';
    let winnerBadge = '🤝 تعادل';

    if (p1Score > p2Score) {
      winnerText = 'فاز الطالب الأول (أحمد) بجدارة!';
      winnerBadge = '🏆 بطل التحدي: الطالب الأول';
    } else if (p2Score > p1Score) {
      winnerText = 'فازت الطالبة الثانية (سارة) بجدارة!';
      winnerBadge = '🏆 بطلة التحدي: الطالبة الثانية';
    }

    return (
      <div
        ref={stageRef}
        data-testid="two-player-completion"
        className={`flex flex-col items-center justify-center p-8 sm:p-14 text-center ${
          isFullscreen ? 'min-h-screen bg-canvas' : 'qc-card rounded-3xl'
        }`}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-selected text-accent ring-4 ring-primary/20">
          <Trophy className="h-11 w-11" />
        </div>

        <span className="mt-4 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-black text-accent">
          {winnerBadge}
        </span>

        <h2 className="font-display mt-3 text-2xl sm:text-4xl font-black text-ink">
          {winnerText}
        </h2>
        <p className="mt-2 max-w-xl text-sm sm:text-base font-medium text-ink-muted">
          انتهت منافسة طالبين في نشاط «{activity.title}» بعد الإجابة على {totalQuestions} أسئلة.
        </p>

        {/* Final Score Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          <div className="rounded-2xl border-2 border-primary/30 bg-selected/40 p-6 text-center space-y-2">
            <span className="text-xs font-bold text-accent">الطالب الأول (أحمد)</span>
            <div className="font-display text-4xl font-black text-ink tabular-nums">
              {p1Score} <span className="text-lg font-bold text-ink-muted">نقطة</span>
            </div>
            <div className="text-xs font-bold text-success">
              صحيح: {session.roundState.p1CorrectCount} | خطأ: {session.roundState.p1WrongCount}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-success/30 bg-success-soft/40 p-6 text-center space-y-2">
            <span className="text-xs font-bold text-success">الطالب الثاني (سارة)</span>
            <div className="font-display text-4xl font-black text-ink tabular-nums">
              {p2Score} <span className="text-lg font-bold text-ink-muted">نقطة</span>
            </div>
            <div className="text-xs font-bold text-success">
              صحيح: {session.roundState.p2CorrectCount} | خطأ: {session.roundState.p2WrongCount}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setSession(createInitialTwoPlayerSession(QUESTION_TIME_SECONDS))}
            className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-sm font-extrabold whitespace-nowrap"
          >
            <RotateCcw className="h-5 w-5" />
            <span>إعادة التحدي من البداية</span>
          </button>

          <button
            type="button"
            onClick={handleExit}
            className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-sm font-extrabold whitespace-nowrap"
          >
            <span>العودة إلى الأنشطة</span>
          </button>
        </div>
      </div>
    );
  }

  const questionNumber = session.currentIndex + 1;
  const isLastQuestion = questionNumber === totalQuestions;
  const isRevealed = session.roundState.status === 'revealed';
  const correctText = extractSmartboardCorrectAnswerText(currentQuestion);

  return (
    <div
      ref={stageRef}
      data-testid="two-player-stage"
      data-question-index={session.currentIndex}
      data-round-status={session.roundState.status}
      className={`flex flex-col justify-between gap-5 transition-colors ${
        isFullscreen
          ? 'min-h-screen overflow-y-auto bg-canvas p-5 sm:p-8'
          : 'qc-card rounded-3xl p-5 sm:p-8'
      }`}
    >
      {/* Top Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExit}
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold whitespace-nowrap shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
              <span>الخروج</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-accent">
                  <Users className="h-3.5 w-3.5" />
                  <span>منافسة طالبين</span>
                </span>
                <span className="font-display text-sm font-extrabold text-ink truncate">
                  {activity.title}
                </span>
              </div>
              <p className="text-xs font-bold text-ink-muted mt-0.5">
                السؤال {questionNumber} من {totalQuestions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shared Countdown Timer */}
            <div
              data-testid="two-player-timer"
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black tabular-nums ${
                session.timeLeft <= 5
                  ? 'border-danger bg-danger-soft text-danger-ink animate-pulse'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              <Clock className="h-4 w-4 text-accent" />
              <span>{session.timeLeft} ثانية</span>
            </div>

            {onSwitchToStandard && (
              <button
                type="button"
                onClick={onSwitchToStandard}
                className="qc-btn-secondary inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-xs font-extrabold whitespace-nowrap"
              >
                <span>السبورة العادية</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold whitespace-nowrap shrink-0"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>
          </div>
        </div>

        {fullscreenNote && (
          <div className="text-xs font-bold text-warning-ink bg-warning-soft px-3 py-1.5 rounded-xl">
            {fullscreenNote}
          </div>
        )}
      </header>

      {/* Shared Question Prompt */}
      <div className="rounded-3xl border border-line bg-surface-subtle p-5 sm:p-6 text-center">
        <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-black leading-relaxed text-ink">
          {currentQuestion.prompt}
        </h1>
        {currentQuestion.imageUrl && (
          <img
            src={currentQuestion.imageUrl}
            alt="صورة السؤال"
            referrerPolicy="no-referrer"
            className="mx-auto mt-4 max-h-48 w-auto rounded-2xl object-contain border border-line"
          />
        )}
      </div>

      {/* Revealed Correct Answer Banner */}
      {isRevealed && (
        <div
          role="status"
          data-testid="two-player-revealed-banner"
          className="rounded-2xl border-2 border-success bg-success-soft px-5 py-3 text-success-ink flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            <span className="font-display text-base sm:text-lg font-black">
              الإجابة الصحيحة: {correctText}
            </span>
          </div>
        </div>
      )}

      {/* Split Screen Panels (Player 1 & Player 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PLAYER 1 PANEL */}
        <div
          data-testid="player-1-panel"
          className="flex flex-col justify-between rounded-3xl border-2 border-primary/30 bg-surface p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black text-sm">
                P1
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">الطالب الأول (أحمد)</h3>
                <span className="text-xs font-bold text-ink-muted">اختيار مستقل</span>
              </div>
            </div>
            <div className="rounded-xl bg-selected px-3.5 py-1.5 text-sm font-black text-accent tabular-nums">
              {session.roundState.p1Score} نقطة
            </div>
          </div>

          {/* Options for Player 1 */}
          <div className="space-y-3 flex-1">
            {currentQuestion.type === 'multiple_choice' ? (
              currentQuestion.options.map((opt, idx) => {
                const isSelected = session.roundState.p1Selection.selectedOptionId === opt.id;
                const highlightCorrect = isRevealed && opt.isCorrect;
                const highlightWrong = isRevealed && isSelected && !opt.isCorrect;

                let btnStyle = 'border-line bg-surface-subtle text-ink hover:border-primary';
                if (highlightCorrect) btnStyle = 'border-success bg-success-soft text-success-ink ring-2 ring-success';
                else if (highlightWrong) btnStyle = 'border-danger bg-danger-soft text-danger-ink ring-2 ring-danger';
                else if (isSelected) btnStyle = 'border-primary bg-selected text-ink ring-2 ring-primary';

                return (
                  <button
                    key={`p1-opt-${opt.id}`}
                    type="button"
                    disabled={isRevealed}
                    data-testid={`p1-option-${idx}`}
                    onClick={() =>
                      setSession((prev) => ({
                        ...prev,
                        roundState: selectPlayerChoiceInRound(prev.roundState, 1, {
                          selectedOptionId: opt.id,
                        }),
                      }))
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-start transition-all disabled:cursor-default ${btnStyle}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface font-display text-sm font-black text-ink">
                      {OPTION_LETTERS[idx] ?? idx + 1}
                    </span>
                    <span className="font-display text-sm sm:text-base font-bold flex-1">
                      {opt.optionText}
                    </span>
                    {highlightCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                    {highlightWrong && <XCircle className="h-5 w-5 text-danger shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: true, label: 'صح' },
                  { val: false, label: 'خطأ' },
                ].map((tf) => {
                  const isSelected = session.roundState.p1Selection.selectedBoolean === tf.val;
                  const isCorrectAnswer = currentQuestion.correctBoolean === tf.val;
                  const highlightCorrect = isRevealed && isCorrectAnswer;
                  const highlightWrong = isRevealed && isSelected && !isCorrectAnswer;

                  let btnStyle = 'border-line bg-surface-subtle text-ink hover:border-primary';
                  if (highlightCorrect) btnStyle = 'border-success bg-success-soft text-success-ink ring-2 ring-success';
                  else if (highlightWrong) btnStyle = 'border-danger bg-danger-soft text-danger-ink ring-2 ring-danger';
                  else if (isSelected) btnStyle = 'border-primary bg-selected text-ink ring-2 ring-primary';

                  return (
                    <button
                      key={`p1-tf-${tf.val}`}
                      type="button"
                      disabled={isRevealed}
                      data-testid={`p1-tf-${tf.val ? 'true' : 'false'}`}
                      onClick={() =>
                        setSession((prev) => ({
                          ...prev,
                          roundState: selectPlayerChoiceInRound(prev.roundState, 1, {
                            selectedBoolean: tf.val,
                          }),
                        }))
                      }
                      className={`flex h-20 items-center justify-center gap-2 rounded-2xl border-2 font-display text-lg font-black transition-all disabled:cursor-default ${btnStyle}`}
                    >
                      {tf.val ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-danger" />}
                      <span>{tf.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PLAYER 2 PANEL */}
        <div
          data-testid="player-2-panel"
          className="flex flex-col justify-between rounded-3xl border-2 border-success/30 bg-surface p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success text-white font-black text-sm">
                P2
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">الطالب الثاني (سارة)</h3>
                <span className="text-xs font-bold text-ink-muted">اختيار مستقل</span>
              </div>
            </div>
            <div className="rounded-xl bg-success-soft px-3.5 py-1.5 text-sm font-black text-success-ink tabular-nums">
              {session.roundState.p2Score} نقطة
            </div>
          </div>

          {/* Options for Player 2 */}
          <div className="space-y-3 flex-1">
            {currentQuestion.type === 'multiple_choice' ? (
              currentQuestion.options.map((opt, idx) => {
                const isSelected = session.roundState.p2Selection.selectedOptionId === opt.id;
                const highlightCorrect = isRevealed && opt.isCorrect;
                const highlightWrong = isRevealed && isSelected && !opt.isCorrect;

                let btnStyle = 'border-line bg-surface-subtle text-ink hover:border-success';
                if (highlightCorrect) btnStyle = 'border-success bg-success-soft text-success-ink ring-2 ring-success';
                else if (highlightWrong) btnStyle = 'border-danger bg-danger-soft text-danger-ink ring-2 ring-danger';
                else if (isSelected) btnStyle = 'border-success bg-success-soft/60 text-ink ring-2 ring-success';

                return (
                  <button
                    key={`p2-opt-${opt.id}`}
                    type="button"
                    disabled={isRevealed}
                    data-testid={`p2-option-${idx}`}
                    onClick={() =>
                      setSession((prev) => ({
                        ...prev,
                        roundState: selectPlayerChoiceInRound(prev.roundState, 2, {
                          selectedOptionId: opt.id,
                        }),
                      }))
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-start transition-all disabled:cursor-default ${btnStyle}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface font-display text-sm font-black text-ink">
                      {OPTION_LETTERS[idx] ?? idx + 1}
                    </span>
                    <span className="font-display text-sm sm:text-base font-bold flex-1">
                      {opt.optionText}
                    </span>
                    {highlightCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                    {highlightWrong && <XCircle className="h-5 w-5 text-danger shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: true, label: 'صح' },
                  { val: false, label: 'خطأ' },
                ].map((tf) => {
                  const isSelected = session.roundState.p2Selection.selectedBoolean === tf.val;
                  const isCorrectAnswer = currentQuestion.correctBoolean === tf.val;
                  const highlightCorrect = isRevealed && isCorrectAnswer;
                  const highlightWrong = isRevealed && isSelected && !isCorrectAnswer;

                  let btnStyle = 'border-line bg-surface-subtle text-ink hover:border-success';
                  if (highlightCorrect) btnStyle = 'border-success bg-success-soft text-success-ink ring-2 ring-success';
                  else if (highlightWrong) btnStyle = 'border-danger bg-danger-soft text-danger-ink ring-2 ring-danger';
                  else if (isSelected) btnStyle = 'border-success bg-success-soft/60 text-ink ring-2 ring-success';

                  return (
                    <button
                      key={`p2-tf-${tf.val}`}
                      type="button"
                      disabled={isRevealed}
                      data-testid={`p2-tf-${tf.val ? 'true' : 'false'}`}
                      onClick={() =>
                        setSession((prev) => ({
                          ...prev,
                          roundState: selectPlayerChoiceInRound(prev.roundState, 2, {
                            selectedBoolean: tf.val,
                          }),
                        }))
                      }
                      className={`flex h-20 items-center justify-center gap-2 rounded-2xl border-2 font-display text-lg font-black transition-all disabled:cursor-default ${btnStyle}`}
                    >
                      {tf.val ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-danger" />}
                      <span>{tf.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Teacher Controls Dock */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isRevealed}
            data-testid="two-player-reveal-btn"
            onClick={() =>
              setSession((prev) => ({
                ...prev,
                roundState: revealTwoPlayerRound(prev.roundState, currentQuestion),
              }))
            }
            className="qc-btn-primary inline-flex h-13 items-center gap-2 rounded-2xl px-6 text-sm sm:text-base font-extrabold disabled:opacity-50 whitespace-nowrap"
          >
            <ShieldCheck className="h-5 w-5" />
            <span>إظهار النتيجة والتحقق</span>
          </button>

          <button
            type="button"
            onClick={() => setSession((prev) => ({ ...prev, isPaused: !prev.isPaused }))}
            className="qc-btn-secondary inline-flex h-13 items-center gap-2 rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap"
          >
            {session.isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            <span>{session.isPaused ? 'استئناف العداد' : 'إيقاف مؤقت'}</span>
          </button>
        </div>

        <div>
          <button
            type="button"
            data-testid="two-player-next-btn"
            onClick={() =>
              setSession((prev) =>
                navigateTwoPlayerSession(prev, prev.currentIndex + 1, totalQuestions, QUESTION_TIME_SECONDS)
              )
            }
            className="inline-flex h-13 items-center gap-2 rounded-2xl bg-ink px-7 text-sm sm:text-base font-extrabold text-surface transition-opacity hover:opacity-90 whitespace-nowrap dark:bg-primary dark:text-white"
          >
            <span>{isLastQuestion ? 'إنهاء المنافسة وعرض النتائج' : 'السؤال التالي'}</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

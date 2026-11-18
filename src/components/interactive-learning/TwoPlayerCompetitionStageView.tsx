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
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { InteractiveActivityRecord } from '../../types/interactiveLearning';
import { AnimatedFullBodyAvatar } from '../live/AnimatedFullBodyAvatar';
import type { CompetitionSetup } from './InteractiveLearningLaunchSetup';
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
  players?: CompetitionSetup;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const QUESTION_TIME_SECONDS = 20;

export function TwoPlayerCompetitionStageView({
  activity,
  onExitToActivities,
  players,
}: TwoPlayerCompetitionStageViewProps) {
  const player1 = players?.player1 ?? { name: 'الطالب الأول', avatarId: 'avatar_robot' };
  const player2 = players?.player2 ?? { name: 'الطالب الثاني', avatarId: 'avatar_alien' };
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

  // Celebration screen after the final question
  if (session.completed) {
    const p1Score = session.roundState.p1Score;
    const p2Score = session.roundState.p2Score;
    const isTie = p1Score === p2Score;
    const winner = isTie ? null : p1Score > p2Score ? player1 : player2;

    return (
      <div
        ref={stageRef}
        data-testid="two-player-completion"
        dir="rtl"
        className={`relative isolate flex min-h-[82vh] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#081a46] via-[#172b70] to-[#35166d] px-4 py-10 text-center text-white shadow-2xl sm:px-8 ${isFullscreen ? 'min-h-screen' : ''}`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
          <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-5 py-2 text-sm font-black text-amber-200 shadow-lg">
          <Trophy className="h-5 w-5" />
          <span>{isTie ? 'منافسة رائعة!' : 'نتيجة المنافسة'}</span>
        </div>
        <h2 className="font-display text-3xl font-black leading-tight text-white drop-shadow-lg sm:text-5xl">
          {isTie ? 'تعادل رائع بين البطلين!' : `🏆 الفائز: ${winner?.name}`}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-medium text-blue-100 sm:text-base">
          {isTie ? 'أداء مميز منكما، تستحقان التحية!' : 'أحسنت! أداء رائع واستحقاق للبطولة، ومشاركة مميزة من المنافس الآخر.'}
        </p>

        <div className="mt-8 grid w-full max-w-5xl grid-cols-1 items-end gap-5 md:grid-cols-2">
          <section className={`relative flex min-h-72 flex-col items-center justify-end overflow-hidden rounded-3xl border p-5 pt-8 shadow-xl ${p1Score >= p2Score ? 'border-amber-300/70 bg-gradient-to-b from-blue-500/35 to-blue-950/80' : 'border-blue-300/40 bg-blue-950/45'}`}>
            {p1Score > p2Score && <span className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950">المركز الأول 🏆</span>}
            <AnimatedFullBodyAvatar avatarId={player1.avatarId} size="xl" showCrown={p1Score > p2Score || isTie} celebration={p1Score > p2Score ? 'victory' : 'clap'} animated />
            <h3 className="mt-2 text-xl font-black">{player1.name}</h3>
            <div className="mt-3 w-full rounded-2xl bg-black/25 px-4 py-3">
              <div className="font-display text-4xl font-black tabular-nums text-amber-200">{p1Score}<span className="mr-2 text-base text-blue-100">نقطة</span></div>
              <p className="mt-1 text-xs font-bold text-emerald-200">صحيح: {session.roundState.p1CorrectCount} <span className="mx-2 text-white/40">|</span> خطأ: {session.roundState.p1WrongCount}</p>
            </div>
          </section>

          <section className={`relative flex min-h-72 flex-col items-center justify-end overflow-hidden rounded-3xl border p-5 pt-8 shadow-xl ${p2Score > p1Score ? 'border-amber-300/70 bg-gradient-to-b from-emerald-500/35 to-emerald-950/80' : 'border-emerald-300/40 bg-emerald-950/45'}`}>
            {p2Score > p1Score && <span className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950">المركز الأول 🏆</span>}
            <AnimatedFullBodyAvatar avatarId={player2.avatarId} size="xl" showCrown={p2Score > p1Score || isTie} celebration={p2Score > p1Score ? 'victory' : 'clap'} animated />
            <h3 className="mt-2 text-xl font-black">{player2.name}</h3>
            <div className="mt-3 w-full rounded-2xl bg-black/25 px-4 py-3">
              <div className="font-display text-4xl font-black tabular-nums text-amber-200">{p2Score}<span className="mr-2 text-base text-emerald-100">نقطة</span></div>
              <p className="mt-1 text-xs font-bold text-emerald-200">صحيح: {session.roundState.p2CorrectCount} <span className="mx-2 text-white/40">|</span> خطأ: {session.roundState.p2WrongCount}</p>
            </div>
          </section>
        </div>

        {!isTie && (
          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-500/25 to-yellow-300/10 px-8 py-3 text-xl font-black text-amber-100 shadow-lg">
            <Trophy className="h-7 w-7 text-amber-300" />
            <span>بطل التحدي: {winner?.name}</span>
            <Sparkles className="h-6 w-6 text-amber-200" />
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => setSession(createInitialTwoPlayerSession(QUESTION_TIME_SECONDS))} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 text-sm font-extrabold text-white transition hover:bg-white/20">
            <RotateCcw className="h-5 w-5" /> إعادة المنافسة
          </button>
          <button type="button" onClick={handleExit} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-extrabold text-slate-900 transition hover:bg-blue-50">
            العودة إلى الأنشطة <ArrowLeft className="h-5 w-5" />
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

}

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
              <AnimatedFullBodyAvatar avatarId={player1.avatarId} size="sm" animated={false} />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black text-sm">
                P1
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">{player1.name}</h3>
                <span className="text-xs font-bold text-ink-muted">اختيار مستقل</span>
              </div>
            </div>
            <div className="rounded-xl bg-selected px-3.5 py-1.5 text-sm font-black text-accent tabular-nums">
              {session.roundState.p1Score} نقطة
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 text-center">
            <p className="mb-2 text-xs font-black text-blue-700">سؤال المنافسة</p>
            <h2 className="font-display text-lg font-black leading-relaxed text-slate-900 sm:text-xl">{currentQuestion.prompt}</h2>
            {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="صورة السؤال" referrerPolicy="no-referrer" className="mx-auto mt-3 max-h-36 w-auto rounded-xl border border-blue-100 object-contain" />}
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
              <AnimatedFullBodyAvatar avatarId={player2.avatarId} size="sm" animated={false} />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success text-white font-black text-sm">
                P2
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">{player2.name}</h3>
                <span className="text-xs font-bold text-ink-muted">اختيار مستقل</span>
              </div>
            </div>
            <div className="rounded-xl bg-success-soft px-3.5 py-1.5 text-sm font-black text-success-ink tabular-nums">
              {session.roundState.p2Score} نقطة
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 text-center">
            <p className="mb-2 text-xs font-black text-emerald-700">سؤال المنافسة</p>
            <h2 className="font-display text-lg font-black leading-relaxed text-slate-900 sm:text-xl">{currentQuestion.prompt}</h2>
            {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="صورة السؤال" referrerPolicy="no-referrer" className="mx-auto mt-3 max-h-36 w-auto rounded-xl border border-emerald-100 object-contain" />}
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
            disabled={!isRevealed}
            onClick={() =>
              setSession((prev) =>
                navigateTwoPlayerSession(prev, prev.currentIndex + 1, totalQuestions, QUESTION_TIME_SECONDS)
              )
            }
            className="inline-flex h-13 items-center gap-2 rounded-2xl bg-ink px-7 text-sm sm:text-base font-extrabold text-surface transition-opacity hover:opacity-90 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary dark:text-white"
          >
            <span>{isLastQuestion ? 'إنهاء المنافسة وعرض النتائج' : 'السؤال التالي'}</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

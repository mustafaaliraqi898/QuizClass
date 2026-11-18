import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Play,
  Presentation,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { getStudentAvatar, STUDENT_AVATARS } from '../../data/studentAvatars';
import type { InteractiveActivityRecord } from '../../types/interactiveLearning';
import { AnimatedFullBodyAvatar } from '../live/AnimatedFullBodyAvatar';
import {
  DEFAULT_TWO_PLAYER_CONFIG,
  normalizePlayerName,
  type InteractiveLaunchMode,
  type TwoPlayerConfig,
} from './twoPlayerCompetitionLogic';

interface ActivityLaunchSetupViewProps {
  activity: InteractiveActivityRecord;
  initialConfig?: TwoPlayerConfig;
  initialStep?: 'mode' | 'players';
  onStartStandard: () => void;
  onStartTwoPlayer: (config: TwoPlayerConfig) => void;
  onBackToActivities: () => void;
}

const TIMER_OPTIONS = [15, 20, 30, 45] as const;

export function ActivityLaunchSetupView({
  activity,
  initialConfig = DEFAULT_TWO_PLAYER_CONFIG,
  initialStep = 'mode',
  onStartStandard,
  onStartTwoPlayer,
  onBackToActivities,
}: ActivityLaunchSetupViewProps) {
  const [step, setStep] = useState<'mode' | 'players'>(initialStep);
  const [selectedMode, setSelectedMode] = useState<InteractiveLaunchMode>(
    initialStep === 'players' ? 'two_player' : 'standard'
  );

  const [p1Name, setP1Name] = useState(initialConfig.p1Name);
  const [p1AvatarId, setP1AvatarId] = useState(initialConfig.p1AvatarId);
  const [p2Name, setP2Name] = useState(initialConfig.p2Name);
  const [p2AvatarId, setP2AvatarId] = useState(initialConfig.p2AvatarId);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(
    initialConfig.roundDurationSeconds
  );

  const totalQuestions = activity.questions.length;
  const metaParts = [
    `${totalQuestions} ${totalQuestions === 1 ? 'سؤال' : 'أسئلة'}`,
    activity.subject,
    activity.grade,
  ].filter((item): item is string => Boolean(item));

  const handleLaunchCompetition = () => {
    onStartTwoPlayer({
      p1Name: normalizePlayerName(p1Name, 'الطالب الأول'),
      p1AvatarId,
      p2Name: normalizePlayerName(p2Name, 'الطالب الثاني'),
      p2AvatarId,
      roundDurationSeconds,
    });
  };

  if (totalQuestions === 0) {
    return (
      <div className="qc-card rounded-3xl p-10 text-center">
        <Presentation className="mx-auto h-12 w-12 text-ink-muted" />
        <h2 className="font-display mt-3 text-xl font-extrabold text-ink">
          لا توجد أسئلة متاحة في هذا النشاط
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          أضف أسئلة من بنك الأسئلة لتتمكن من تشغيل النشاط على السبورة الذكية.
        </p>
        <button
          type="button"
          onClick={onBackToActivities}
          className="qc-btn-primary mt-5 inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-extrabold"
        >
          العودة إلى الأنشطة
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="activity-launch-setup"
      className="mx-auto max-w-5xl space-y-6"
    >
      {/* Top Activity Context Header */}
      <section className="qc-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={step === 'players' ? () => setStep('mode') : onBackToActivities}
              data-testid="launch-setup-back-btn"
              className="qc-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
              <span>{step === 'players' ? 'اختيار الوضع' : 'الرجوع إلى الأنشطة'}</span>
            </button>

            <div className="min-w-0">
              <h2 className="font-display truncate text-lg sm:text-xl font-black text-ink">
                {activity.title}
              </h2>
              <div className="tabular-nums mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                {metaParts.map((part, idx) => (
                  <span key={`launch-meta-${idx}`} className="inline-flex items-center gap-2">
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
            <span className={step === 'mode' ? 'font-extrabold text-accent' : ''}>
              1. وضع التشغيل
            </span>
            <span aria-hidden="true">/</span>
            <span className={step === 'players' ? 'font-extrabold text-accent' : ''}>
              2. إعداد الطالبين
            </span>
          </div>
        </div>
      </section>

      {/* Step 1: Modern Two-Card Mode Selector */}
      {step === 'mode' ? (
        <section
          data-testid="launch-mode-selector"
          className="qc-card p-6 sm:p-8 space-y-7"
        >
          <div className="text-center space-y-1.5">
            <h3 className="font-display text-2xl sm:text-3xl font-black text-ink">
              اختر طريقة تشغيل النشاط على السبورة
            </h3>
            <p className="text-sm text-ink-muted">
              يمكنك عرض الأسئلة للمناقشة الصفية بالطريقة الاعتيادية، أو إطلاق تحدٍ مباشر بين طالبين على شاشتين منقسمتين.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Standard Smartboard Mode */}
            <button
              type="button"
              onClick={() => setSelectedMode('standard')}
              data-testid="mode-card-standard"
              aria-pressed={selectedMode === 'standard'}
              className={`group relative flex flex-col justify-between rounded-3xl border-2 p-6 text-start transition-all ${
                selectedMode === 'standard'
                  ? 'border-primary bg-selected/65 ring-4 ring-primary/15 shadow-md'
                  : 'border-line bg-surface-subtle hover:border-selected-line hover:bg-surface'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                      selectedMode === 'standard'
                        ? 'bg-primary text-white'
                        : 'bg-surface text-accent border border-line'
                    }`}
                  >
                    <Presentation className="h-7 w-7" />
                  </div>

                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      selectedMode === 'standard'
                        ? 'border-primary bg-primary text-white scale-100'
                        : 'border-line-strong bg-surface text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </div>

                {/* Visual Schematic Illustration: Single Full Smartboard */}
                <div
                  aria-hidden="true"
                  className="rounded-2xl border border-line bg-surface p-3.5 shadow-2xs"
                >
                  <div className="mx-auto mb-2.5 h-3.5 w-3/4 rounded-md bg-selected" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 rounded-lg border border-line bg-surface-subtle" />
                    <div className="h-6 rounded-lg border border-line bg-surface-subtle" />
                    <div className="h-6 rounded-lg border border-line bg-surface-subtle" />
                    <div className="h-6 rounded-lg border border-selected-line bg-selected" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-display text-xl font-black text-ink">
                    السبورة العادية
                  </h4>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    عرض سؤال واحد على كامل شاشة السبورة لمشاركة طالب أو نقاش الصف جماعياً مع أزرار التحقق وكشف الإجابة وإعادة المحاولة.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs font-bold text-ink-muted">
                <span>طالب واحد أو نقاش صفي</span>
                <span aria-hidden="true">·</span>
                <span>تحكم كامل للمعلم</span>
              </div>
            </button>

            {/* Card 2: Two-Player Competition Mode */}
            <button
              type="button"
              onClick={() => setSelectedMode('two_player')}
              data-testid="mode-card-two-player"
              aria-pressed={selectedMode === 'two_player'}
              className={`group relative flex flex-col justify-between rounded-3xl border-2 p-6 text-start transition-all ${
                selectedMode === 'two_player'
                  ? 'border-primary bg-selected/65 ring-4 ring-primary/15 shadow-md'
                  : 'border-line bg-surface-subtle hover:border-selected-line hover:bg-surface'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                      selectedMode === 'two_player'
                        ? 'bg-primary text-white'
                        : 'bg-surface text-accent border border-line'
                    }`}
                  >
                    <Users className="h-7 w-7" />
                  </div>

                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      selectedMode === 'two_player'
                        ? 'border-primary bg-primary text-white scale-100'
                        : 'border-line-strong bg-surface text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </div>

                {/* Visual Schematic Illustration: Split Screen Blue vs Green */}
                <div
                  aria-hidden="true"
                  className="grid grid-cols-2 gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs"
                >
                  <div className="space-y-1.5 rounded-xl border border-sky-300 bg-sky-50/90 p-2 dark:border-sky-700/70 dark:bg-sky-950/40">
                    <div className="flex items-center justify-between">
                      <span className="h-2.5 w-8 rounded bg-sky-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                    </div>
                    <div className="h-2.5 w-full rounded bg-sky-200/80 dark:bg-sky-800/60" />
                    <div className="h-3.5 w-full rounded bg-white/90 dark:bg-surface" />
                    <div className="h-3.5 w-full rounded bg-white/90 dark:bg-surface" />
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 p-2 dark:border-emerald-700/70 dark:bg-emerald-950/40">
                    <div className="flex items-center justify-between">
                      <span className="h-2.5 w-8 rounded bg-emerald-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="h-2.5 w-full rounded bg-emerald-200/80 dark:bg-emerald-800/60" />
                    <div className="h-3.5 w-full rounded bg-white/90 dark:bg-surface" />
                    <div className="h-3.5 w-full rounded bg-white/90 dark:bg-surface" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-display text-xl font-black text-ink">
                    منافسة طالبين
                  </h4>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    تقسيم السبورة إلى قسمين مستقلين باللونين الأزرق والأخضر مع السؤال والخيارات في كل قسم، ومؤقت مشترك، وشاشة تتويج احتفالية.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs font-bold text-ink-muted">
                <span>قسم أزرق وقسم أخضر</span>
                <span aria-hidden="true">·</span>
                <span>تقييم متزامن وتتويج الفائز</span>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={onBackToActivities}
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap"
            >
              <span>إلغاء</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedMode === 'standard') {
                  onStartStandard();
                } else {
                  setStep('players');
                }
              }}
              data-testid="launch-mode-continue-btn"
              className="qc-btn-primary inline-flex h-13 items-center gap-2.5 rounded-2xl px-8 text-sm sm:text-base font-extrabold shadow-sm whitespace-nowrap"
            >
              {selectedMode === 'standard' ? (
                <>
                  <Play className="h-5 w-5" />
                  <span>بدء السبورة العادية</span>
                </>
              ) : (
                <>
                  <span>متابعة إلى إعداد الطالبين</span>
                  <ArrowLeft className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </section>
      ) : (
        /* Step 2: Two-Player Names & Avatars Setup */
        <section
          data-testid="two-player-setup-screen"
          className="qc-card p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-ink">
                إعداد المتنافسين
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-ink-muted">
                أدخل اسم كل طالب واختر شخصيته الرمزية؛ ستبقى الأسماء والشخصيات محفوظة طوال جميع أسئلة المنافسة.
              </p>
            </div>

            {/* Shared Round Timer Selector */}
            <div className="flex items-center gap-2 self-start sm:self-auto rounded-2xl border border-line bg-surface-subtle p-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-bold text-ink-muted whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 text-accent" />
                <span>مدة السؤال:</span>
              </span>
              <div className="flex items-center gap-1">
                {TIMER_OPTIONS.map((seconds) => {
                  const active = roundDurationSeconds === seconds;
                  return (
                    <button
                      key={`timer-opt-${seconds}`}
                      type="button"
                      onClick={() => setRoundDurationSeconds(seconds)}
                      className={`tabular-nums rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-ink-muted hover:bg-surface hover:text-ink'
                      }`}
                    >
                      {seconds} ث
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Player 1 Setup Card (Blue Identity - Right in RTL) */}
            <div
              data-testid="setup-player-1-card"
              className="flex flex-col justify-between rounded-3xl border-2 border-sky-300 bg-sky-50/75 p-5 sm:p-6 space-y-5 dark:border-sky-700/70 dark:bg-sky-950/30"
            >
              <div className="flex items-center justify-between gap-4 border-b border-sky-200/80 pb-4 dark:border-sky-800/60">
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-sky-700 dark:text-sky-300">
                    القسم الأيمن · الهوية الزرقاء
                  </span>
                  <h4 className="font-display text-lg font-black text-ink">
                    الطالب الأول
                  </h4>
                  <p className="text-xs font-bold text-ink-muted">
                    الشخصية المختارة: {getStudentAvatar(p1AvatarId).label}
                  </p>
                </div>

                {/* Live Animated Full-Body Preview */}
                <div
                  data-testid="setup-p1-avatar-preview"
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-white/90 p-2 shadow-xs dark:border-sky-700/60 dark:bg-surface"
                >
                  <AnimatedFullBodyAvatar avatarId={p1AvatarId} size="md" animated={true} />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="setup-p1-name-input"
                  className="block text-xs font-extrabold text-ink"
                >
                  اسم الطالب الأول
                </label>
                <input
                  id="setup-p1-name-input"
                  data-testid="setup-p1-name"
                  type="text"
                  maxLength={36}
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  placeholder="اكتب اسم الطالب الأول..."
                  className="qc-input h-12 w-full rounded-2xl px-4 text-sm font-bold"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-extrabold text-ink">
                  اختر الشخصية الرمزية (12 شخصية)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {STUDENT_AVATARS.map((av) => {
                    const isSelected = p1AvatarId === av.id;
                    return (
                      <button
                        key={`p1-av-${av.id}`}
                        type="button"
                        onClick={() => setP1AvatarId(av.id)}
                        data-testid={`setup-p1-avatar-${av.id}`}
                        aria-pressed={isSelected}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-2.5 transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-white ring-2 ring-sky-500/30 shadow-xs dark:border-sky-400 dark:bg-surface'
                            : 'border-sky-200/80 bg-white/60 hover:border-sky-400 hover:bg-white dark:border-sky-800/50 dark:bg-surface/60'
                        }`}
                      >
                        <span className="text-2xl leading-none">{av.emoji}</span>
                        <span className="mt-1.5 w-full truncate text-center text-[11px] font-bold text-ink">
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Player 2 Setup Card (Green Identity - Left in RTL) */}
            <div
              data-testid="setup-player-2-card"
              className="flex flex-col justify-between rounded-3xl border-2 border-emerald-300 bg-emerald-50/75 p-5 sm:p-6 space-y-5 dark:border-emerald-700/70 dark:bg-emerald-950/30"
            >
              <div className="flex items-center justify-between gap-4 border-b border-emerald-200/80 pb-4 dark:border-emerald-800/60">
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    القسم الأيسر · الهوية الخضراء
                  </span>
                  <h4 className="font-display text-lg font-black text-ink">
                    الطالب الثاني
                  </h4>
                  <p className="text-xs font-bold text-ink-muted">
                    الشخصية المختارة: {getStudentAvatar(p2AvatarId).label}
                  </p>
                </div>

                {/* Live Animated Full-Body Preview */}
                <div
                  data-testid="setup-p2-avatar-preview"
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 p-2 shadow-xs dark:border-emerald-700/60 dark:bg-surface"
                >
                  <AnimatedFullBodyAvatar avatarId={p2AvatarId} size="md" animated={true} />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="setup-p2-name-input"
                  className="block text-xs font-extrabold text-ink"
                >
                  اسم الطالب الثاني
                </label>
                <input
                  id="setup-p2-name-input"
                  data-testid="setup-p2-name"
                  type="text"
                  maxLength={36}
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  placeholder="اكتب اسم الطالب الثاني..."
                  className="qc-input h-12 w-full rounded-2xl px-4 text-sm font-bold"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-extrabold text-ink">
                  اختر الشخصية الرمزية (12 شخصية)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {STUDENT_AVATARS.map((av) => {
                    const isSelected = p2AvatarId === av.id;
                    return (
                      <button
                        key={`p2-av-${av.id}`}
                        type="button"
                        onClick={() => setP2AvatarId(av.id)}
                        data-testid={`setup-p2-avatar-${av.id}`}
                        aria-pressed={isSelected}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-2.5 transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/30 shadow-xs dark:border-emerald-400 dark:bg-surface'
                            : 'border-emerald-200/80 bg-white/60 hover:border-emerald-400 hover:bg-white dark:border-emerald-800/50 dark:bg-surface/60'
                        }`}
                      >
                        <span className="text-2xl leading-none">{av.emoji}</span>
                        <span className="mt-1.5 w-full truncate text-center text-[11px] font-bold text-ink">
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => setStep('mode')}
              className="qc-btn-secondary inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap"
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة لاختيار الوضع</span>
            </button>

            <button
              type="button"
              onClick={handleLaunchCompetition}
              data-testid="start-two-player-btn"
              className="qc-btn-primary inline-flex h-13 items-center justify-center gap-2.5 rounded-2xl px-8 text-sm sm:text-base font-black shadow-sm whitespace-nowrap"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>بدء المنافسة</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Maximize2,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { httpInteractiveLearningService } from '../../services/interactiveLearningService';
import type {
  InteractiveActivityRecord,
  InteractiveActivitySummary,
} from '../../types/interactiveLearning';
import { formatQuizDate } from '../quizzes/quizFormatters';
import { ActivityBuilderView } from './ActivityBuilderView';
import { ActivityLaunchSetupView } from './ActivityLaunchSetupView';
import { SmartboardStageView } from './SmartboardStageView';
import { TwoPlayerCompetitionStageView } from './TwoPlayerCompetitionStageView';
import {
  DEFAULT_TWO_PLAYER_CONFIG,
  type TwoPlayerConfig,
} from './twoPlayerCompetitionLogic';

interface InteractiveLearningViewProps {
  onOpenQuestionBank?: () => void;
}

type ViewMode =
  | 'list'
  | 'builder'
  | 'launch-setup'
  | 'stage-standard'
  | 'stage-two-player';

export function InteractiveLearningView({
  onOpenQuestionBank,
}: InteractiveLearningViewProps) {
  const [mode, setMode] = useState<ViewMode>('list');
  const [setupInitialStep, setSetupInitialStep] = useState<'mode' | 'players'>('mode');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activeStageActivity, setActiveStageActivity] =
    useState<InteractiveActivityRecord | null>(null);
  const [twoPlayerConfig, setTwoPlayerConfig] = useState<TwoPlayerConfig>(
    DEFAULT_TWO_PLAYER_CONFIG
  );

  const [activities, setActivities] = useState<InteractiveActivitySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadActivities = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await httpInteractiveLearningService.listActivities({ signal });
      setActivities(response.activities);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل الأنشطة التعليمية المحفوظة.'
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadActivities(controller.signal);
    return () => controller.abort();
  }, [loadActivities]);

  const handleLaunchSavedActivity = async (activityId: string) => {
    setLaunchingId(activityId);
    setActionError(null);
    try {
      const fullActivity = await httpInteractiveLearningService.getActivityById(activityId);
      setActiveStageActivity(fullActivity);
      setSetupInitialStep('mode');
      setMode('launch-setup');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر تشغيل النشاط التعليمي على السبورة.'
      );
    } finally {
      setLaunchingId(null);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    setDeletingId(activityId);
    setActionError(null);
    try {
      await httpInteractiveLearningService.deleteActivity(activityId);
      setActivities((prev) => prev.filter((item) => item.id !== activityId));
      setConfirmDeleteId(null);
      setNotice('تم حذف النشاط التعليمي بنجاح دون التأثير على أسئلة بنك الأسئلة.');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر حذف النشاط التعليمي.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (mode === 'launch-setup' && activeStageActivity) {
    return (
      <ActivityLaunchSetupView
        activity={activeStageActivity}
        initialConfig={twoPlayerConfig}
        initialStep={setupInitialStep}
        onStartStandard={() => setMode('stage-standard')}
        onStartTwoPlayer={(config) => {
          setTwoPlayerConfig(config);
          setMode('stage-two-player');
        }}
        onBackToActivities={() => {
          setMode('list');
          void loadActivities();
        }}
      />
    );
  }

  if (mode === 'stage-standard' && activeStageActivity) {
    return (
      <SmartboardStageView
        activity={activeStageActivity}
        onExitToActivities={() => {
          setMode('list');
          void loadActivities();
        }}
      />
    );
  }

  if (mode === 'stage-two-player' && activeStageActivity) {
    return (
      <TwoPlayerCompetitionStageView
        activity={activeStageActivity}
        playerConfig={twoPlayerConfig}
        onBackToSetup={() => {
          setSetupInitialStep('players');
          setMode('launch-setup');
        }}
        onExitToActivities={() => {
          setMode('list');
          void loadActivities();
        }}
      />
    );
  }

  if (mode === 'builder') {
    return (
      <ActivityBuilderView
        editingActivityId={editingActivityId}
        onStartActivity={(activity) => {
          setActiveStageActivity(activity);
          setEditingActivityId(null);
          setSetupInitialStep('mode');
          setMode('launch-setup');
          void loadActivities();
        }}
        onSavedOnly={(activity, wasEditing) => {
          setEditingActivityId(null);
          setMode('list');
          setNotice(
            wasEditing
              ? `تم تحديث النشاط التعليمي «${activity.title}» بنجاح.`
              : `تم حفظ النشاط التعليمي «${activity.title}» (${activity.questionCount} سؤالاً) بنجاح.`
          );
          void loadActivities();
        }}
        onCancel={() => {
          setEditingActivityId(null);
          setMode('list');
        }}
        onOpenQuestionBank={onOpenQuestionBank}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="qc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-extrabold text-ink">
              التعلم التفاعلي على السبورة الذكية
            </h2>
            <p className="text-sm text-ink-muted">
              اعرض الأسئلة الحقيقية من بنك الأسئلة داخل الصف ليجيب الطلاب باللمس مباشرة على الشاشة، دون الحاجة إلى هواتف أو شبكة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingActivityId(null);
              setNotice(null);
              setActionError(null);
              setMode('builder');
            }}
            data-testid="create-interactive-activity-btn"
            className="qc-btn-primary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold whitespace-nowrap shrink-0"
          >
            <Plus className="h-5 w-5" />
            <span>إنشاء نشاط تعليمي</span>
          </button>
        </div>
      </section>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-success-line bg-success-soft px-5 py-3.5 text-xs font-bold text-success-ink">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="إغلاق الإشعار"
            className="rounded-lg p-1 transition-colors hover:bg-row-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-danger-line bg-danger-soft px-5 py-3.5 text-xs font-bold text-danger-ink"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 transition-colors hover:bg-row-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Saved Interactive Activities List */}
      <section className="qc-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-extrabold text-ink">
            الأنشطة التعليمية المحفوظة ({activities.length})
          </h3>
          <button
            type="button"
            onClick={() => void loadActivities()}
            className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
            <p className="mt-2.5 text-xs font-bold text-ink-muted">
              جارٍ تحميل الأنشطة التعليمية من قاعدة البيانات...
            </p>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-danger-line bg-danger-soft p-6 text-center">
            <p className="text-sm font-bold text-danger-ink">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadActivities()}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-xs font-bold text-white transition-colors hover:bg-danger-hover"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div
            data-testid="interactive-activities-empty"
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-subtle px-6 py-14 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-selected text-accent">
              <Presentation className="h-7 w-7" />
            </div>
            <h4 className="font-display mt-3 text-base font-extrabold text-ink">
              لا توجد أنشطة تعليمية محفوظة بعد
            </h4>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
              اضغط على «إنشاء نشاط تعليمي» لاختيار أسئلة حقيقية من بنك الأسئلة وتشغيلها مباشرة على السبورة الذكية.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingActivityId(null);
                setMode('builder');
              }}
              className="qc-btn-primary mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-extrabold"
            >
              <Plus className="h-4 w-4" />
              <span>إنشاء نشاط تعليمي</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activities.map((activity) => {
              const isLaunching = launchingId === activity.id;
              const isConfirmingDelete = confirmDeleteId === activity.id;
              const isDeleting = deletingId === activity.id;

              const metadataItems = [
                `${activity.questionCount} ${activity.questionCount === 1 ? 'سؤال' : 'أسئلة'}`,
                activity.subject,
                activity.grade,
                formatQuizDate(activity.updatedAt),
              ].filter((item): item is string => Boolean(item));

              return (
                <article
                  key={activity.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface-subtle p-5 transition-colors hover:border-selected-line"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display text-base font-extrabold text-ink">
                        {activity.title}
                      </h4>
                      {activity.autoFullscreen && (
                        <span
                          title="يبدأ في وضع ملء الشاشة"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent whitespace-nowrap shrink-0"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>ملء الشاشة</span>
                        </span>
                      )}
                    </div>

                    <div className="tabular-nums flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                      {metadataItems.map((meta, idx) => (
                        <span key={`${activity.id}-meta-${idx}`} className="inline-flex items-center gap-2">
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>{meta}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5">
                      <span className="text-xs font-bold text-danger-ink">
                        تأكيد حذف هذا النشاط؟
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteActivity(activity.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-danger px-3 text-xs font-bold text-white transition-colors hover:bg-danger-hover disabled:opacity-50"
                        >
                          {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="qc-btn-secondary inline-flex h-8 items-center rounded-lg px-3 text-xs font-bold"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isLaunching || activity.questionCount === 0}
                        onClick={() => void handleLaunchSavedActivity(activity.id)}
                        className="qc-btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                      >
                        {isLaunching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span>تشغيل على السبورة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingActivityId(activity.id);
                          setMode('builder');
                        }}
                        aria-label={`تعديل النشاط ${activity.title}`}
                        className="qc-btn-secondary inline-flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(activity.id)}
                        aria-label={`حذف النشاط ${activity.title}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-danger-line bg-danger-soft px-3 text-xs font-bold text-danger-ink transition-opacity hover:opacity-85"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

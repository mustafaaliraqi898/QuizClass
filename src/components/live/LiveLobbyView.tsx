import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Network,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { httpLiveSessionService } from '../../services/liveSessionService';
import { httpQuizService } from '../../services/quizService';
import type {
  LiveSessionSettings,
  LiveSessionStatus,
  LiveSessionSummary,
  TeacherLiveSessionDetails,
} from '../../types/liveSession';
import type { QuizSummary } from '../../types/quiz';
import { formatQuizDate } from '../quizzes/quizFormatters';
import { LiveBoardView } from './LiveBoardView';
import { LiveFinalResultsView } from './LiveFinalResultsView';
import { LiveSessionSettingsPanel } from './LiveSessionSettingsPanel';
import { getStudentAvatar } from '../../data/studentAvatars';

interface LiveLobbyViewProps {
  activeSession: TeacherLiveSessionDetails | null;
  onSessionUpdated: (session: TeacherLiveSessionDetails | null) => void;
  onLaunchQuiz: (quizId: string) => Promise<void>;
  onNavigateQuizzes: () => void;
  onNavigateCreateQuiz: () => void;
  onLifecycleChanged?: () => void;
}

const SESSION_STATUS_META: Record<
  LiveSessionStatus,
  { label: string; badgeClass: string }
> = {
  waiting: {
    label: 'في انتظار انضمام الطلاب',
    badgeClass:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300',
  },
  running: {
    label: 'المسابقة قيد التشغيل',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  completed: {
    label: 'مكتملة',
    badgeClass:
      'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
  cancelled: {
    label: 'ملغاة',
    badgeClass:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

export function LiveLobbyView({
  activeSession,
  onSessionUpdated,
  onLaunchQuiz,
  onNavigateQuizzes,
  onNavigateCreateQuiz,
  onLifecycleChanged,
}: LiveLobbyViewProps) {
  const [recentSessions, setRecentSessions] = useState<LiveSessionSummary[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<QuizSummary[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<'pin' | 'url' | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const onSessionUpdatedRef = useRef(onSessionUpdated);
  onSessionUpdatedRef.current = onSessionUpdated;

  const loadLobbyInitialData = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingInitial(true);
    setLoadError(null);
    try {
      const [sessionsRes, quizzesRes] = await Promise.all([
        httpLiveSessionService.listSessions({ signal }),
        httpQuizService.listQuizzes({ signal }),
      ]);
      setRecentSessions(sessionsRes.recentSessions);
      setSavedQuizzes(quizzesRes.quizzes);
      if (sessionsRes.activeSession) {
        onSessionUpdatedRef.current(sessionsRes.activeSession);
      }
    } catch (error) {
      if (signal?.aborted) return;
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات الجلسات المباشرة من قاعدة البيانات.';
      setLoadError(message);
    } finally {
      if (!signal?.aborted) {
        setIsLoadingInitial(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadLobbyInitialData(controller.signal);
    return () => controller.abort();
  }, [loadLobbyInitialData]);

  // Reset selected network interface index when session changes
  useEffect(() => {
    setSelectedNetworkIndex(0);
  }, [activeSession?.id]);

  // Real-time Socket.IO subscription for Teacher Lobby
  const sessionId = activeSession?.id ?? null;
  const hostToken = activeSession?.hostToken ?? null;
  const sessionStatus = activeSession?.status ?? null;

  useEffect(() => {
    if (!sessionId || !hostToken || (sessionStatus !== 'waiting' && sessionStatus !== 'running')) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);
      return;
    }

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    const subscribeTeacher = () => {
      socket.emit(
        'teacher:subscribe',
        { sessionId, hostToken },
        (ack: { ok: boolean; error?: string; data?: TeacherLiveSessionDetails }) => {
          if (ack?.ok && ack.data) {
            onSessionUpdatedRef.current(ack.data);
          } else if (ack && !ack.ok && ack.error) {
            setActionError(ack.error);
          }
        }
      );
    };

    socket.on('connect', () => {
      setSocketConnected(true);
      subscribeTeacher();
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('session:teacher_state', (details: TeacherLiveSessionDetails) => {
      if (details && details.id === sessionId) {
        onSessionUpdatedRef.current(details);
      }
    });

    if (socket.connected) {
      setSocketConnected(true);
      subscribeTeacher();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:teacher_state');
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [sessionId, hostToken, sessionStatus]);

  const selectedNetwork = useMemo(() => {
    if (!activeSession || activeSession.networkAddresses.length === 0) {
      return null;
    }
    return (
      activeSession.networkAddresses[selectedNetworkIndex] ??
      activeSession.networkAddresses[0]
    );
  }, [activeSession, selectedNetworkIndex]);

  const handleCopy = async (value: string, field: 'pin' | 'url') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 2000);
    } catch {
      setActionError('تعذر النسخ إلى الحافظة تلقائياً؛ يمكنك نسخ النص يدوياً.');
    }
  };

  const handleSaveSettings = async (nextSettings: LiveSessionSettings) => {
    if (!activeSession) return;
    setIsSavingSettings(true);
    setActionError(null);
    try {
      const updated = await httpLiveSessionService.updateSettings(activeSession.id, nextSettings);
      onSessionUpdated(updated);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر حفظ إعدادات الجلسة في قاعدة البيانات.'
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleStartSession = async () => {
    if (!activeSession) return;
    setIsMutating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await httpLiveSessionService.startSession(
        activeSession.id,
        activeSession.settings
      );
      onSessionUpdated(updated);
      setActionSuccess(
        'تم بدء المسابقة وتشغيل السؤال الأول وتثبيت الإعدادات وحماية الأسئلة.'
      );
      onLifecycleChanged?.();
      void loadLobbyInitialData();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر بدء الجلسة المباشرة.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!activeSession) return;
    setIsMutating(true);
    setActionError(null);
    try {
      const updated = await httpLiveSessionService.nextQuestion(activeSession.id);
      onSessionUpdated(updated);
      if (updated.status === 'completed') {
        onLifecycleChanged?.();
        void loadLobbyInitialData();
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر الانتقال إلى السؤال التالي.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setIsMutating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await httpLiveSessionService.completeSession(activeSession.id);
      onSessionUpdated(updated);
      setActionSuccess('تم إنهاء الجلسة واعتماد النتائج النهائية في قاعدة البيانات.');
      onLifecycleChanged?.();
      void loadLobbyInitialData();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر إنهاء الجلسة المباشرة.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    setIsMutating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await httpLiveSessionService.cancelSession(activeSession.id);
      onSessionUpdated(updated);
      setActionSuccess('تم إلغاء الجلسة المباشرة وإخطار الأجهزة المتصلة.');
      onLifecycleChanged?.();
      void loadLobbyInitialData();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'تعذر إلغاء الجلسة المباشرة.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoadingInitial && !activeSession) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
          جارٍ التحقق من الجلسات المباشرة في قاعدة البيانات المحلية...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-xs font-bold text-red-800 sm:flex-row sm:items-center dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadLobbyInitialData()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-xs font-bold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {activeSession ? (
        activeSession.status === 'running' ? (
          <LiveBoardView
            session={activeSession}
            socketConnected={socketConnected}
            isMutating={isMutating}
            onNextQuestion={handleNextQuestion}
            onCompleteSession={handleCompleteSession}
          />
        ) : activeSession.status === 'completed' ? (
          <LiveFinalResultsView
            session={activeSession}
            onLaunchNewSession={() => void onLaunchQuiz(activeSession.quizId)}
            onBackToQuizzes={() => {
              onSessionUpdated(null);
              onNavigateQuizzes();
            }}
          />
        ) : (
        <>
          {/* شريط عنوان الجلسة وأزرار التحكم */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                      SESSION_STATUS_META[activeSession.status].badgeClass
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>{SESSION_STATUS_META[activeSession.status].label}</span>
                  </span>

                  {activeSession.status === 'waiting' && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        socketConnected
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {socketConnected ? (
                        <>
                          <Wifi className="h-3.5 w-3.5" />
                          <span>الاتصال اللحظي نشط</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3.5 w-3.5" />
                          <span>جارٍ الاتصال بالخادم المحلي...</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  {activeSession.quizTitle}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {activeSession.quizSubject && <span>{activeSession.quizSubject}</span>}
                  {activeSession.quizSubject && activeSession.quizGrade && (
                    <span aria-hidden="true">·</span>
                  )}
                  {activeSession.quizGrade && <span>{activeSession.quizGrade}</span>}
                  {(activeSession.quizSubject || activeSession.quizGrade) && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span className="tabular-nums">
                    عدد الأسئلة المثبتة: {activeSession.questionCount} سؤالاً
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeSession.status === 'waiting' && (
                  <>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleStartSession()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    >
                      {isMutating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span>بدء المسابقة</span>
                    </button>

                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleCancelSession()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 whitespace-nowrap dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Ban className="h-4 w-4" />
                      <span>إلغاء الجلسة</span>
                    </button>
                  </>
                )}

                {activeSession.status === 'cancelled' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void onLaunchQuiz(activeSession.quizId)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 whitespace-nowrap dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>تشغيل جلسة جديدة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSessionUpdated(null);
                        onNavigateQuizzes();
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      العودة إلى المسابقات
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* شبكة تفاصيل الانضمام + قائمة الطلاب المنضمين */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* بطاقة الانضمام (PIN + QR + الشبكة المحلية) */}
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                  بيانات انضمام الطلاب
                </h3>
                <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>

              {/* رمز PIN كبير للسبورة */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 text-center dark:border-indigo-900/60 dark:bg-indigo-950/40">
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  رمز الدخول السريع (PIN)
                </p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span
                    dir="ltr"
                    className="font-display tabular-nums text-4xl font-black tracking-[0.22em] text-slate-900 sm:text-5xl dark:text-white"
                  >
                    {activeSession.pinCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy(activeSession.pinCode, 'pin')}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
                >
                  {copiedField === 'pin' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>تم نسخ الرمز</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ الرمز</span>
                    </>
                  )}
                </button>
              </div>

              {/* رمز QR المولّد محلياً */}
              {selectedNetwork && (
                <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
                    <img
                      src={selectedNetwork.qrDataUrl}
                      alt={`رمز QR للانضمام إلى المسابقة برمز ${activeSession.pinCode}`}
                      className="h-52 w-52 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                    امسح الرمز بكاميرا هاتف الطالب المتصل بنفس شبكة Wi-Fi
                  </p>

                  {/* رابط الانضمام */}
                  <div className="mt-3 w-full space-y-2">
                    <div
                      dir="ltr"
                      className="break-all rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {selectedNetwork.joinUrl}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(selectedNetwork.joinUrl, 'url')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {copiedField === 'url' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>تم نسخ الرابط</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>نسخ رابط الانضمام</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`/join?pin=${encodeURIComponent(activeSession.pinCode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>فتح شاشة الطالب</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* معلومات عنوان الشبكة المحلية وتعدد الواجهات */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Network className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>عنوان الشبكة المحلية والمنفذ</span>
                </div>

                {selectedNetwork && (
                  <p
                    dir="ltr"
                    className="tabular-nums mt-1.5 font-mono text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    {selectedNetwork.ip}:{selectedNetwork.port} ({selectedNetwork.label})
                  </p>
                )}

                {activeSession.networkAddresses.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    <label
                      htmlFor="live-network-interface-select"
                      className="block text-xs font-bold text-slate-600 dark:text-slate-400"
                    >
                      تبديل واجهة الشبكة لرمز QR والرابط:
                    </label>
                    <select
                      id="live-network-interface-select"
                      value={selectedNetworkIndex}
                      onChange={(e) => setSelectedNetworkIndex(Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {activeSession.networkAddresses.map((net, idx) => (
                        <option key={`${net.interfaceName}-${net.ip}`} value={idx}>
                          {net.ip}:{net.port} — {net.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* قائمة الطلاب المشاركين لحظياً */}
            <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                      الطلاب المنضمون
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تتحدث القائمة تلقائياً فور انضمام أو انقطاع أي طالب
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">الإجمالي: </span>
                    <span className="tabular-nums text-slate-900 dark:text-white">
                      {activeSession.participantCount}
                    </span>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                    <span className="text-emerald-700 dark:text-emerald-300">المتصلون الآن: </span>
                    <span className="tabular-nums text-emerald-900 dark:text-emerald-200">
                      {activeSession.connectedParticipantCount}
                    </span>
                  </div>
                </div>
              </div>

              {activeSession.participants.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <Users className="h-7 w-7" />
                  </div>
                  <h4 className="font-display mt-4 text-base font-bold text-slate-900 dark:text-white">
                    في انتظار انضمام أول طالب...
                  </h4>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    اطلب من الطلاب مسح رمز QR الظاهر على الشاشة أو فتح رابط الانضمام وإدخال
                    الرمز{' '}
                    <span className="tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                      {activeSession.pinCode}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeSession.participants.map((participant, index) => {
                    const isOnline = participant.connectionStatus === 'connected';
                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                          isOnline
                            ? 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50'
                            : 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {(() => {
                            const avatar = getStudentAvatar(participant.avatarId);
                            return (
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${avatar.bgClass}`}>
                                {avatar.emoji}
                              </span>
                            );
                          })()}
                          <div className="min-w-0">
                            <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                              {participant.displayName}
                            </p>
                            <p className="tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                              انضم{' '}
                              {new Date(participant.joinedAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            isOnline
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>{isOnline ? 'متصل' : 'منقطع'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {activeSession.status === 'waiting' && (
            <LiveSessionSettingsPanel
              settings={activeSession.settings}
              disabled={isMutating}
              isSaving={isSavingSettings}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </>
        )
      ) : (
        /* حالة عدم وجود جلسة نشطة */
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <Radio className="h-7 w-7" />
            </div>
            <h2 className="font-display mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
              لا توجد جلسة مباشرة نشطة حالياً
            </h2>
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              اختر إحدى المسابقات المحفوظة أدناه لتوليد رمز PIN ورمز QR فوري والبدء باستقبال
              الطلاب عبر شبكة Wi-Fi المحلية دون إنترنت.
            </p>
          </div>

          {savedQuizzes.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
              <ClipboardList className="h-7 w-7 text-slate-400" />
              <p className="mt-3 font-display text-sm font-bold text-slate-900 dark:text-white">
                لا توجد مسابقات محفوظة بعد
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                أنشئ مسابقة أولاً من بنك الأسئلة لتتمكن من تشغيلها مباشرة داخل الصف.
              </p>
              <button
                type="button"
                onClick={onNavigateCreateQuiz}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                <Plus className="h-4 w-4" />
                <span>إنشاء مسابقة جديدة</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-6 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  مسابقات جاهزة للتشغيل المباشر
                </h3>
                <button
                  type="button"
                  onClick={onNavigateQuizzes}
                  className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  عرض جميع المسابقات
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {savedQuizzes.slice(0, 6).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                        {quiz.title}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {quiz.questionCount} سؤالاً
                        {quiz.subject ? ` · ${quiz.subject}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onLaunchQuiz(quiz.id)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>تشغيل مباشر</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* سجل الجلسات المباشرة السابقة */}
      {recentSessions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
            سجل الجلسات المباشرة
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            الجلسات المحفوظة فعلياً في قاعدة البيانات المحلية
          </p>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {recentSessions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                    {item.quizTitle}
                  </p>
                  <p className="tabular-nums mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    رمز {item.pinCode} · {item.participantCount} مشاركاً ·{' '}
                    {formatQuizDate(item.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                      SESSION_STATUS_META[item.status].badgeClass
                    }`}
                  >
                    {SESSION_STATUS_META[item.status].label}
                  </span>

                  {(item.status === 'waiting' || item.status === 'running' || item.status === 'completed') &&
                    activeSession?.id !== item.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const full = await httpLiveSessionService.getSessionById(item.id);
                            onSessionUpdated(full);
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'تعذر فتح الجلسة.'
                            );
                          }
                        }}
                        className="h-8 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        {item.status === 'completed' ? 'عرض النتائج' : 'فتح الغرفة'}
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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
    badgeClass: 'border-warning-line bg-warning-soft text-warning-ink',
  },
  running: {
    label: 'المسابقة قيد التشغيل',
    badgeClass: 'border-success-line bg-success-soft text-success-ink',
  },
  completed: {
    label: 'مكتملة',
    badgeClass: 'border-selected-line bg-selected text-accent',
  },
  cancelled: {
    label: 'ملغاة',
    badgeClass: 'border-line bg-surface-subtle text-ink-muted',
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
      <div className="qc-card flex flex-col items-center justify-center px-6 py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="mt-3 text-xs font-bold text-ink-muted">
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
          className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-danger-line bg-danger-soft p-5 text-xs font-bold text-danger-ink sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadLobbyInitialData()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-danger px-3 text-xs font-bold text-white transition-colors hover:bg-danger-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>إعادة المحاولة</span>
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
            className="rounded-lg p-1 hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-success-line bg-success-soft px-5 py-3.5 text-xs font-bold text-success-ink"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-ink/5"
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
          <section className="qc-card p-6">
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
                        socketConnected ? 'text-success-ink' : 'text-warning-ink'
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

                <h2 className="font-display text-2xl font-extrabold text-ink">
                  {activeSession.quizTitle}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
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
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-success px-5 text-sm font-bold text-white transition-colors hover:bg-success-hover disabled:opacity-60 whitespace-nowrap"
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
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 text-xs font-bold text-danger-ink transition-colors hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
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
                      className="qc-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold whitespace-nowrap"
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
                      className="qc-btn-secondary inline-flex h-11 items-center justify-center rounded-xl px-4 text-xs font-bold whitespace-nowrap"
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
            <section className="qc-card space-y-5 p-6 lg:col-span-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">
                  بيانات انضمام الطلاب
                </h3>
                <QrCode className="h-5 w-5 text-accent" />
              </div>

              {/* رمز PIN كبير للسبورة */}
              <div className="rounded-2xl border border-selected-line bg-selected p-5 text-center">
                <p className="text-xs font-bold text-accent">
                  رمز الدخول السريع (PIN)
                </p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span
                    dir="ltr"
                    className="font-display tabular-nums text-4xl font-black tracking-[0.22em] text-ink sm:text-5xl"
                  >
                    {activeSession.pinCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy(activeSession.pinCode, 'pin')}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-selected-line bg-surface px-3 text-xs font-bold text-accent transition-colors hover:bg-row-hover"
                >
                  {copiedField === 'pin' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
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
                <div className="flex flex-col items-center rounded-2xl border border-line bg-surface-subtle p-5 text-center">
                  <div className="overflow-hidden rounded-xl border border-line bg-white p-2 shadow-xs">
                    <img
                      src={selectedNetwork.qrDataUrl}
                      alt={`رمز QR للانضمام إلى المسابقة برمز ${activeSession.pinCode}`}
                      className="h-52 w-52 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-xs font-bold text-ink-muted">
                    امسح الرمز بكاميرا هاتف الطالب المتصل بنفس شبكة Wi-Fi
                  </p>

                  {/* رابط الانضمام */}
                  <div className="mt-3 w-full space-y-2">
                    <div
                      dir="ltr"
                      className="break-all rounded-xl border border-line bg-surface px-3 py-2 text-center font-mono text-xs text-ink"
                    >
                      {selectedNetwork.joinUrl}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(selectedNetwork.joinUrl, 'url')}
                        className="qc-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                      >
                        {copiedField === 'url' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-success" />
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
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-selected-line bg-selected px-3 text-xs font-bold text-accent transition-colors hover:opacity-90"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>فتح شاشة الطالب</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* معلومات عنوان الشبكة المحلية وتعدد الواجهات */}
              <div className="rounded-xl border border-line bg-surface-subtle p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Network className="h-4 w-4 text-accent" />
                  <span>عنوان الشبكة المحلية والمنفذ</span>
                </div>

                {selectedNetwork && (
                  <p
                    dir="ltr"
                    className="tabular-nums mt-1.5 font-mono text-xs font-bold text-ink-muted"
                  >
                    {selectedNetwork.ip}:{selectedNetwork.port} ({selectedNetwork.label})
                  </p>
                )}

                {activeSession.networkAddresses.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    <label
                      htmlFor="live-network-interface-select"
                      className="block text-xs font-bold text-ink-muted"
                    >
                      تبديل واجهة الشبكة لرمز QR والرابط:
                    </label>
                    <select
                      id="live-network-interface-select"
                      value={selectedNetworkIndex}
                      onChange={(e) => setSelectedNetworkIndex(Number(e.target.value))}
                      className="qc-input h-9 w-full rounded-lg px-2.5 text-xs font-semibold"
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
            <section className="qc-card flex flex-col p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-selected text-accent">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-ink">
                      الطلاب المنضمون
                    </h3>
                    <p className="text-xs text-ink-muted">
                      تتحدث القائمة تلقائياً فور انضمام أو انقطاع أي طالب
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="rounded-xl border border-line bg-surface-subtle px-3 py-1.5">
                    <span className="text-ink-muted">الإجمالي: </span>
                    <span className="tabular-nums text-ink">
                      {activeSession.participantCount}
                    </span>
                  </div>
                  <div className="rounded-xl border border-success-line bg-success-soft px-3 py-1.5">
                    <span className="text-success-ink">المتصلون الآن: </span>
                    <span className="tabular-nums text-success-ink">
                      {activeSession.connectedParticipantCount}
                    </span>
                  </div>
                </div>
              </div>

              {activeSession.participants.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-ink-muted">
                    <Users className="h-7 w-7" />
                  </div>
                  <h4 className="font-display mt-4 text-base font-bold text-ink">
                    في انتظار انضمام أول طالب...
                  </h4>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
                    اطلب من الطلاب مسح رمز QR الظاهر على الشاشة أو فتح رابط الانضمام وإدخال
                    الرمز{' '}
                    <span className="tabular-nums font-bold text-accent">
                      {activeSession.pinCode}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeSession.participants.map((participant) => {
                    const isOnline = participant.connectionStatus === 'connected';
                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                          isOnline
                            ? 'border-line bg-surface-subtle'
                            : 'border-warning-line bg-warning-soft'
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
                            <p className="truncate font-display text-sm font-bold text-ink">
                              {participant.displayName}
                            </p>
                            <p className="tabular-nums text-[11px] text-ink-muted">
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
                              ? 'bg-success-soft text-success-ink'
                              : 'bg-warning-soft text-warning-ink'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOnline ? 'bg-success' : 'bg-warning'
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
        <section className="qc-card p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-selected text-accent">
              <Radio className="h-7 w-7" />
            </div>
            <h2 className="font-display mt-4 text-xl font-extrabold text-ink">
              لا توجد جلسة مباشرة نشطة حالياً
            </h2>
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-ink-muted sm:text-sm">
              اختر إحدى المسابقات المحفوظة أدناه لتوليد رمز PIN ورمز QR فوري والبدء باستقبال
              الطلاب عبر شبكة Wi-Fi المحلية دون إنترنت.
            </p>
          </div>

          {savedQuizzes.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-subtle px-6 py-10 text-center">
              <ClipboardList className="h-7 w-7 text-ink-muted" />
              <p className="mt-3 font-display text-sm font-bold text-ink">
                لا توجد مسابقات محفوظة بعد
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                أنشئ مسابقة أولاً من بنك الأسئلة لتتمكن من تشغيلها مباشرة داخل الصف.
              </p>
              <button
                type="button"
                onClick={onNavigateCreateQuiz}
                className="qc-btn-primary mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                <span>إنشاء مسابقة جديدة</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3 border-t border-line pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-ink">
                  مسابقات جاهزة للتشغيل المباشر
                </h3>
                <button
                  type="button"
                  onClick={onNavigateQuizzes}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  عرض جميع المسابقات
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {savedQuizzes.slice(0, 6).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-subtle p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-ink">
                        {quiz.title}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-ink-muted">
                        {quiz.questionCount} سؤالاً
                        {quiz.subject ? ` · ${quiz.subject}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onLaunchQuiz(quiz.id)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-success px-3.5 text-xs font-bold text-white transition-colors hover:bg-success-hover"
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
        <section className="qc-card p-6">
          <h3 className="font-display text-base font-extrabold text-ink">
            سجل الجلسات المباشرة
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            الجلسات المحفوظة فعلياً في قاعدة البيانات المحلية
          </p>

          <div className="mt-4 divide-y divide-line">
            {recentSessions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-ink">
                    {item.quizTitle}
                  </p>
                  <p className="tabular-nums mt-0.5 text-xs text-ink-muted">
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
                        className="h-8 rounded-lg border border-selected-line bg-selected px-2.5 text-xs font-bold text-accent transition-colors hover:opacity-90"
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

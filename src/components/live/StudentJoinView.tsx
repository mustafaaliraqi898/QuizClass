import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Radio,
  RefreshCw,
  Sun,
  Trophy,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useServerSyncedCountdown } from '../../hooks/useServerSyncedCountdown';
import { httpLiveSessionService } from '../../services/liveSessionService';
import type { ThemeMode } from '../../types/dashboard';
import type {
  StudentLiveSessionState,
  StudentPublicSessionInfo,
  StudentSubmitAnswerResponse,
} from '../../types/liveSession';
import { QuizClassLogo } from '../brand/QuizClassLogo';
import { getStudentAvatar, STUDENT_AVATARS } from '../../data/studentAvatars';
import { StudentAnswerFeedbackBanner } from './StudentAnswerFeedbackBanner';
import {
  buildStudentFeedbackBannerData,
  shouldDisplayFeedbackBanner,
  type StudentFeedbackBannerData,
} from './studentFeedbackLogic';

interface StudentJoinViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

interface StoredStudentSession {
  sessionId: string;
  participantId: string;
  reconnectToken: string;
  pinCode: string;
  displayName: string;
  joinedAt: string;
}

const STUDENT_STORAGE_KEY = 'quizclass_student_session_v1';
const SHOWN_FEEDBACK_KEYS_STORAGE = 'quizclass_shown_feedback_keys_v1';
const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function readShownFeedbackKeys(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(SHOWN_FEEDBACK_KEYS_STORAGE);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function persistShownFeedbackKey(shownSet: Set<string>, dedupKey: string): void {
  shownSet.add(dedupKey);
  try {
    const recent = Array.from(shownSet).slice(-100);
    window.sessionStorage.setItem(SHOWN_FEEDBACK_KEYS_STORAGE, JSON.stringify(recent));
  } catch {
    // Ignore storage quota/privacy restrictions
  }
}

function normalizePinDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .slice(0, 6);
}

function readStoredStudentSession(): StoredStudentSession | null {
  try {
    const raw =
      window.sessionStorage.getItem(STUDENT_STORAGE_KEY) ||
      window.localStorage.getItem(STUDENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredStudentSession>;
    if (
      parsed &&
      typeof parsed.sessionId === 'string' &&
      typeof parsed.participantId === 'string' &&
      typeof parsed.reconnectToken === 'string' &&
      typeof parsed.pinCode === 'string' &&
      typeof parsed.displayName === 'string'
    ) {
      return {
        sessionId: parsed.sessionId,
        participantId: parsed.participantId,
        reconnectToken: parsed.reconnectToken,
        pinCode: parsed.pinCode,
        displayName: parsed.displayName,
        joinedAt: typeof parsed.joinedAt === 'string' ? parsed.joinedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredStudentSession(value: StoredStudentSession | null): void {
  try {
    if (!value) {
      window.sessionStorage.removeItem(STUDENT_STORAGE_KEY);
      window.localStorage.removeItem(STUDENT_STORAGE_KEY);
      return;
    }
    const serialized = JSON.stringify(value);
    window.sessionStorage.setItem(STUDENT_STORAGE_KEY, serialized);
    window.localStorage.setItem(STUDENT_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota/privacy restrictions
  }
}

export function StudentJoinView({ theme, onToggleTheme }: StudentJoinViewProps) {
  const initialUrlPin = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizePinDigits(params.get('pin') ?? '');
  }, []);

  const [pinCode, setPinCode] = useState(initialUrlPin);
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar_cat');
  const [previewSession, setPreviewSession] = useState<StudentPublicSessionInfo | null>(null);
  const [isLookingUpPin, setIsLookingUpPin] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [joinedCredentials, setJoinedCredentials] = useState<StoredStudentSession | null>(null);
  const [liveState, setLiveState] = useState<StudentLiveSessionState | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<StudentFeedbackBannerData | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const shownFeedbackKeysRef = useRef<Set<string> | null>(null);
  if (!shownFeedbackKeysRef.current) {
    shownFeedbackKeysRef.current = readShownFeedbackKeys();
  }

  const session = liveState?.session ?? null;
  const { remainingSeconds, progressPercent } = useServerSyncedCountdown(
    session?.phaseStartedAt ?? null,
    session?.phaseEndsAt ?? null,
    session?.phaseDurationMs ?? null,
    session?.remainingMs ?? null
  );

  // محاولة استعادة جلسة الطالب عند تحديث الصفحة أو إعادة فتح الرابط دون إنشاء مشارك مكرر
  useEffect(() => {
    const stored = readStoredStudentSession();
    if (!stored) {
      setIsRestoringSession(false);
      return;
    }

    if (initialUrlPin && initialUrlPin !== stored.pinCode) {
      setIsRestoringSession(false);
      return;
    }

    let cancelled = false;
    setDisplayName(stored.displayName);
    setPinCode(stored.pinCode);

    httpLiveSessionService
      .joinSession({
        pinCode: stored.pinCode,
        displayName: stored.displayName,
        existingParticipantId: stored.participantId,
        reconnectToken: stored.reconnectToken,
      })
      .then((res) => {
        if (cancelled) return;
        const nextCreds: StoredStudentSession = {
          sessionId: res.session.sessionId,
          participantId: res.participant.id,
          reconnectToken: res.reconnectToken,
          pinCode: res.session.pinCode,
          displayName: res.participant.displayName,
          joinedAt: res.participant.joinedAt,
        };
        writeStoredStudentSession(nextCreds);
        setJoinedCredentials(nextCreds);
        if (res.liveState) {
          setLiveState(res.liveState);
        }
      })
      .catch(() => {
        if (!cancelled) {
          writeStoredStudentSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialUrlPin]);

  // التحقق الفوري من رمز PIN بمجرد إدخال 6 أرقام
  useEffect(() => {
    if (joinedCredentials) return;

    if (pinCode.length !== 6) {
      setPreviewSession(null);
      setLookupError(null);
      setIsLookingUpPin(false);
      return;
    }

    const controller = new AbortController();
    setIsLookingUpPin(true);
    setLookupError(null);

    httpLiveSessionService
      .lookupPublicSession(pinCode, { signal: controller.signal })
      .then((found) => {
        setPreviewSession(found);
        setLookupError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPreviewSession(null);
        setLookupError(
          error instanceof Error ? error.message : 'تعذر العثور على جلسة بهذا الرمز.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLookingUpPin(false);
        }
      });

    return () => controller.abort();
  }, [pinCode, joinedCredentials]);

  // مسح تنبيهات الإجابة المؤقتة عند الانتقال لسؤال أو مرحلة جديدة
  useEffect(() => {
    setAnswerError(null);
    if (session?.currentPhase !== 'answering') {
      setAnswerFeedback(null);
    }
  }, [session?.currentQuestionIndex, session?.currentPhase]);

  // مزامنة شريط التغذية الراجعة المتحرك حصراً مع مرحلة question_results ومنع التكرار أو التسريب
  useEffect(() => {
    if (
      !liveState ||
      liveState.session.status !== 'running' ||
      liveState.session.currentPhase !== 'question_results'
    ) {
      setActiveFeedback(null);
      return;
    }

    const candidate = buildStudentFeedbackBannerData(liveState);
    const shownKeys = shownFeedbackKeysRef.current!;
    if (shouldDisplayFeedbackBanner(candidate, shownKeys, liveState.session.remainingMs)) {
      persistShownFeedbackKey(shownKeys, candidate.dedupKey);
      setActiveFeedback(candidate);
    }
  }, [liveState]);

  const handleFeedbackDismissed = useCallback((dedupKey: string) => {
    setActiveFeedback((prev) => (prev?.dedupKey === dedupKey ? null : prev));
  }, []);

  // اتصال Socket.IO الفوري للطالب بعد الانضمام
  useEffect(() => {
    if (!joinedCredentials) {
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

    const subscribeStudent = () => {
      socket.emit(
        'student:subscribe',
        {
          sessionId: joinedCredentials.sessionId,
          participantId: joinedCredentials.participantId,
          reconnectToken: joinedCredentials.reconnectToken,
        },
        (ack: { ok: boolean; error?: string; data?: StudentLiveSessionState }) => {
          if (ack?.ok && ack.data) {
            setLiveState(ack.data);
          } else if (ack && !ack.ok && ack.error) {
            setJoinError(ack.error);
          }
        }
      );
    };

    socket.on('connect', () => {
      setSocketConnected(true);
      subscribeStudent();
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('session:student_state', (payload: StudentLiveSessionState) => {
      if (payload?.session) {
        setLiveState(payload);
      }
    });

    socket.on('session:student_status', (payload: { session: StudentPublicSessionInfo }) => {
      if (payload?.session) {
        setLiveState((prev) => (prev ? { ...prev, session: payload.session } : prev));
        if (payload.session.status === 'cancelled') {
          writeStoredStudentSession(null);
        }
      }
    });

    if (socket.connected) {
      setSocketConnected(true);
      subscribeStudent();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:student_state');
      socket.off('session:student_status');
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [joinedCredentials]);

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    if (pinCode.length !== 6) {
      setJoinError('يرجى إدخال رمز الجلسة المكوّن من 6 أرقام.');
      return;
    }

    const cleanedName = displayName.replace(/\s+/g, ' ').trim();
    if (cleanedName.length < 2) {
      setJoinError('يرجى كتابة اسمك الكامل أو اسمك الأول (حرفان على الأقل).');
      return;
    }

    setIsJoining(true);
    try {
      const response = await httpLiveSessionService.joinSession({
        pinCode,
        displayName: cleanedName,
        avatarId: selectedAvatarId,
      });

      const creds: StoredStudentSession = {
        sessionId: response.session.sessionId,
        participantId: response.participant.id,
        reconnectToken: response.reconnectToken,
        pinCode: response.session.pinCode,
        displayName: response.participant.displayName,
        joinedAt: response.participant.joinedAt,
      };
      writeStoredStudentSession(creds);
      setJoinedCredentials(creds);
      if (response.liveState) {
        setLiveState(response.liveState);
      }
      setJoinError(null);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : 'تعذر الانضمام إلى الجلسة حالياً.'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleSubmitChoice = async (choice: {
    selectedOptionId?: string | null;
    selectedBoolean?: boolean | null;
  }) => {
    if (!joinedCredentials || !liveState?.currentQuestion || !session) return;
    if (session.currentPhase !== 'answering' || remainingSeconds <= 0) return;

    const alreadyAnswered = Boolean(liveState.myAnswer);
    if (alreadyAnswered && !session.settings.allowAnswerChange) {
      return;
    }

    setIsSubmittingAnswer(true);
    setAnswerError(null);

    const payload = {
      sessionId: joinedCredentials.sessionId,
      participantId: joinedCredentials.participantId,
      reconnectToken: joinedCredentials.reconnectToken,
      sessionQuestionId: liveState.currentQuestion.id,
      selectedOptionId: choice.selectedOptionId ?? null,
      selectedBoolean:
        typeof choice.selectedBoolean === 'boolean' ? choice.selectedBoolean : null,
    };

    const applySuccess = (res: StudentSubmitAnswerResponse) => {
      setLiveState((prev) =>
        prev
          ? {
              ...prev,
              myAnswer: res.answer,
            }
          : prev
      );
      setAnswerFeedback(res.updated ? 'تم تحديث إجابتك واستلامها بنجاح.' : 'تم استلام إجابتك بنجاح!');
    };

    try {
      if (socketRef.current?.connected) {
        const ackRes = await new Promise<StudentSubmitAnswerResponse>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(new Error('انتهت مهلة إرسال الإجابة عبر الاتصال اللحظي.'));
          }, 4000);

          socketRef.current!.emit(
            'student:submit_answer',
            payload,
            (ack: { ok: boolean; error?: string; data?: StudentSubmitAnswerResponse }) => {
              window.clearTimeout(timer);
              if (ack?.ok && ack.data) {
                resolve(ack.data);
              } else {
                reject(new Error(ack?.error || 'تعذر تسجيل إجابتك.'));
              }
            }
          );
        });
        applySuccess(ackRes);
      } else {
        const httpRes = await httpLiveSessionService.submitAnswer(payload);
        applySuccess(httpRes);
      }
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : 'تعذر تسجيل إجابتك حالياً.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleLeaveSession = () => {
    writeStoredStudentSession(null);
    setJoinedCredentials(null);
    setLiveState(null);
    setJoinError(null);
    setAnswerError(null);
    setAnswerFeedback(null);
    setActiveFeedback(null);
    setDisplayName('');
  };

  const activeStatus = session?.status ?? 'waiting';
  const currentPhase = session?.currentPhase ?? 'lobby';
  const currentQuestion = liveState?.currentQuestion ?? null;
  const myAnswer = liveState?.myAnswer ?? null;
  const questionResult = liveState?.questionResult ?? null;
  const finalSummary = liveState?.finalSummary ?? null;
  const questionNumber = session ? Math.max(1, session.currentQuestionIndex + 1) : 1;
  const isLastQuestion = session ? questionNumber >= session.questionCount : false;

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-150">
      <StudentAnswerFeedbackBanner
        banner={activeFeedback}
        onDismissed={handleFeedbackDismissed}
      />

      {/* شريط علوي مبسط للهواتف */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
          <QuizClassLogo />

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            className="qc-btn-secondary flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-6">
        {isRestoringSession ? (
          <div className="qc-card flex flex-col items-center justify-center px-6 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="mt-3 text-xs font-bold text-ink-muted">
              جارٍ التحقق من اتصالك بالمسابقة...
            </p>
          </div>
        ) : joinedCredentials && liveState && session ? (
          <section className="qc-card space-y-4 p-5">
            {/* شريط حالة الاتصال والرمز */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                  socketConnected
                    ? 'border-success-line bg-success-soft text-success-ink'
                    : 'border-warning-line bg-warning-soft text-warning-ink'
                }`}
              >
                {socketConnected ? (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>متصل</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>انقطاع مؤقت — جارٍ إعادة الاتصال...</span>
                  </>
                )}
              </span>

              <span className="tabular-nums text-xs font-bold text-ink-muted">
                رمز {session.pinCode}
              </span>
            </div>

            {/* بطاقة تعريف الطالب والمسابقة */}
            <div className="rounded-2xl border border-line bg-surface-subtle p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold text-accent">
                  <span className="text-xl">{getStudentAvatar(liveState.participant.avatarId).emoji}</span>
                  <span>{liveState.participant.displayName}</span>
                </span>
                <span className="tabular-nums rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-extrabold text-ink">
                  {liveState.participant.totalScore} نقطة
                </span>
              </div>
              <p className="mt-1.5 truncate font-display text-sm font-extrabold text-ink">
                {session.quizTitle}
              </p>
            </div>

            {/* 1. انتظار بدء المسابقة */}
            {activeStatus === 'waiting' && (
              <div className="rounded-2xl border border-success-line bg-success-soft p-5 text-center">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-sm ${getStudentAvatar(liveState.participant.avatarId).bgClass}`}>
                  <span>{getStudentAvatar(liveState.participant.avatarId).emoji}</span>
                </div>
                <h2 className="font-display mt-3 text-base font-extrabold text-success-ink">
                  تم الانضمام بنجاح!
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-success-ink opacity-90">
                  اسمك ظاهر الآن على شاشة المعلم. استعد لبداية المسابقة.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-success-line bg-surface px-3 py-1.5 text-xs font-bold text-success-ink">
                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                  <span>في انتظار بدء المعلم...</span>
                </div>
              </div>
            )}

            {/* 2. عرض السؤال دون الاختيارات */}
            {activeStatus === 'running' && currentPhase === 'question_intro' && currentQuestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="tabular-nums text-accent">
                    السؤال {questionNumber} من {session.questionCount}
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1 rounded-lg border border-warning-line bg-warning-soft px-2.5 py-1 text-warning-ink">
                    <Clock className="h-3.5 w-3.5" />
                    <span>تظهر الاختيارات خلال {remainingSeconds} ث</span>
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-warning transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="rounded-2xl border border-line bg-surface-subtle p-5 text-center">
                  <h2 className="font-display text-lg leading-relaxed font-extrabold text-ink">
                    {currentQuestion.prompt}
                  </h2>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt="صورة السؤال"
                      className="mx-auto mt-4 max-h-48 rounded-xl border border-line object-contain"
                    />
                  )}
                </div>

                <div className="rounded-xl border border-warning-line bg-warning-soft p-3.5 text-center text-xs font-bold text-warning-ink">
                  اقرأ السؤال بتركيز — ستظهر أزرار الإجابة فور انتهاء العد التمهيدي.
                </div>
              </div>
            )}

            {/* 3 و4 و5. عرض السؤال والاختيارات + استلام الإجابة + انتهاء الوقت */}
            {activeStatus === 'running' && currentPhase === 'answering' && currentQuestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="tabular-nums text-accent">
                    السؤال {questionNumber} من {session.questionCount}
                  </span>
                  <span
                    className={`tabular-nums inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-extrabold ${
                      remainingSeconds <= 5
                        ? 'border-danger-line bg-danger-soft text-danger-ink'
                        : 'border-selected-line bg-selected text-accent'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{remainingSeconds} ثانية</span>
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      remainingSeconds <= 5 ? 'bg-danger' : 'bg-primary'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="rounded-2xl border border-line bg-surface-subtle p-4 text-center">
                  <h2 className="font-display text-base leading-relaxed font-extrabold text-ink">
                    {currentQuestion.prompt}
                  </h2>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt="صورة السؤال"
                      className="mx-auto mt-3 max-h-44 rounded-xl border border-line object-contain"
                    />
                  )}
                </div>

                {/* حالة انتهاء الوقت قبل وصول بث النتائج */}
                {remainingSeconds <= 0 && (
                  <div className="rounded-xl border border-line bg-surface-subtle p-4 text-center text-xs font-bold text-ink">
                    انتهى وقت الإجابة — جارٍ احتساب النتائج...
                  </div>
                )}

                {/* حالة تأكيد استلام الإجابة */}
                {myAnswer && (
                  <div className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-xs font-bold text-success-ink">
                    {session.settings.allowAnswerChange ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 text-success" />
                    )}
                    <span>
                      {answerFeedback ??
                        (session.settings.allowAnswerChange
                          ? 'تم استلام إجابتك — يمكنك اختيار إجابة أخرى قبل انتهاء الوقت.'
                          : 'تم استلام وتثبيت إجابتك. بانتظار انتهاء الوقت...')}
                    </span>
                  </div>
                )}

                {answerError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-xs font-bold text-danger-ink"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{answerError}</span>
                  </div>
                )}

                {/* أزرار الإجابات الكبيرة المناسبة للمس */}
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = myAnswer?.selectedOptionId === opt.id;
                      const isLocked =
                        isSubmittingAnswer ||
                        remainingSeconds <= 0 ||
                        (Boolean(myAnswer) && !session.settings.allowAnswerChange);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => void handleSubmitChoice({ selectedOptionId: opt.id })}
                          className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-start transition-all active:scale-[0.99] disabled:cursor-not-allowed ${
                            isSelected
                              ? 'border-primary bg-selected text-ink ring-2 ring-primary/25'
                              : 'border-line bg-surface text-ink hover:border-selected-line hover:bg-row-hover disabled:opacity-65'
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-black ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-surface-subtle text-ink-muted'
                            }`}
                          >
                            {OPTION_LETTERS[idx] ?? idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {opt.optionText && (
                              <span className="block font-display text-sm font-extrabold sm:text-base">
                                {opt.optionText}
                              </span>
                            )}
                            {opt.imageUrl && (
                              <img
                                src={opt.imageUrl}
                                alt={`اختيار ${idx + 1}`}
                                className="mt-2 max-h-24 rounded-lg border border-line bg-surface object-contain"
                              />
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: true, label: 'صح' },
                      { value: false, label: 'خطأ' },
                    ].map((tf) => {
                      const isSelected = myAnswer?.selectedBoolean === tf.value;
                      const isLocked =
                        isSubmittingAnswer ||
                        remainingSeconds <= 0 ||
                        (Boolean(myAnswer) && !session.settings.allowAnswerChange);
                      return (
                        <button
                          key={String(tf.value)}
                          type="button"
                          disabled={isLocked}
                          onClick={() => void handleSubmitChoice({ selectedBoolean: tf.value })}
                          className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 font-display text-lg font-extrabold transition-all active:scale-[0.99] disabled:cursor-not-allowed ${
                            isSelected
                              ? 'border-primary bg-selected text-ink ring-2 ring-primary/25'
                              : tf.value
                                ? 'border-success-line bg-success-soft text-success-ink hover:border-success disabled:opacity-65'
                                : 'border-danger-line bg-danger-soft text-danger-ink hover:border-danger disabled:opacity-65'
                          }`}
                        >
                          {tf.value ? (
                            <CheckCircle2 className="h-6 w-6 text-success" />
                          ) : (
                            <XCircle className="h-6 w-6 text-danger" />
                          )}
                          <span>{tf.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 6 و7. مرحلة نتيجة السؤال للطالب (تعتمد على الشريط المتحرك المنبثق + انتظار السؤال التالي) */}
            {activeStatus === 'running' && currentPhase === 'question_results' && questionResult && (
              <div className="space-y-4">
                {questionResult.joinedMidResult ? (
                  <div className="rounded-2xl border border-selected-line bg-selected p-5 text-center">
                    <Clock className="mx-auto h-7 w-7 text-accent" />
                    <h2 className="font-display mt-2 text-base font-extrabold text-ink">
                      أهلاً بك في المسابقة!
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      انتهى السؤال السابق قبل انضمامك؛ ستبدأ المشاركة الفعلية من السؤال التالي مباشرة.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-surface-subtle p-4 text-center">
                    <p className="text-[11px] font-bold text-accent">
                      السؤال {questionNumber} من {session.questionCount}
                    </p>
                    <h2 className="font-display mt-1 text-sm font-extrabold text-ink">
                      {questionResult.prompt}
                    </h2>
                  </div>
                )}

                {/* الرصيد والترتيب الحالي + حالة انتظار السؤال التالي */}
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle px-4 py-3 text-xs font-bold">
                  <span>
                    مجموعك:{' '}
                    <span className="tabular-nums font-black text-accent">
                      {liveState.participant.totalScore}
                    </span>
                  </span>
                  {liveState.participant.rankPosition && (
                    <span>
                      ترتيبك الحالي:{' '}
                      <span className="tabular-nums font-black text-ink">
                        #{liveState.participant.rankPosition}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl border border-selected-line bg-selected px-4 py-3 text-xs font-bold text-accent">
                  <Clock className="h-4 w-4 animate-pulse" />
                  <span>
                    {session.settings.advanceMode === 'auto'
                      ? isLastQuestion
                        ? `عرض النتائج النهائية خلال ${remainingSeconds} ثوانٍ...`
                        : `السؤال التالي خلال ${remainingSeconds} ثوانٍ...`
                      : 'في انتظار انتقال المعلم إلى السؤال التالي...'}
                  </span>
                </div>
              </div>
            )}

            {/* 8. انتهاء المسابقة والنتائج النهائية */}
            {(activeStatus === 'completed' || currentPhase === 'final_results') && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-selected-line bg-selected p-5 text-center">
                  <Trophy className="mx-auto h-9 w-9 text-warning" />
                  <h2 className="font-display mt-2 text-lg font-extrabold text-ink">
                    انتهت المسابقة!
                  </h2>

                  {finalSummary?.mySummary ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-line bg-surface p-3">
                          <p className="text-[11px] font-bold text-ink-muted">
                            المركز النهائي
                          </p>
                          <p className="tabular-nums font-display mt-1 text-2xl font-black text-accent">
                            #{finalSummary.mySummary.rankPosition}
                          </p>
                        </div>
                        <div className="rounded-xl border border-line bg-surface p-3">
                          <p className="text-[11px] font-bold text-ink-muted">
                            مجموع النقاط
                          </p>
                          <p className="tabular-nums font-display mt-1 text-2xl font-black text-ink">
                            {finalSummary.mySummary.totalScore}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-center gap-4 text-xs font-bold">
                        <span className="tabular-nums text-success-ink">
                          صحيح: {finalSummary.mySummary.correctCount}
                        </span>
                        <span className="tabular-nums text-danger-ink">
                          خطأ: {finalSummary.mySummary.wrongCount}
                        </span>
                        <span className="tabular-nums text-ink-muted">
                          لم يجب: {finalSummary.mySummary.unansweredCount}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1.5 text-xs text-ink-muted">
                      شكراً لمشاركتك يا {liveState.participant.displayName}!
                    </p>
                  )}
                </div>

                {finalSummary && finalSummary.leaderboard.length > 0 && (
                  <div className="rounded-2xl border border-line bg-surface-subtle p-4">
                    <h3 className="font-display text-xs font-extrabold text-ink">
                      الترتيب النهائي ({finalSummary.leaderboard.length} مشاركاً)
                    </h3>
                    <div className="mt-2.5 divide-y divide-line">
                      {finalSummary.leaderboard.slice(0, 10).map((entry) => {
                        const isMe = entry.participantId === liveState.participant.id;
                        return (
                          <div
                            key={entry.participantId}
                            className={`flex items-center justify-between py-2 text-xs ${
                              isMe ? 'font-extrabold text-accent' : 'font-bold text-ink-muted'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="tabular-nums inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-[11px] font-black text-ink">
                                {entry.rankPosition}
                              </span>
                              <span className="text-sm">
                                {getStudentAvatar(entry.avatarId).emoji}
                              </span>
                              <span className="truncate">
                                {entry.displayName}
                                {isMe ? ' (أنت)' : ''}
                              </span>
                            </span>
                            <span className="tabular-nums shrink-0 font-black">
                              {entry.totalScore} نقطة
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeStatus === 'cancelled' && (
              <div className="rounded-2xl border border-danger-line bg-danger-soft p-5 text-center">
                <AlertCircle className="mx-auto h-7 w-7 text-danger" />
                <h2 className="font-display mt-2 text-base font-extrabold text-danger-ink">
                  تم إلغاء الجلسة
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-danger-ink opacity-90">
                  ألغى المعلم هذه الجلسة المباشرة. يمكنك الانضمام إلى جلسة جديدة باستخدام رمز آخر.
                </p>
              </div>
            )}

            {/* زر استعادة يدوية عند ضعف الشبكة + زر مغادرة الجلسة */}
            <div className="flex flex-col gap-2 pt-1">
              {!socketConnected && activeStatus === 'running' && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const refreshed = await httpLiveSessionService.getStudentState(
                        joinedCredentials.sessionId,
                        joinedCredentials.participantId,
                        joinedCredentials.reconnectToken
                      );
                      setLiveState(refreshed);
                    } catch {
                      // Ignore silent refresh error
                    }
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 text-xs font-bold text-warning-ink transition-opacity hover:opacity-90"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>تحديث حالة السؤال</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLeaveSession}
                className="qc-btn-secondary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold"
              >
                <LogOut className="h-4 w-4" />
                <span>
                  {activeStatus === 'completed' || activeStatus === 'cancelled'
                    ? 'الانضمام إلى مسابقة أخرى'
                    : 'مغادرة الجلسة'}
                </span>
              </button>
            </div>
          </section>
        ) : (
          <section className="qc-card p-6">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-selected text-accent">
                <Radio className="h-6 w-6" />
              </div>
              <h1 className="font-display mt-3 text-xl font-extrabold text-ink">
                الانضمام إلى المسابقة المباشرة
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                أدخل رمز المسابقة واسمك للانضمام فوراً عبر الشبكة المحلية دون الحاجة لحساب.
              </p>
            </div>

            <form onSubmit={(e) => void handleJoinSubmit(e)} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="student-pin-input"
                  className="mb-1.5 block text-xs font-bold text-ink"
                >
                  رمز المسابقة (PIN)
                </label>
                <input
                  id="student-pin-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(normalizePinDigits(e.target.value))}
                  placeholder="000000"
                  className="qc-input font-display tabular-nums h-14 w-full rounded-xl px-4 text-center text-2xl font-black tracking-[0.25em] placeholder:tracking-normal"
                />
              </div>

              {isLookingUpPin && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-xs font-bold text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span>جارٍ التحقق من رمز الجلسة...</span>
                </div>
              )}

              {previewSession && !lookupError && (
                <div className="rounded-xl border border-success-line bg-success-soft p-3.5">
                  <p className="text-[11px] font-bold text-success-ink">
                    {previewSession.status === 'running'
                      ? 'المسابقة جارية حالياً — يمكنك الانضمام الآن'
                      : 'تم العثور على الجلسة'}
                  </p>
                  <p className="font-display mt-0.5 text-sm font-extrabold text-ink">
                    {previewSession.quizTitle}
                  </p>
                  <p className="tabular-nums mt-0.5 text-xs text-ink-muted">
                    {previewSession.questionCount} سؤالاً
                    {previewSession.quizSubject ? ` · ${previewSession.quizSubject}` : ''}
                  </p>
                </div>
              )}

              {lookupError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-xs font-bold text-danger-ink"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="student-name-input"
                  className="mb-1.5 block text-xs font-bold text-ink"
                >
                  اسم الطالب
                </label>
                <input
                  id="student-name-input"
                  type="text"
                  maxLength={40}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="اكتب اسمك كما سيظهر على الشاشة..."
                  className="qc-input h-12 w-full rounded-xl px-4 text-sm font-bold placeholder:font-normal"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-ink">
                  اختر شخصيتك الرمزية (Avatar)
                </label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 max-h-52 overflow-y-auto p-1">
                  {STUDENT_AVATARS.map((av) => {
                    const isSelected = selectedAvatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(av.id)}
                        title={av.label}
                        className={`flex flex-col items-center justify-center rounded-xl border-2 p-2 transition-all ${
                          av.bgClass
                        } ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/30 scale-105 shadow-xs'
                            : 'border-line hover:border-selected-line'
                        }`}
                      >
                        <span className="text-2xl">{av.emoji}</span>
                        <span className={`mt-1 text-[10px] font-bold truncate w-full text-center ${av.textClass}`}>
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {joinError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-xs font-bold text-danger-ink"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining || Boolean(lookupError)}
                className="qc-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جارٍ الانضمام...</span>
                  </>
                ) : (
                  <span>انضمام إلى المسابقة</span>
                )}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

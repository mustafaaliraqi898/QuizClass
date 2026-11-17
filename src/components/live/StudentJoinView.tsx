import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Radio,
  RefreshCw,
  Sun,
  Trophy,
  UserCheck,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

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

  const socketRef = useRef<Socket | null>(null);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      {/* شريط علوي مبسط للهواتف */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
          <QuizClassLogo />

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-6">
        {isRestoringSession ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
              جارٍ التحقق من اتصالك بالمسابقة...
            </p>
          </div>
        ) : joinedCredentials && liveState && session ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {/* شريط حالة الاتصال والرمز */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                  socketConnected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
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

              <span className="tabular-nums text-xs font-bold text-slate-500 dark:text-slate-400">
                رمز {session.pinCode}
              </span>
            </div>

            {/* بطاقة تعريف الطالب والمسابقة */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{liveState.participant.displayName}</span>
                </span>
                <span className="tabular-nums rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-slate-800 shadow-2xs dark:bg-slate-900 dark:text-slate-200">
                  {liveState.participant.totalScore} نقطة
                </span>
              </div>
              <p className="mt-1.5 truncate font-display text-sm font-extrabold text-slate-900 dark:text-white">
                {session.quizTitle}
              </p>
            </div>

            {/* 1. انتظار بدء المسابقة */}
            {activeStatus === 'waiting' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="font-display mt-3 text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                  تم الانضمام بنجاح!
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                  اسمك ظاهر الآن على شاشة المعلم. استعد لبداية المسابقة.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-slate-900/70 dark:text-emerald-300">
                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                  <span>في انتظار بدء المعلم...</span>
                </div>
              </div>
            )}

            {/* 2. عرض السؤال دون الاختيارات */}
            {activeStatus === 'running' && currentPhase === 'question_intro' && currentQuestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                    السؤال {questionNumber} من {session.questionCount}
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    <span>تظهر الاختيارات خلال {remainingSeconds} ث</span>
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <h2 className="font-display text-lg leading-relaxed font-extrabold text-slate-900 dark:text-white">
                    {currentQuestion.prompt}
                  </h2>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt="صورة السؤال"
                      className="mx-auto mt-4 max-h-48 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                    />
                  )}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-center text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                  اقرأ السؤال بتركيز — ستظهر أزرار الإجابة فور انتهاء العد التمهيدي.
                </div>
              </div>
            )}

            {/* 3 و4 و5. عرض السؤال والاختيارات + استلام الإجابة + انتهاء الوقت */}
            {activeStatus === 'running' && currentPhase === 'answering' && currentQuestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                    السؤال {questionNumber} من {session.questionCount}
                  </span>
                  <span
                    className={`tabular-nums inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-extrabold ${
                      remainingSeconds <= 5
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{remainingSeconds} ثانية</span>
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      remainingSeconds <= 5 ? 'bg-red-500' : 'bg-indigo-600 dark:bg-indigo-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <h2 className="font-display text-base leading-relaxed font-extrabold text-slate-900 dark:text-white">
                    {currentQuestion.prompt}
                  </h2>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt="صورة السؤال"
                      className="mx-auto mt-3 max-h-44 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                    />
                  )}
                </div>

                {/* حالة انتهاء الوقت قبل وصول بث النتائج */}
                {remainingSeconds <= 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-center text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    انتهى وقت الإجابة — جارٍ احتساب النتائج...
                  </div>
                )}

                {/* حالة تأكيد استلام الإجابة */}
                {myAnswer && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {session.settings.allowAnswerChange ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
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
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-white'
                              : 'border-slate-200 bg-white text-slate-900 hover:border-indigo-300 hover:bg-slate-50 disabled:opacity-65 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-700'
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-black ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
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
                                className="mt-2 max-h-24 rounded-lg border border-slate-200 object-contain bg-white"
                              />
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
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
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-white'
                              : tf.value
                                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:border-emerald-400 disabled:opacity-65 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200'
                                : 'border-red-200 bg-red-50/50 text-red-900 hover:border-red-400 disabled:opacity-65 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200'
                          }`}
                        >
                          {tf.value ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                          )}
                          <span>{tf.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 6 و7. عرض نتيجة السؤال للطالب + انتظار السؤال التالي */}
            {activeStatus === 'running' && currentPhase === 'question_results' && questionResult && (
              <div className="space-y-4">
                {questionResult.joinedMidResult ? (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-center dark:border-indigo-900/60 dark:bg-indigo-950/40">
                    <Clock className="mx-auto h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="font-display mt-2 text-base font-extrabold text-indigo-950 dark:text-indigo-200">
                      أهلاً بك في المسابقة!
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
                      انتهى السؤال السابق قبل انضمامك؛ ستبدأ المشاركة الفعلية من السؤال التالي مباشرة.
                    </p>
                  </div>
                ) : questionResult.myResult.answered ? (
                  questionResult.myResult.isCorrect ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      <h2 className="font-display mt-2 text-lg font-extrabold text-emerald-900 dark:text-emerald-200">
                        إجابة صحيحة!
                      </h2>
                      <p className="tabular-nums mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">
                        +{questionResult.myResult.pointsAwarded} نقطة
                      </p>
                      {questionResult.myResult.responseTimeMs !== null && (
                        <p className="tabular-nums mt-0.5 text-[11px] font-bold text-emerald-700/80 dark:text-emerald-300/80">
                          زمن الاستجابة:{' '}
                          {(questionResult.myResult.responseTimeMs / 1000).toFixed(1)} ثانية
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/60 dark:bg-red-950/40">
                      <XCircle className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
                      <h2 className="font-display mt-2 text-lg font-extrabold text-red-900 dark:text-red-200">
                        إجابة غير صحيحة
                      </h2>
                      <p className="mt-1 text-xs font-bold text-red-700 dark:text-red-300">
                        0 نقطة في هذا السؤال — بالتوفيق في السؤال القادم!
                      </p>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
                    <HelpCircle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
                    <h2 className="font-display mt-2 text-base font-extrabold text-amber-900 dark:text-amber-200">
                      لم ترسل إجابة في الوقت المحدد
                    </h2>
                    <p className="mt-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                      0 نقطة في هذا السؤال
                    </p>
                  </div>
                )}

                {/* كشف الإجابة الصحيحة للطالب بعد انتهاء الوقت */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    الإجابة الصحيحة:
                  </p>
                  {questionResult.type === 'multiple_choice' ? (
                    <div className="mt-2 space-y-2">
                      {questionResult.options.map((opt, idx) => {
                        const isMine =
                          questionResult.myResult.selectedOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs font-bold ${
                              opt.isCorrect
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100'
                                : isMine
                                  ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
                                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="font-display font-black">
                                {OPTION_LETTERS[idx] ?? idx + 1}.
                              </span>
                              <span>{opt.optionText ?? `خيار ${idx + 1}`}</span>
                            </span>
                            {opt.isCorrect && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-display mt-1 text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                      {questionResult.correctBoolean ? 'صح' : 'خطأ'}
                    </p>
                  )}
                </div>

                {/* الرصيد والترتيب الحالي + حالة انتظار السؤال التالي */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
                  <span>
                    مجموعك:{' '}
                    <span className="tabular-nums font-black text-indigo-600 dark:text-indigo-400">
                      {liveState.participant.totalScore}
                    </span>
                  </span>
                  {liveState.participant.rankPosition && (
                    <span>
                      ترتيبك الحالي:{' '}
                      <span className="tabular-nums font-black text-slate-900 dark:text-white">
                        #{liveState.participant.rankPosition}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs font-bold text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
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
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 text-center dark:border-indigo-900/60 dark:bg-indigo-950/40">
                  <Trophy className="mx-auto h-9 w-9 text-amber-500" />
                  <h2 className="font-display mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
                    انتهت المسابقة!
                  </h2>

                  {finalSummary?.mySummary ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            المركز النهائي
                          </p>
                          <p className="tabular-nums font-display mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            #{finalSummary.mySummary.rankPosition}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            مجموع النقاط
                          </p>
                          <p className="tabular-nums font-display mt-1 text-2xl font-black text-slate-900 dark:text-white">
                            {finalSummary.mySummary.totalScore}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-center gap-4 text-xs font-bold">
                        <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                          صحيح: {finalSummary.mySummary.correctCount}
                        </span>
                        <span className="tabular-nums text-red-700 dark:text-red-300">
                          خطأ: {finalSummary.mySummary.wrongCount}
                        </span>
                        <span className="tabular-nums text-slate-600 dark:text-slate-400">
                          لم يجب: {finalSummary.mySummary.unansweredCount}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                      شكراً لمشاركتك يا {liveState.participant.displayName}!
                    </p>
                  )}
                </div>

                {finalSummary && finalSummary.leaderboard.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <h3 className="font-display text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      الترتيب النهائي ({finalSummary.leaderboard.length} مشاركاً)
                    </h3>
                    <div className="mt-2.5 divide-y divide-slate-200 dark:divide-slate-800">
                      {finalSummary.leaderboard.slice(0, 10).map((entry) => {
                        const isMe = entry.participantId === liveState.participant.id;
                        return (
                          <div
                            key={entry.participantId}
                            className={`flex items-center justify-between py-2 text-xs ${
                              isMe ? 'font-extrabold text-indigo-700 dark:text-indigo-300' : 'font-bold text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="tabular-nums inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-black shadow-2xs dark:bg-slate-800">
                                {entry.rankPosition}
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
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/60 dark:bg-red-950/30">
                <AlertCircle className="mx-auto h-7 w-7 text-red-600 dark:text-red-400" />
                <h2 className="font-display mt-2 text-base font-extrabold text-red-900 dark:text-red-200">
                  تم إلغاء الجلسة
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
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
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>تحديث حالة السؤال</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLeaveSession}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                <Radio className="h-6 w-6" />
              </div>
              <h1 className="font-display mt-3 text-xl font-extrabold text-slate-900 dark:text-white">
                الانضمام إلى المسابقة المباشرة
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                أدخل رمز المسابقة واسمك للانضمام فوراً عبر الشبكة المحلية دون الحاجة لحساب.
              </p>
            </div>

            <form onSubmit={(e) => void handleJoinSubmit(e)} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="student-pin-input"
                  className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200"
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
                  className="font-display tabular-nums h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-black tracking-[0.25em] text-slate-900 placeholder:tracking-normal placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
                />
              </div>

              {isLookingUpPin && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>جارٍ التحقق من رمز الجلسة...</span>
                </div>
              )}

              {previewSession && !lookupError && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    {previewSession.status === 'running'
                      ? 'المسابقة جارية حالياً — يمكنك الانضمام الآن'
                      : 'تم العثور على الجلسة'}
                  </p>
                  <p className="font-display mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">
                    {previewSession.quizTitle}
                  </p>
                  <p className="tabular-nums mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {previewSession.questionCount} سؤالاً
                    {previewSession.quizSubject ? ` · ${previewSession.quizSubject}` : ''}
                  </p>
                </div>
              )}

              {lookupError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="student-name-input"
                  className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200"
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900"
                />
              </div>

              {joinError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining || Boolean(lookupError)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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

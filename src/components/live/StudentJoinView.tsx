import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Moon,
  Radio,
  Sun,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { httpLiveSessionService } from '../../services/liveSessionService';
import type { ThemeMode } from '../../types/dashboard';
import type {
  ParticipantConnectionStatus,
  StudentPublicSessionInfo,
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
  const [liveSession, setLiveSession] = useState<StudentPublicSessionInfo | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const socketRef = useRef<Socket | null>(null);

  // محاولة استعادة جلسة الطالب عند تحديث الصفحة أو إعادة فتح الرابط دون إنشاء مشارك مكرر
  useEffect(() => {
    const stored = readStoredStudentSession();
    if (!stored) {
      setIsRestoringSession(false);
      return;
    }

    if (initialUrlPin && initialUrlPin !== stored.pinCode) {
      // الطالب فتح رابط QR جديداً برمز مختلف
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
        setLiveSession(res.session);
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
      .then((session) => {
        setPreviewSession(session);
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
        (ack: {
          ok: boolean;
          error?: string;
          data?: {
            session: StudentPublicSessionInfo;
            participant: {
              id: string;
              sessionId: string;
              displayName: string;
              connectionStatus: ParticipantConnectionStatus;
              joinedAt: string;
            };
          };
        }) => {
          if (ack?.ok && ack.data) {
            setLiveSession(ack.data.session);
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

    socket.on(
      'session:student_state',
      (payload: { session: StudentPublicSessionInfo }) => {
        if (payload?.session) {
          setLiveSession(payload.session);
        }
      }
    );

    socket.on(
      'session:student_status',
      (payload: { session: StudentPublicSessionInfo }) => {
        if (payload?.session) {
          setLiveSession(payload.session);
          if (
            payload.session.status === 'completed' ||
            payload.session.status === 'cancelled'
          ) {
            writeStoredStudentSession(null);
          }
        }
      }
    );

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
      setLiveSession(response.session);
      setJoinError(null);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : 'تعذر الانضمام إلى الجلسة حالياً.'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveSession = () => {
    writeStoredStudentSession(null);
    setJoinedCredentials(null);
    setLiveSession(null);
    setJoinError(null);
    setDisplayName('');
  };

  const activeStatus = liveSession?.status ?? 'waiting';

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

      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-8">
        {isRestoringSession ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
              جارٍ التحقق من اتصالك بالمسابقة...
            </p>
          </div>
        ) : joinedCredentials && liveSession ? (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
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
                    <span>متصل بالجلسة</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>جارٍ إعادة الاتصال...</span>
                  </>
                )}
              </span>

              <span className="tabular-nums text-xs font-bold text-slate-500 dark:text-slate-400">
                رمز {liveSession.pinCode}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">المسابقة</p>
              <h1 className="font-display mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {liveSession.quizTitle}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{joinedCredentials.displayName}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{liveSession.questionCount} سؤالاً</span>
              </div>
            </div>

            {activeStatus === 'waiting' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="font-display mt-3 text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                  تم الانضمام بنجاح!
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                  اسمك ظاهر الآن على شاشة المعلم. انتظر بدء المسابقة.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-slate-900/70 dark:text-emerald-300">
                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                  <span>في انتظار بدء المعلم...</span>
                </div>
              </div>
            )}

            {activeStatus === 'running' && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 text-center dark:border-indigo-900/60 dark:bg-indigo-950/30">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Radio className="h-6 w-6 animate-pulse" />
                </div>
                <h2 className="font-display mt-3 text-base font-extrabold text-indigo-950 dark:text-indigo-200">
                  بدأت المسابقة الآن!
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
                  تم بدء الجلسة من قِبل المعلم. سيتم عرض الأسئلة وخيارات الإجابة الفورية في
                  الجزء التالي من تطوير النظام.
                </p>
              </div>
            )}

            {activeStatus === 'completed' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
                <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                  انتهت المسابقة
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  شكراً لمشاركتك يا {joinedCredentials.displayName}! تم إنهاء الجلسة من قِبل المعلم.
                </p>
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
                    تم العثور على الجلسة
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

import { useEffect, useState } from 'react';

interface ServerSyncedCountdownResult {
  remainingMs: number | null;
  remainingSeconds: number;
  progressPercent: number;
}

/**
 * يحسب العد التنازلي محلياً للعرض فقط استناداً إلى الوقت المتبقي الفعلي المرسل من الخادم
 * باستخدام الساعة الرتيبة (performance.now) دون الاعتماد على ساعة الجهاز أو تقرير نهاية السؤال محلياً.
 */
export function useServerSyncedCountdown(
  phaseStartedAt: string | null,
  phaseEndsAt: string | null,
  phaseDurationMs: number | null,
  serverRemainingMs: number | null
): ServerSyncedCountdownResult {
  const [liveRemainingMs, setLiveRemainingMs] = useState<number | null>(serverRemainingMs);

  useEffect(() => {
    if (serverRemainingMs === null || !phaseEndsAt) {
      setLiveRemainingMs(null);
      return;
    }

    const syncedPerfEnd = performance.now() + Math.max(0, serverRemainingMs);
    setLiveRemainingMs(Math.max(0, serverRemainingMs));

    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.round(syncedPerfEnd - performance.now()));
      setLiveRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(interval);
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [phaseStartedAt, phaseEndsAt, serverRemainingMs]);

  const remainingSeconds =
    liveRemainingMs === null ? 0 : Math.max(0, Math.ceil(liveRemainingMs / 1000));

  const progressPercent =
    liveRemainingMs === null || !phaseDurationMs || phaseDurationMs <= 0
      ? 0
      : Math.max(0, Math.min(100, (liveRemainingMs / phaseDurationMs) * 100));

  return {
    remainingMs: liveRemainingMs,
    remainingSeconds,
    progressPercent,
  };
}

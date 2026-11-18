import { Check, Clock, Loader2, Settings2, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  LiveAdvanceMode,
  LiveScoringMode,
  LiveSessionSettings,
} from '../../types/liveSession';

interface LiveSessionSettingsPanelProps {
  settings: LiveSessionSettings;
  disabled?: boolean;
  isSaving?: boolean;
  onSaveSettings: (nextSettings: LiveSessionSettings) => Promise<void>;
}

export function LiveSessionSettingsPanel({
  settings,
  disabled = false,
  isSaving = false,
  onSaveSettings,
}: LiveSessionSettingsPanelProps) {
  const [draft, setDraft] = useState<LiveSessionSettings>(settings);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const commitChange = async (next: LiveSessionSettings) => {
    setDraft(next);
    await onSaveSettings(next);
    setJustSaved(true);
    window.setTimeout(() => {
      setJustSaved(false);
    }, 1800);
  };

  const clampSeconds = (raw: string, fallback: number): number => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(60, Math.max(1, parsed));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
              إعدادات تشغيل المسابقة المباشرة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تُحفظ الإعدادات داخل الجلسة وتثبت بمجرد بدء المسابقة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          {isSaving && (
            <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>جارٍ الحفظ...</span>
            </span>
          )}
          {!isSaving && justSaved && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>تم الحفظ</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* 1. مدة عرض السؤال قبل الاختيارات */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <label
            htmlFor="setting-intro-seconds"
            className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white"
          >
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>مدة عرض السؤال قبل ظهور الاختيارات (ثانية)</span>
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            تمنح الطلاب وقتاً لقراءة السؤال قبل ظهور الخيارات وبدء مؤقت الإجابة.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="setting-intro-seconds"
              type="number"
              min={1}
              max={60}
              disabled={disabled || isSaving}
              value={draft.questionIntroSeconds}
              onChange={(e) => {
                const val = clampSeconds(e.target.value, draft.questionIntroSeconds);
                void commitChange({ ...draft, questionIntroSeconds: val });
              }}
              className="tabular-nums h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-extrabold text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">ثوانٍ (1 – 60)</span>
          </div>
        </div>

        {/* 2. نظام احتساب النقاط */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>نظام احتساب النقاط</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            يتم الحساب حصرياً على الخادم وفق توقيت استلام الإجابة.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: 'speed_and_accuracy',
                  title: 'السرعة وصحة الإجابة',
                  desc: 'حتى 1000 نقطة حسب سرعة الإجابة',
                },
                {
                  value: 'accuracy_only',
                  title: 'صحة الإجابة فقط',
                  desc: '1000 نقطة ثابتة لكل إجابة صحيحة',
                },
              ] as Array<{ value: LiveScoringMode; title: string; desc: string }>
            ).map((option) => {
              const selected = draft.scoringMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled || isSaving}
                  onClick={() => void commitChange({ ...draft, scoringMode: option.value })}
                  className={`rounded-xl border p-2.5 text-start transition-colors disabled:opacity-60 ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-extrabold">{option.title}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{option.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. طريقة الانتقال بين الأسئلة */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>طريقة الانتقال بين الأسئلة</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                { value: 'auto', label: 'تلقائي بعد النتائج' },
                { value: 'manual', label: 'يدوي بضغط المعلم' },
              ] as Array<{ value: LiveAdvanceMode; label: string }>
            ).map((mode) => {
              const selected = draft.advanceMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  disabled={disabled || isSaving}
                  onClick={() => void commitChange({ ...draft, advanceMode: mode.value })}
                  className={`h-10 rounded-xl border px-3 text-xs font-extrabold transition-colors disabled:opacity-60 ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50/80 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          {draft.advanceMode === 'auto' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="setting-auto-advance-seconds"
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300"
              >
                مدة عرض النتائج قبل الانتقال:
              </label>
              <input
                id="setting-auto-advance-seconds"
                type="number"
                min={1}
                max={60}
                disabled={disabled || isSaving}
                value={draft.autoAdvanceSeconds}
                onChange={(e) => {
                  const val = clampSeconds(e.target.value, draft.autoAdvanceSeconds);
                  void commitChange({ ...draft, autoAdvanceSeconds: val });
                }}
                className="tabular-nums h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-extrabold text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ثوانٍ</span>
            </div>
          )}
        </div>

        {/* 4. خيارات التحكم بالمشاركة والإجابة */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>صلاحيات المشاركة والإجابات</span>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                السماح بتغيير الإجابة
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                عند التعطيل تُثبت أول إجابة يستلمها الخادم
              </p>
            </div>
            <input
              type="checkbox"
              disabled={disabled || isSaving}
              checked={draft.allowAnswerChange}
              onChange={(e) =>
                void commitChange({ ...draft, allowAnswerChange: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                السماح بالانضمام بعد بدء المسابقة
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ينضم المتأخر للأسئلة الحالية أو القادمة دون نقاط سابقة
              </p>
            </div>
            <input
              type="checkbox"
              disabled={disabled || isSaving}
              checked={draft.allowLateJoin}
              onChange={(e) =>
                void commitChange({ ...draft, allowLateJoin: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                تشغيل وضع ملء الشاشة تلقائياً
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                عرض السبورة على كامل الشاشة عند بدء المسابقة لتركيز عرض العارض
              </p>
            </div>
            <input
              type="checkbox"
              disabled={disabled || isSaving}
              checked={draft.fullScreenMode}
              onChange={(e) =>
                void commitChange({ ...draft, fullScreenMode: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

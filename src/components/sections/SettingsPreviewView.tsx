import { ArrowRight, Check, Database, Monitor, Moon, Sun, Wifi } from 'lucide-react';
import type { NavSectionId, TeacherProfile, ThemeMode } from '../../types/dashboard';

interface SettingsPreviewViewProps {
  theme: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  teacher: TeacherProfile;
  onNavigate: (section: NavSectionId) => void;
}

export function SettingsPreviewView({
  theme,
  onSetTheme,
  sidebarCollapsed,
  onToggleSidebarCollapse,
  teacher,
  onNavigate,
}: SettingsPreviewViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
            إعدادات المظهر وبيئة العمل
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            تحكم في مظهر التطبيق وتخطيط الشريط الجانبي؛ تفضيلاتك تُحفظ محلياً على هذا الجهاز.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى لوحة التحكم</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            سمة العرض (الوضع النهاري والليلي)
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            اختر المظهر الأنسب لإضاءة قاعة الصف أو المكتب.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`flex items-center justify-between rounded-xl border p-4 text-start transition-colors ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="h-5 w-5 text-amber-500" />
                <div>
                  <span className="block text-sm font-bold">الوضع النهاري</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    خلفية فاتحة واضحة
                  </span>
                </div>
              </div>
              {theme === 'light' && <Check className="h-4 w-4 text-indigo-600" />}
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`flex items-center justify-between rounded-xl border p-4 text-start transition-colors ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-indigo-500" />
                <div>
                  <span className="block text-sm font-bold">الوضع الليلي</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    مريح للعين في الإضاءة الهادئة
                  </span>
                </div>
              </div>
              {theme === 'dark' && <Check className="h-4 w-4 text-indigo-400" />}
            </button>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  طي الشريط الجانبي على سطح المكتب
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  توفير مساحة أفقية أوسع للوحة التحكم والجداول
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sidebarCollapsed}
                aria-label="طي الشريط الجانبي على سطح المكتب"
                onClick={onToggleSidebarCollapse}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors ${
                  sidebarCollapsed ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-xs transition-transform ${
                    sidebarCollapsed ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            حساب المعلم والبنية المستقبلية للتطبيق
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ملخص البيئة المستهدفة عند استكمال مراحل الخادم المحلي وسطح المكتب.
          </p>

          <div className="mt-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            {teacher.avatarPath ? (
              <img
                src={teacher.avatarPath}
                alt={teacher.name}
                referrerPolicy="no-referrer"
                className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-indigo-50 text-base font-bold text-indigo-700 dark:border-slate-700 dark:bg-indigo-950 dark:text-indigo-300">
                <span>{teacher.name ? teacher.name.charAt(0) : 'م'}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {teacher.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {teacher.role} · {teacher.school}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>تطبيق سطح مكتب مستقل لنظام Windows باستخدام Electron.</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>قاعدة بيانات SQLite محلية لحفظ الأسئلة والنتائج دون الحاجة للإنترنت.</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>اتصال مباشر للطلاب عبر نقطة Wi-Fi أو راوتر المدرسة المحلي.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

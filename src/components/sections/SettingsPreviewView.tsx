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
      <div className="qc-card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">
            إعدادات المظهر وبيئة العمل
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            تحكم في مظهر التطبيق وتخطيط الشريط الجانبي؛ تفضيلاتك تُحفظ محلياً على هذا الجهاز.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="qc-btn-secondary inline-flex h-10 items-center gap-2 self-start rounded-xl px-4 text-xs font-bold whitespace-nowrap shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى لوحة التحكم</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="qc-card p-6">
          <h3 className="font-display text-base font-bold text-ink">
            سمة العرض (الوضع النهاري والليلي)
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            اختر المظهر الأنسب لإضاءة قاعة الصف أو المكتب.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`flex items-center justify-between rounded-xl border p-4 text-start transition-colors ${
                theme === 'light'
                  ? 'border-primary bg-selected text-ink dark:border-icon-soft'
                  : 'border-line bg-input text-ink-muted hover:bg-row-hover hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="h-5 w-5 text-warning" />
                <div>
                  <span className="block text-sm font-bold text-ink">الوضع النهاري</span>
                  <span className="block text-[11px] text-ink-muted">خلفية فاتحة دافئة ومريحة</span>
                </div>
              </div>
              {theme === 'light' && <Check className="h-4 w-4 text-primary dark:text-icon-soft" />}
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`flex items-center justify-between rounded-xl border p-4 text-start transition-colors ${
                theme === 'dark'
                  ? 'border-primary bg-selected text-ink dark:border-icon-soft'
                  : 'border-line bg-input text-ink-muted hover:bg-row-hover hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-accent" />
                <div>
                  <span className="block text-sm font-bold text-ink">الوضع الليلي</span>
                  <span className="block text-[11px] text-ink-muted">
                    مريح للعين في الإضاءة الهادئة
                  </span>
                </div>
              </div>
              {theme === 'dark' && <Check className="h-4 w-4 text-primary dark:text-icon-soft" />}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-ink">
                  طي الشريط الجانبي على سطح المكتب
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
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
                  sidebarCollapsed ? 'bg-primary' : 'bg-line-strong'
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

        <section className="qc-card p-6">
          <h3 className="font-display text-base font-bold text-ink">
            حساب المعلم والبنية المستقبلية للتطبيق
          </h3>
          <p className="mt-1 text-xs text-ink-muted">
            ملخص البيئة المستهدفة عند استكمال مراحل الخادم المحلي وسطح المكتب.
          </p>

          <div className="mt-5 flex items-center gap-4 rounded-xl border border-line bg-surface-subtle p-4">
            {teacher.avatarPath ? (
              <img
                src={teacher.avatarPath}
                alt={teacher.name}
                referrerPolicy="no-referrer"
                className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-selected text-base font-bold text-accent">
                <span>{teacher.name ? teacher.name.charAt(0) : 'م'}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{teacher.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {teacher.role} · {teacher.school}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 text-xs text-ink-muted">
              <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>تطبيق سطح مكتب مستقل لنظام Windows باستخدام Electron.</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-ink-muted">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
              <span>قاعدة بيانات SQLite محلية لحفظ الأسئلة والنتائج دون الحاجة للإنترنت.</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-ink-muted">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>اتصال مباشر للطلاب عبر نقطة Wi-Fi أو راوتر المدرسة المحلي.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

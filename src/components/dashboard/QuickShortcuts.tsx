import { ArrowLeft, BarChart3, FolderOpen, PlusSquare, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import type { NavSectionId, QuickShortcut } from '../../types/dashboard';

interface QuickShortcutsProps {
  shortcuts: QuickShortcut[];
  onNavigate: (section: NavSectionId) => void;
}

const SHORTCUT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'shortcut-add-question': PlusSquare,
  'shortcut-question-bank': FolderOpen,
  'shortcut-create-quiz': Sparkles,
  'shortcut-view-reports': BarChart3,
};

const ICON_TONES: Record<QuickShortcut['accentTone'], string> = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/70 dark:text-violet-400',
};

export function QuickShortcuts({ shortcuts, onNavigate }: QuickShortcutsProps) {
  return (
    <section aria-label="اختصارات سريعة">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
          الوصول السريع
        </h3>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          انتقل مباشرة إلى المهمة المطلوبة
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((shortcut) => {
          const Icon = SHORTCUT_ICONS[shortcut.id] ?? PlusSquare;

          return (
            <button
              key={shortcut.id}
              type="button"
              onClick={() => onNavigate(shortcut.targetSection)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-start transition-all duration-150 hover:border-indigo-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    ICON_TONES[shortcut.accentTone]
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowLeft className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:-translate-x-1 group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-400" />
              </div>

              <div className="mt-4 space-y-1">
                <h4 className="font-display text-sm font-bold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
                  {shortcut.title}
                </h4>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {shortcut.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

import { ArrowLeft, BarChart3, FolderOpen, PlusSquare, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import type { NavSectionId, QuickShortcut } from '../../types/dashboard';

interface QuickShortcutsProps {
  shortcuts: QuickShortcut[];
  onNavigate: (section: NavSectionId, contextNote?: string, shortcutId?: string) => void;
}

const SHORTCUT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'shortcut-add-question': PlusSquare,
  'shortcut-question-bank': FolderOpen,
  'shortcut-create-quiz': Sparkles,
  'shortcut-view-reports': BarChart3,
};

const ICON_TONES: Record<QuickShortcut['accentTone'], string> = {
  indigo: 'border border-selected-line bg-selected text-accent',
  sky: 'border border-line bg-surface-subtle text-accent',
  emerald: 'border border-success-line bg-success-soft text-success-ink',
  violet: 'border border-warning-line bg-warning-soft text-warning-ink',
};

export function QuickShortcuts({ shortcuts, onNavigate }: QuickShortcutsProps) {
  return (
    <section aria-label="اختصارات سريعة">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">الوصول السريع</h3>
        <span className="text-xs font-medium text-ink-muted">
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
              onClick={() =>
                onNavigate(shortcut.targetSection, shortcut.contextNote, shortcut.id)
              }
              className="qc-card group flex flex-col justify-between p-5 text-start transition-all duration-150 hover:border-selected-line hover:bg-surface-subtle"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    ICON_TONES[shortcut.accentTone]
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowLeft className="h-4 w-4 text-ink-muted transition-transform duration-150 group-hover:-translate-x-1 group-hover:text-accent" />
              </div>

              <div className="mt-4 space-y-1">
                <h4 className="font-display text-sm font-bold text-ink transition-colors group-hover:text-accent">
                  {shortcut.title}
                </h4>
                <p className="text-xs leading-relaxed text-ink-muted">{shortcut.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

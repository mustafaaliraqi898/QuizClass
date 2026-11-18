import { Menu, Moon, PanelRightClose, PanelRightOpen, Plus, Sun } from 'lucide-react';
import type { NavItem, NavSectionId, ThemeMode } from '../../types/dashboard';

interface TopBarProps {
  currentItem: NavItem;
  theme: ThemeMode;
  onToggleTheme: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onOpenMobileSidebar: () => void;
  onNavigate: (section: NavSectionId) => void;
}

export function TopBar({
  currentItem,
  theme,
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebarCollapse,
  onOpenMobileSidebar,
  onNavigate,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/92 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted transition-colors hover:bg-row-hover hover:text-ink lg:hidden"
          aria-label="فتح قائمة التنقل"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebarCollapse}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted transition-colors hover:bg-row-hover hover:text-ink lg:flex"
          aria-label={sidebarCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
          title={sidebarCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
        >
          {sidebarCollapsed ? (
            <PanelRightOpen className="h-5 w-5" />
          ) : (
            <PanelRightClose className="h-5 w-5" />
          )}
        </button>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="font-display hidden font-bold text-ink-muted sm:inline">
            QuizClass
          </span>
          <span className="hidden text-line-strong sm:inline">/</span>
          <h1 className="font-display truncate text-base font-bold text-ink sm:text-lg">
            {currentItem.label}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
          className="flex h-10 items-center gap-2 rounded-xl border border-line bg-input px-3.5 text-xs font-bold text-ink transition-colors hover:bg-row-hover whitespace-nowrap shrink-0"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-warning" />
              <span className="hidden sm:inline">الوضع النهاري</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">الوضع الليلي</span>
            </>
          )}
        </button>

        {currentItem.id !== 'create-quiz' && (
          <button
            type="button"
            onClick={() => onNavigate('create-quiz')}
            className="qc-btn-primary flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-xs whitespace-nowrap shrink-0 sm:gap-2 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span>مسابقة جديدة</span>
          </button>
        )}
      </div>
    </header>
  );
}

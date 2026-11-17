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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="فتح قائمة التنقل"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebarCollapse}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
          <span className="font-display hidden font-bold text-slate-400 sm:inline dark:text-slate-500">
            QuizClass
          </span>
          <span className="hidden text-slate-300 sm:inline dark:text-slate-700">/</span>
          <h1 className="font-display truncate text-base font-bold text-slate-900 sm:text-lg dark:text-white">
            {currentItem.label}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">الوضع النهاري</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">الوضع الليلي</span>
            </>
          )}
        </button>

        {currentItem.id !== 'create-quiz' && (
          <button
            type="button"
            onClick={() => onNavigate('create-quiz')}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:gap-2 sm:px-4 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            <span>مسابقة جديدة</span>
          </button>
        )}
      </div>
    </header>
  );
}

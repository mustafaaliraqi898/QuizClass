import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  PlusCircle,
  Presentation,
  Radio,
  Settings,
  Trophy,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NavItem, NavSectionId, TeacherProfile } from '../../types/dashboard';
import { QuizClassLogo } from '../brand/QuizClassLogo';

interface SidebarProps {
  items: NavItem[];
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  teacher?: TeacherProfile;
}

const SECTION_ICONS: Record<NavSectionId, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  'question-bank': BookOpen,
  'create-quiz': PlusCircle,
  quizzes: Trophy,
  'live-session': Radio,
  'interactive-learning': Presentation,
  reports: BarChart3,
  settings: Settings,
};

export function Sidebar({
  items,
  activeSection,
  onSelectSection,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleNavigate = (id: NavSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const sidebarContent = (isMobileDrawer: boolean) => {
    const isCompact = collapsed && !isMobileDrawer;

    return (
      <div className="flex h-full flex-col bg-sidebar text-ink">
        <div
          className={`flex h-16 shrink-0 items-center border-b border-line ${
            isCompact ? 'justify-center px-3' : 'justify-between px-5'
          }`}
        >
          <QuizClassLogo collapsed={isCompact} />
          {isMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-row-hover hover:text-ink"
              aria-label="إغلاق القائمة"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav aria-label="التنقل الرئيسي" className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = SECTION_ICONS[item.id];
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                title={isCompact ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors duration-150 ${
                  isCompact ? 'justify-center px-2' : 'text-start'
                } ${
                  isActive
                    ? 'bg-selected text-accent shadow-[inset_0_0_0_1px_var(--qc-selected-border)]'
                    : 'text-ink-muted hover:bg-row-hover hover:text-ink'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-primary dark:text-icon-soft'
                      : 'text-ink-muted group-hover:text-ink'
                  }`}
                />
                {!isCompact && <span className="truncate whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!isCompact && (
          <footer className="shrink-0 border-t border-line px-4 py-4">
            <div className="space-y-2 text-center text-xs">
              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="text-ink-muted">فكرة وإشراف</span>
                <span className="text-primary" aria-hidden="true">◆</span>
                <span className="font-extrabold text-primary">الأستاذ مصطفى</span>
              </div>
              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="text-ink-muted">مدرس الرياضيات</span>
                <span className="text-primary" aria-hidden="true">◆</span>
                <span className="font-semibold text-ink">إعدادية داقوق للبنين</span>
              </div>
              <div className="border-t border-line pt-3 text-[11px] text-ink-muted">
                جميع الحقوق محفوظة © {new Date().getFullYear()}
              </div>
            </div>
          </footer>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        className={`hidden shrink-0 border-e border-line transition-[width] duration-200 lg:block ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-backdrop backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 start-0 z-10 w-72 border-e border-line shadow-xl">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

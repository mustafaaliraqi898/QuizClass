import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  PlusCircle,
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
  teacher: TeacherProfile;
}

const SECTION_ICONS: Record<NavSectionId, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  'question-bank': BookOpen,
  'create-quiz': PlusCircle,
  quizzes: Trophy,
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
  teacher,
}: SidebarProps) {
  const handleNavigate = (id: NavSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const sidebarContent = (isMobileDrawer: boolean) => {
    const isCompact = collapsed && !isMobileDrawer;

    return (
      <div className="flex h-full flex-col justify-between bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div>
          <div
            className={`flex h-16 items-center border-b border-slate-200 dark:border-slate-800 ${
              isCompact ? 'justify-center px-3' : 'justify-between px-5'
            }`}
          >
            <QuizClassLogo collapsed={isCompact} />
            {isMobileDrawer && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="إغلاق القائمة"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <nav aria-label="التنقل الرئيسي" className="space-y-1.5 p-3">
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
                  className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isCompact ? 'justify-center px-2' : 'text-start'
                  } ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200'
                    }`}
                  />
                  {!isCompact && <span className="truncate whitespace-nowrap">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            aria-label="فتح إعدادات الحساب والمظهر"
            title={isCompact ? `${teacher.name} — الإعدادات` : undefined}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:bg-slate-800/80 ${
              isCompact ? 'justify-center' : ''
            }`}
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-indigo-50 text-sm font-bold text-indigo-700 dark:border-slate-700 dark:bg-indigo-950 dark:text-indigo-300">
              <span aria-hidden="true">خ</span>
              <img
                src={teacher.avatarPath}
                alt={teacher.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            {!isCompact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {teacher.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {teacher.school}
                </p>
              </div>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`hidden shrink-0 border-e border-slate-200 transition-[width] duration-200 lg:block dark:border-slate-800 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 start-0 z-10 w-72 border-e border-slate-200 shadow-xl dark:border-slate-800">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

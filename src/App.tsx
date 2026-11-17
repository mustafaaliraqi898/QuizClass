/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { QuickShortcuts } from './components/dashboard/QuickShortcuts';
import { RecentQuizzesSection } from './components/dashboard/RecentQuizzesSection';
import { StatsGrid } from './components/dashboard/StatsGrid';
import { WelcomeBanner } from './components/dashboard/WelcomeBanner';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { ModuleRoadmapView } from './components/sections/ModuleRoadmapView';
import { SettingsPreviewView } from './components/sections/SettingsPreviewView';
import {
  MODULE_ROADMAP,
  NAVIGATION_ITEMS,
  PREVIEW_METRICS,
  PREVIEW_RECENT_QUIZZES,
  QUICK_SHORTCUTS,
  TEACHER_PROFILE,
} from './data/previewDashboardData';
import { useTheme } from './hooks/useTheme';
import type { NavSectionId } from './types/dashboard';

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const currentNavItem = useMemo(
    () => NAVIGATION_ITEMS.find((item) => item.id === activeSection) ?? NAVIGATION_ITEMS[0],
    [activeSection]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar
          items={NAVIGATION_ITEMS}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          teacher={TEACHER_PROFILE}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            currentItem={currentNavItem}
            theme={theme}
            onToggleTheme={toggleTheme}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onNavigate={setActiveSection}
          />

          <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {activeSection === 'dashboard' && (
              <>
                <WelcomeBanner teacher={TEACHER_PROFILE} onNavigate={setActiveSection} />
                <StatsGrid metrics={PREVIEW_METRICS} />
                <QuickShortcuts shortcuts={QUICK_SHORTCUTS} onNavigate={setActiveSection} />
                <RecentQuizzesSection
                  quizzes={PREVIEW_RECENT_QUIZZES}
                  onNavigate={setActiveSection}
                />
              </>
            )}

            {activeSection === 'settings' && (
              <SettingsPreviewView
                theme={theme}
                onSetTheme={setTheme}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
                teacher={TEACHER_PROFILE}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection !== 'dashboard' && activeSection !== 'settings' && (
              <ModuleRoadmapView
                moduleInfo={MODULE_ROADMAP[activeSection]}
                onNavigate={setActiveSection}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

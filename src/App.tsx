/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState } from 'react';
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
  QUICK_SHORTCUTS,
} from './data/previewDashboardData';
import { useDashboardData } from './hooks/useDashboardData';
import { useSidebarPreference } from './hooks/useSidebarPreference';
import { useTheme } from './hooks/useTheme';
import type { NavSectionId } from './types/dashboard';

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { sidebarCollapsed, toggleSidebarCollapse } = useSidebarPreference();
  const { isPreviewData, teacher, metrics, recentQuizzes } = useDashboardData();

  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [sectionContextNote, setSectionContextNote] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleNavigate = useCallback((section: NavSectionId, contextNote?: string) => {
    setActiveSection(section);
    setSectionContextNote(contextNote);
  }, []);

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
          onSelectSection={(section) => handleNavigate(section)}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          teacher={teacher}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            currentItem={currentNavItem}
            theme={theme}
            onToggleTheme={toggleTheme}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapse={toggleSidebarCollapse}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onNavigate={(section) => handleNavigate(section)}
          />

          <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {activeSection === 'dashboard' && (
              <>
                <WelcomeBanner teacher={teacher} onNavigate={(section) => handleNavigate(section)} />
                <StatsGrid metrics={metrics} isPreviewData={isPreviewData} />
                <QuickShortcuts shortcuts={QUICK_SHORTCUTS} onNavigate={handleNavigate} />
                <RecentQuizzesSection
                  quizzes={recentQuizzes}
                  isPreviewData={isPreviewData}
                  onNavigate={(section) => handleNavigate(section)}
                />
              </>
            )}

            {activeSection === 'settings' && (
              <SettingsPreviewView
                theme={theme}
                onSetTheme={setTheme}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebarCollapse={toggleSidebarCollapse}
                teacher={teacher}
                onNavigate={(section) => handleNavigate(section)}
              />
            )}

            {activeSection !== 'dashboard' && activeSection !== 'settings' && (
              <ModuleRoadmapView
                moduleInfo={MODULE_ROADMAP[activeSection]}
                contextNote={sectionContextNote}
                onNavigate={(section) => handleNavigate(section)}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

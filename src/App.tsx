/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { QuickShortcuts } from './components/dashboard/QuickShortcuts';
import { RecentQuizzesSection } from './components/dashboard/RecentQuizzesSection';
import { StatsGrid } from './components/dashboard/StatsGrid';
import { WelcomeBanner } from './components/dashboard/WelcomeBanner';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { LiveLobbyView } from './components/live/LiveLobbyView';
import { LiveSessionConflictModal } from './components/live/LiveSessionConflictModal';
import { StudentJoinView } from './components/live/StudentJoinView';
import { QuestionBankView } from './components/question-bank/QuestionBankView';
import { CreateQuizView } from './components/quizzes/CreateQuizView';
import { QuizzesListView } from './components/quizzes/QuizzesListView';
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
import {
  httpLiveSessionService,
  LiveSessionConflictClientError,
} from './services/liveSessionService';
import type { NavSectionId } from './types/dashboard';
import type { TeacherLiveSessionDetails } from './types/liveSession';
import type { QuizRecord } from './types/quiz';

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const isStudentJoinRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/join' || window.location.pathname.startsWith('/join/'));

  const { sidebarCollapsed, toggleSidebarCollapse } = useSidebarPreference();
  const {
    isPreviewData,
    teacher,
    metrics,
    recentQuizzes,
    quizzesError,
    isLoading: isDashboardLoading,
    refreshDashboard,
  } = useDashboardData();

  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [sectionContextNote, setSectionContextNote] = useState<string | undefined>(undefined);
  const [openCreateQuestionSignal, setOpenCreateQuestionSignal] = useState(0);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizzesNotice, setQuizzesNotice] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [activeLiveSession, setActiveLiveSession] = useState<TeacherLiveSessionDetails | null>(
    null
  );
  const [launchingQuizId, setLaunchingQuizId] = useState<string | null>(null);
  const [liveLaunchError, setLiveLaunchError] = useState<string | null>(null);
  const [liveConflictSession, setLiveConflictSession] =
    useState<TeacherLiveSessionDetails | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const handleNavigate = useCallback(
    (section: NavSectionId, contextNote?: string, shortcutId?: string) => {
      setActiveSection(section);
      setSectionContextNote(contextNote);
      setLiveLaunchError(null);
      if (section === 'create-quiz') {
        setEditingQuizId(null);
      }
      if (section === 'question-bank' && shortcutId === 'shortcut-add-question') {
        setOpenCreateQuestionSignal((prev) => prev + 1);
      }
      if (section === 'dashboard') {
        void refreshDashboard();
      }
    },
    [refreshDashboard]
  );

  const handleEditQuiz = useCallback((quizId: string) => {
    setEditingQuizId(quizId);
    setActiveSection('create-quiz');
  }, []);

  const handleQuizSaved = useCallback(
    (savedQuiz: QuizRecord, wasEditing: boolean) => {
      setEditingQuizId(null);
      setQuizzesNotice(
        wasEditing
          ? `تم تحديث المسابقة «${savedQuiz.title}» وحفظ التعديلات في قاعدة البيانات المحلية.`
          : `تم حفظ المسابقة «${savedQuiz.title}» (${savedQuiz.questionCount} سؤالاً) بنجاح.`
      );
      setActiveSection('quizzes');
      void refreshDashboard();
    },
    [refreshDashboard]
  );

  const handleLaunchLiveQuiz = useCallback(
    async (quizId: string) => {
      setLaunchingQuizId(quizId);
      setLiveLaunchError(null);
      setConflictError(null);
      try {
        const session = await httpLiveSessionService.createSession(quizId);
        setActiveLiveSession(session);
        setActiveSection('live-session');
        void refreshDashboard();
      } catch (error) {
        if (error instanceof LiveSessionConflictClientError) {
          setLiveConflictSession(error.existingSession);
        } else {
          setLiveLaunchError(
            error instanceof Error
              ? error.message
              : 'تعذر بدء الجلسة المباشرة للمسابقة.'
          );
        }
      } finally {
        setLaunchingQuizId(null);
      }
    },
    [refreshDashboard]
  );

  const handleResumeConflictSession = useCallback((session: TeacherLiveSessionDetails) => {
    setActiveLiveSession(session);
    setLiveConflictSession(null);
    setConflictError(null);
    setActiveSection('live-session');
  }, []);

  const handleReplaceConflictSession = useCallback(
    async (existingSession: TeacherLiveSessionDetails) => {
      setIsResolvingConflict(true);
      setConflictError(null);
      try {
        await httpLiveSessionService.cancelSession(existingSession.id);
        const freshSession = await httpLiveSessionService.createSession(existingSession.quizId);
        setActiveLiveSession(freshSession);
        setLiveConflictSession(null);
        setActiveSection('live-session');
        void refreshDashboard();
      } catch (error) {
        setConflictError(
          error instanceof Error
            ? error.message
            : 'تعذر إلغاء الجلسة السابقة وبدء جلسة جديدة.'
        );
      } finally {
        setIsResolvingConflict(false);
      }
    },
    [refreshDashboard]
  );

  const currentNavItem = useMemo(
    () => NAVIGATION_ITEMS.find((item) => item.id === activeSection) ?? NAVIGATION_ITEMS[0],
    [activeSection]
  );

  if (isStudentJoinRoute) {
    return <StudentJoinView theme={theme} onToggleTheme={toggleTheme} />;
  }

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
            {liveLaunchError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-xs font-bold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{liveLaunchError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveLaunchError(null)}
                  aria-label="إغلاق التنبيه"
                  className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {activeSection === 'dashboard' && (
              <>
                <WelcomeBanner teacher={teacher} onNavigate={(section) => handleNavigate(section)} />
                <StatsGrid metrics={metrics} isPreviewData={isPreviewData} />
                <QuickShortcuts shortcuts={QUICK_SHORTCUTS} onNavigate={handleNavigate} />
                <RecentQuizzesSection
                  quizzes={recentQuizzes}
                  isLoading={isDashboardLoading}
                  errorMessage={quizzesError}
                  onRetry={() => void refreshDashboard()}
                  onNavigate={(section) => handleNavigate(section)}
                  onEditQuiz={handleEditQuiz}
                  onLaunchLive={(quizId) => void handleLaunchLiveQuiz(quizId)}
                />
              </>
            )}

            {activeSection === 'question-bank' && (
              <QuestionBankView
                openCreateSignal={openCreateQuestionSignal}
                onQuestionsChanged={() => void refreshDashboard()}
              />
            )}

            {activeSection === 'create-quiz' && (
              <CreateQuizView
                editingQuizId={editingQuizId}
                onSaved={handleQuizSaved}
                onCancel={() => {
                  setEditingQuizId(null);
                  setActiveSection('quizzes');
                }}
                onOpenQuestionBank={() => handleNavigate('question-bank')}
              />
            )}

            {activeSection === 'quizzes' && (
              <QuizzesListView
                externalNotice={quizzesNotice}
                onClearExternalNotice={() => setQuizzesNotice(null)}
                onCreateQuiz={() => handleNavigate('create-quiz')}
                onEditQuiz={handleEditQuiz}
                onLaunchLive={(quizId) => void handleLaunchLiveQuiz(quizId)}
                launchingQuizId={launchingQuizId}
                onQuizzesChanged={() => void refreshDashboard()}
              />
            )}

            {activeSection === 'live-session' && (
              <LiveLobbyView
                activeSession={activeLiveSession}
                onSessionUpdated={setActiveLiveSession}
                onLaunchQuiz={handleLaunchLiveQuiz}
                onNavigateQuizzes={() => handleNavigate('quizzes')}
                onNavigateCreateQuiz={() => handleNavigate('create-quiz')}
                onLifecycleChanged={() => void refreshDashboard()}
              />
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

            {activeSection === 'reports' && (
              <ModuleRoadmapView
                moduleInfo={MODULE_ROADMAP.reports}
                contextNote={sectionContextNote}
                onNavigate={(section) => handleNavigate(section)}
              />
            )}
          </main>
        </div>
      </div>

      <LiveSessionConflictModal
        existingSession={liveConflictSession}
        isResolving={isResolvingConflict}
        errorMessage={conflictError}
        onResumeExisting={handleResumeConflictSession}
        onReplaceSession={(session) => void handleReplaceConflictSession(session)}
        onCancel={() => {
          setLiveConflictSession(null);
          setConflictError(null);
        }}
      />
    </div>
  );
}

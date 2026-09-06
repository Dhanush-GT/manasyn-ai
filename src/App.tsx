import React, { useState, useEffect, useCallback } from 'react';
import { 
  signInWithGoogle, 
  signOutUser, 
  subscribeToAuth, 
  subscribeUserInteractions, 
  subscribeUserMilestones,
  injectDemoSandboxSessions,
  saveInteraction, 
  deleteInteraction 
} from './lib/firebase';
import type { UserProfile, ReflectionEntry, Milestone, ReflectionMode, AppView, ThemeSetting } from './types';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNavbar } from './components/BottomNavbar';
import { MobileDrawer } from './components/MobileDrawer';
import { SettingsView } from './components/SettingsView';
import { ReflectionWorkspace } from './components/ReflectionWorkspace';
import { MilestonesTrackerView } from './components/MilestonesTrackerView';
import { DashboardView } from './components/DashboardView';
import { PatternsView } from './components/PatternsView';
import { ExportView } from './components/ExportView';
import { LandingView } from './components/LandingView';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AdminDashboardView } from './components/AdminDashboardView';
import { FeedbackModal } from './components/FeedbackModal';
import { LocationsView } from './components/LocationsView';
import { ReflectionsListView } from './components/ReflectionsListView';
import { ManasynLogo } from './components/ManasynLogo';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Full-Page Routed View State
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [workspaceIntent, setWorkspaceIntent] = useState<ReflectionMode>('clear_mind');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Theme State (supporting light, dark, and system preference)
  const [themePreference, setThemePreference] = useState<ThemeSetting>(() => {
    const saved = localStorage.getItem('theme_preference') as ThemeSetting | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = localStorage.getItem('theme') as 'dark' | 'light' | null;
    return legacy || 'dark';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveDark = themePreference === 'system' ? systemPrefersDark : themePreference === 'dark';
  const theme = effectiveDark ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme_preference', themePreference);
    localStorage.setItem('theme', theme);
  }, [themePreference, effectiveDark, theme]);

  const toggleTheme = () => {
    setThemePreference((prev) => {
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  };

  // Subscribe to Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to User's Firestore Interactions & Milestones
  useEffect(() => {
    if (!user?.uid) {
      setEntries([]);
      setMilestones([]);
      setActiveEntryId(null);
      return;
    }

    setSyncStatus('syncing');
    const unsubscribeInteractions = subscribeUserInteractions(
      user.uid,
      (fetchedEntries) => {
        // Strip any unexpected empty documents from Firestore
        const validEntries = fetchedEntries.filter(
          (e) =>
            (e.messages && e.messages.length > 0) ||
            (e.tags && e.tags.length > 0) ||
            e.location ||
            (e.title && e.title !== 'New Reflection' && e.title !== 'Untitled Reflection')
        );
        setEntries(validEntries);
        setSyncStatus('synced');
        setSaveError(null);

        // Auto-select the first or newest entry if none is active
        if (validEntries.length > 0) {
          setActiveEntryId((prevId) => {
            const exists = validEntries.some((e) => e.id === prevId);
            return exists ? prevId : validEntries[0].id;
          });
        }
      },
      (err) => {
        console.error('Failed to sync entries from Firestore:', err);
        setSyncStatus('error');
        setSaveError('Failed to synchronize data with Cloud Firestore.');
      }
    );

    const unsubscribeMilestones = subscribeUserMilestones(
      user.uid,
      (fetchedMilestones) => {
        setMilestones(fetchedMilestones);
      },
      (err) => {
        console.error('Failed to sync milestones from Firestore:', err);
      }
    );

    return () => {
      unsubscribeInteractions();
      unsubscribeMilestones();
    };
  }, [user?.uid]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsAuthLoading(true);

    // Fallback safety timeout: guarantee loading state resets even if the popup is dismissed silently
    const safetyTimeout = setTimeout(() => {
      setIsAuthLoading(false);
    }, 20000);

    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      console.warn('Sign in response:', errorObj?.code || errorObj?.message);
      
      const isCancelled =
        errorObj?.code === 'auth/popup-closed-by-user' ||
        errorObj?.code === 'auth/cancelled-popup-request' ||
        errorObj?.code === 'auth/popup-blocked' ||
        (typeof errorObj?.message === 'string' &&
          (errorObj.message.includes('popup-closed-by-user') ||
           errorObj.message.includes('cancelled') ||
           errorObj.message.includes('closed by user')));

      if (isCancelled) {
        setAuthError('Sign-in was cancelled. Please try again.');
      } else {
        setAuthError(
          errorObj?.message && !errorObj.message.includes('Firebase')
            ? errorObj.message
            : 'Sign-in was cancelled. Please try again.'
        );
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
      setEntries([]);
      setMilestones([]);
      setActiveEntryId(null);
      setActiveView('dashboard');
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    }
  };

  const handleInjectDemoSandbox = async () => {
    if (!user?.uid) return;
    setSyncStatus('syncing');
    try {
      await injectDemoSandboxSessions(user.uid);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to inject demo sandbox data:', err);
      setSyncStatus('error');
      setSaveError('Failed to inject demo sandbox data.');
    }
  };

  // Prune any unsaved blank drafts whenever routing to other pages
  const handleViewChange = useCallback((newView: AppView) => {
    setEntries((prev) =>
      prev.filter(
        (e) =>
          (e.messages && e.messages.length > 0) ||
          (e.tags && e.tags.length > 0) ||
          e.location ||
          (e.title && e.title !== 'New Reflection' && e.title !== 'Untitled Reflection')
      )
    );
    setActiveView(newView);
  }, []);

  const handleQuickStartWithIntent = useCallback((intent: ReflectionMode, defaultTitle?: string) => {
    if (!user?.uid) return;
    setWorkspaceIntent(intent);

    // Reuse existing empty reflection if one exists
    const existingEmpty = entries.find(
      (e) => (!e.messages || e.messages.length === 0) && (!e.tags || e.tags.length === 0) && !e.location
    );
    if (existingEmpty) {
      if (defaultTitle && (existingEmpty.title === 'New Reflection' || existingEmpty.title === 'Untitled Reflection')) {
        const updated = { ...existingEmpty, title: defaultTitle, updatedAt: new Date().toISOString() };
        setEntries((prev) => prev.map((e) => (e.id === existingEmpty.id ? updated : e)));
      }
      setActiveEntryId(existingEmpty.id);
      setActiveView('workspace');
      return;
    }

    const newEntry: ReflectionEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: user.uid,
      title: defaultTitle || 'New Reflection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      tags: [],
      isPinned: false,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setActiveEntryId(newEntry.id);
    setActiveView('workspace');
    setSyncStatus('synced');
  }, [user?.uid, entries]);

  const handleCreateNewEntry = useCallback(() => {
    if (!user?.uid) return;

    // Check if an existing entry is already empty and uncommitted; reuse it instead of creating duplicates
    const existingEmpty = entries.find(
      (e) => (!e.messages || e.messages.length === 0) && (!e.tags || e.tags.length === 0) && !e.location
    );
    if (existingEmpty) {
      setActiveEntryId(existingEmpty.id);
      setActiveView('workspace');
      return;
    }

    const newEntry: ReflectionEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: user.uid,
      title: 'New Reflection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      tags: [],
      isPinned: false,
    };

    // Keep newly initialized reflection in local memory; do not persist empty document to database
    setEntries((prev) => [newEntry, ...prev]);
    setActiveEntryId(newEntry.id);
    setActiveView('workspace');
    setSyncStatus('synced');
  }, [user?.uid, entries]);

  const handleUpdateEntry = async (updatedEntry: ReflectionEntry) => {
    if (!user?.uid) return;

    // Optimistic UI update
    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );

    // Stop saving empty reflections to the database
    const isEmpty =
      (!updatedEntry.messages || updatedEntry.messages.length === 0) &&
      (!updatedEntry.tags || updatedEntry.tags.length === 0) &&
      !updatedEntry.location &&
      (!updatedEntry.title || updatedEntry.title === 'New Reflection' || updatedEntry.title === 'Untitled Reflection');

    if (isEmpty) {
      return;
    }

    setSyncStatus('syncing');

    try {
      await saveInteraction(user.uid, updatedEntry);
      setSyncStatus('synced');
      setSaveError(null);
    } catch (err: unknown) {
      console.error('Error saving interaction to Firestore:', err);
      setSyncStatus('error');
      setSaveError('Failed to update reflection in Firestore.');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user?.uid) return;

    const remaining = entries.filter((e) => e.id !== entryId);
    setEntries(remaining);
    if (activeEntryId === entryId) {
      setActiveEntryId(remaining.length > 0 ? remaining[0].id : null);
    }

    try {
      await deleteInteraction(user.uid, entryId);
    } catch (err: unknown) {
      console.error('Error deleting entry:', err);
      setSaveError('Failed to delete reflection from Firestore.');
    }
  };

  if (isAuthLoading) {
    return (
      <div id="loading-state-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="flex flex-col items-center justify-center gap-5 max-w-sm animate-in fade-in duration-300">
          <ManasynLogo size={48} variant="symbol" isDecorative />
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              Opening Manasyn...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-sans">
              Signing you in securely.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingView
          onSignIn={handleSignIn}
          isLoading={isAuthLoading}
          error={authError}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        />
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          user={user}
          onSignIn={handleSignIn}
        />
      </>
    );
  }

  const activeEntry = entries.find((e) => e.id === activeEntryId) || null;
  const mappedCount = entries.filter((e) => e.location?.latitude && e.location?.longitude).length;
  const validEntries = entries.filter((e) => (e.messages && e.messages.length > 0) || (e.tags && e.tags.length > 0) || e.location);

  return (
    <div id="app-root-layout" className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <Navbar
        user={user}
        activeView={activeView}
        onViewChange={handleViewChange}
        onNewEntry={handleCreateNewEntry}
        onToggleSidebar={() => {
          setIsMobileDrawerOpen((prev) => !prev);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Desktop Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onNewEntry={handleCreateNewEntry}
        user={user}
        milestonesCount={milestones.length}
        entriesCount={validEntries.length}
      />

      {/* Global Error Banner */}
      {saveError && (
        <div id="save-error-toast" className="fixed top-16 left-0 right-0 z-50 bg-rose-500 text-white text-xs px-4 py-2 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-white hover:underline text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main App Workspace with Responsive Left Margin for Desktop Sidebar */}
      <main id="main-content" className="flex-1 w-full min-w-0 pt-20 pb-24 lg:pb-12 min-h-screen px-3 sm:px-6 lg:pl-64">
        {activeView === 'dashboard' ? (
          <DashboardView
            user={user}
            entries={entries}
            milestones={milestones}
            onSelectEntry={(id) => {
              setActiveEntryId(id);
              handleViewChange('workspace');
            }}
            onQuickStartWithIntent={(intent, defaultTitle) => {
              handleQuickStartWithIntent(intent, defaultTitle);
            }}
            onViewAllReflections={() => handleViewChange('reflections')}
            onViewAllCommitments={() => handleViewChange('milestones')}
            onOpenSynthesis={() => handleViewChange('patterns')}
            onInjectDemoData={handleInjectDemoSandbox}
          />
        ) : activeView === 'reflections' ? (
          <ReflectionsListView
            entries={entries}
            onSelectEntry={(id) => {
              setActiveEntryId(id);
              handleViewChange('workspace');
            }}
            onNewEntry={handleCreateNewEntry}
            onDeleteEntry={handleDeleteEntry}
            onUpdateEntry={handleUpdateEntry}
            user={user}
          />
        ) : activeView === 'workspace' ? (
          <ReflectionWorkspace
            entry={activeEntry}
            user={user}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            isSaving={syncStatus === 'syncing'}
            initialMode={workspaceIntent}
            onOpenLocations={() => handleViewChange('locations')}
            onBackToReflections={() => handleViewChange('reflections')}
          />
        ) : activeView === 'milestones' ? (
          <MilestonesTrackerView
            userId={user.uid}
            milestones={milestones}
            entries={entries}
            onSelectEntry={(entryId) => {
              setActiveEntryId(entryId);
              handleViewChange('workspace');
            }}
            onOpenNewSession={handleCreateNewEntry}
            onInjectDemoData={handleInjectDemoSandbox}
          />
        ) : activeView === 'patterns' ? (
          <PatternsView
            entries={entries}
            user={user}
            onSelectEntry={(entryId) => {
              setActiveEntryId(entryId);
              handleViewChange('workspace');
            }}
            onNewReflection={handleCreateNewEntry}
            onBackToDashboard={() => handleViewChange('dashboard')}
          />
        ) : activeView === 'export' ? (
          <ExportView
            entries={entries}
            user={user}
            onBackToDashboard={() => handleViewChange('dashboard')}
            onEntryUpdated={(updated) => handleUpdateEntry(updated)}
          />
        ) : activeView === 'settings' ? (
          <SettingsView
            user={user}
            themePreference={themePreference}
            onSelectTheme={setThemePreference}
            onBackToJournal={() => handleViewChange('dashboard')}
            onSignOut={handleSignOut}
            onOpenExport={() => handleViewChange('export')}
            onOpenLocations={() => handleViewChange('locations')}
          />
        ) : activeView === 'admin-dashboard' ? (
          <AdminDashboardView
            user={user}
            entries={entries}
            onBackToApp={() => handleViewChange('dashboard')}
          />
        ) : (
          <LocationsView
            entries={entries}
            activeEntry={activeEntry}
            onSelectEntry={(entryId) => {
              setActiveEntryId(entryId);
              handleViewChange('workspace');
            }}
            onUpdateEntry={handleUpdateEntry}
            onNewReflectionAtPlace={(place) => {
              const newEntry: ReflectionEntry = {
                id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                userId: user.uid,
                title: `Reflection at ${place.placeName}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                location: place,
                messages: [],
                tags: ['place'],
                isPinned: true,
              };
              handleUpdateEntry(newEntry);
              setActiveEntryId(newEntry.id);
              handleViewChange('workspace');
            }}
            onOpenReflectionWorkspace={(entryId) => {
              if (entryId) setActiveEntryId(entryId);
              handleViewChange('workspace');
            }}
            user={user}
          />
        )}
      </main>

      {/* Admin RBAC Modal (for designated admin management) */}
      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        user={user}
        entries={entries}
      />

      {/* User Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        user={user}
      />

      {/* Mobile Drawer (Dedicated Profile, Settings, Export, Sign Out) */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        user={user}
        activeView={activeView}
        onNavigate={(view) => {
          handleViewChange(view);
          setIsMobileDrawerOpen(false);
        }}
        onOpenFeedback={() => {
          setIsFeedbackModalOpen(true);
          setIsMobileDrawerOpen(false);
        }}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavbar
        activeView={activeView}
        onViewChange={handleViewChange}
        onNewEntry={handleCreateNewEntry}
        milestonesCount={milestones.length}
      />
    </div>
  );
}

export default App;

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
import type { UserProfile, ReflectionEntry, Milestone, ReflectionMode, AppView } from './types';
import { Navbar } from './components/Navbar';
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

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    return saved || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
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
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      setAuthError(
        err instanceof Error ? err.message : 'Google authentication was cancelled or failed.'
      );
    } finally {
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
      setActiveView('reflections');
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
    setActiveView('reflections');
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
      setActiveView('reflections');
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
    setActiveView('reflections');
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
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
          Opening Your Journal...
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Securing authentication and private session
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingView
        onSignIn={handleSignIn}
        isLoading={isAuthLoading}
        error={authError}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const activeEntry = entries.find((e) => e.id === activeEntryId) || null;
  const mappedCount = entries.filter((e) => e.location?.latitude && e.location?.longitude).length;

  return (
    <div id="app-root-layout" className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Header: Strictly Brand Logo & Tagline (Left), Theme Toggle (Right), Hamburger on Mobile & Desktop */}
      <Navbar
        user={user}
        activeView={activeView}
        onViewChange={handleViewChange}
        onToggleSidebar={() => {
          setIsMobileDrawerOpen((prev) => !prev);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
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

      {/* Main App Workspace with Universal Viewport Padding */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto min-w-0 pt-20 pb-24 min-h-screen px-3 sm:px-6">
        {activeView === 'dashboard' ? (
          <DashboardView
            user={user}
            entries={entries}
            milestones={milestones}
            onSelectEntry={(id) => {
              setActiveEntryId(id);
              handleViewChange('reflections');
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
          <ReflectionWorkspace
            entry={activeEntry}
            user={user}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            isSaving={syncStatus === 'syncing'}
            initialMode={workspaceIntent}
            onOpenLocations={() => handleViewChange('locations')}
          />
        ) : activeView === 'milestones' ? (
          <MilestonesTrackerView
            userId={user.uid}
            milestones={milestones}
            entries={entries}
            onSelectEntry={(entryId) => {
              setActiveEntryId(entryId);
              handleViewChange('reflections');
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
              handleViewChange('reflections');
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
            theme={theme}
            onToggleTheme={toggleTheme}
            onBackToJournal={() => handleViewChange('dashboard')}
            onSignOut={handleSignOut}
            onOpenExport={() => handleViewChange('export')}
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
              handleViewChange('reflections');
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
                tags: ['sanctuary', 'spatial'],
                isPinned: true,
              };
              handleUpdateEntry(newEntry);
              setActiveEntryId(newEntry.id);
              handleViewChange('reflections');
            }}
            onOpenReflectionWorkspace={(entryId) => {
              if (entryId) setActiveEntryId(entryId);
              handleViewChange('reflections');
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

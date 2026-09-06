import React from 'react';
import { 
  X, 
  Settings, 
  Download, 
  LogOut, 
  Sun, 
  Moon, 
  ShieldCheck, 
  ChevronRight,
  MessageSquarePlus,
  BookOpen,
  Target,
  Brain,
  Compass,
  LayoutDashboard
} from 'lucide-react';
import { ManasynLogo } from './ManasynLogo';
import { UserProfile, AppView } from '../types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenFeedback?: () => void;
  onSignOut: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  user,
  activeView,
  onNavigate,
  onOpenFeedback,
  onSignOut,
  theme,
  onToggleTheme,
}) => {
  if (!isOpen) return null;

  const featureItems: { id: AppView; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Snapshot & insights overview', icon: LayoutDashboard },
    { id: 'reflections', label: 'Reflections', desc: 'Private cognitive journal', icon: BookOpen },
    { id: 'milestones', label: 'Commitments', desc: 'Action items & strategic milestones', icon: Target },
    { id: 'patterns', label: 'Patterns', desc: 'AI themes & cognitive synthesis', icon: Brain },
    { id: 'locations', label: 'Locations', desc: 'Spatial sanctuaries & focus pins', icon: Compass },
    { id: 'export', label: 'Export Data', desc: 'Download JSON, Markdown or sync', icon: Download },
  ];

  return (
    <div id="side-drawer-root">
      {/* Backdrop */}
      <div 
        id="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Drawer Panel: Grouped into Features and Account & Preferences */}
      <aside
        id="mobile-side-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation & Account Menu"
        className="fixed inset-y-0 left-0 z-[70] h-full w-4/5 max-w-sm bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 font-sans"
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <ManasynLogo size={28} variant="full" />
          <button
            id="close-mobile-drawer-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close menu"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* SECTION 1: Features */}
          <div className="space-y-2">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Features
            </p>
            <div className="space-y-1">
              {featureItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id || (item.id === 'locations' && activeView === 'spatial-map');
                return (
                  <button
                    key={item.id}
                    id={`mobile-drawer-link-${item.id}`}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all border ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block">{item.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{item.desc}</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Account & Preferences */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Account & Preferences
            </p>

            {/* User Profile Card */}
            <div 
              id="drawer-user-info-card"
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 space-y-2"
            >
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profile photo'}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl border border-indigo-200 dark:border-indigo-800 object-cover shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold font-sans shadow-xs shrink-0">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user.displayName || 'Journaler'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate select-all">
                    {user.email || 'Private Account'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 font-sans">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Google Auth Verified</span>
                </span>
              </div>
            </div>

            {/* Account Action Buttons */}
            <div className="space-y-1">
              {/* Profile & Settings */}
              <button
                id="drawer-nav-settings-btn"
                type="button"
                onClick={() => {
                  onNavigate('settings');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all border ${
                  activeView === 'settings'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span>Profile & Settings</span>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">Account & AI preferences</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Send Feedback */}
              {onOpenFeedback && (
                <button
                  id="drawer-nav-feedback-btn"
                  type="button"
                  onClick={() => {
                    onOpenFeedback();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border border-transparent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <MessageSquarePlus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span>Send Feedback</span>
                      <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">Suggestions or bug reports</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {/* Theme Toggle */}
              <button
                id="drawer-toggle-theme-btn"
                type="button"
                onClick={onToggleTheme}
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  <div className="text-left">
                    <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400 capitalize">{theme} mode active</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {theme}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Sign Out */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <button
            id="drawer-sign-out-btn"
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
};

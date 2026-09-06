import React, { useEffect } from 'react';
import { 
  X, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  ChevronRight,
  MessageSquarePlus,
  BookOpen,
  Target,
  Brain,
  Home
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
  // Lock body scroll when mobile drawer is open to prevent double scrollbars
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const primaryNavItems: { 
    id: AppView; 
    label: string; 
    desc: string; 
    icon: React.ComponentType<{ className?: string }> 
  }[] = [
    { 
      id: 'dashboard', 
      label: 'Home', 
      desc: 'Your reflections and progress at a glance', 
      icon: Home 
    },
    { 
      id: 'reflections', 
      label: 'Reflections', 
      desc: 'Your conversations and moments of clarity', 
      icon: BookOpen 
    },
    { 
      id: 'milestones', 
      label: 'Commitments', 
      desc: 'The next steps you choose to remember', 
      icon: Target 
    },
    { 
      id: 'patterns', 
      label: 'Patterns', 
      desc: 'Themes and changes across your reflections', 
      icon: Brain 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      desc: 'Account, privacy and personalization', 
      icon: Settings 
    },
  ];

  return (
    <div id="side-drawer-root">
      {/* Blurred Backdrop Overlay - auto closes drawer on click */}
      <div 
        id="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Drawer Panel: Primary Calm Navigation & Account */}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* PRIMARY NAVIGATION ITEMS */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">
              Menu
            </p>
            <div className="space-y-1">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`mobile-drawer-link-${item.id}`}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all border ${
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
                        <span className="block font-semibold text-xs">{item.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 leading-tight block">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACCOUNT & PREFERENCES */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Account
            </p>

            {/* User Profile Card */}
            <div 
              id="drawer-user-info-card"
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 space-y-2"
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
                    {user.displayName || 'Personal Journal'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[200px] select-all">
                    {user.email || 'Private Account'}
                  </p>
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                Signed in with Google
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="space-y-1">
              {/* Send Feedback */}
              {onOpenFeedback && (
                <button
                  id="drawer-nav-feedback-btn"
                  type="button"
                  onClick={() => {
                    onOpenFeedback();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border border-transparent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <MessageSquarePlus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block font-semibold">Send Feedback</span>
                      <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        Share an idea or report a problem
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}

              {/* Appearance Toggle */}
              <button
                id="drawer-toggle-theme-btn"
                type="button"
                onClick={onToggleTheme}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <div className="text-left">
                    <span className="block font-semibold">Appearance</span>
                    <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      {theme === 'dark' ? 'Dark theme' : 'Light theme'}
                    </p>
                  </div>
                </div>
                <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 shrink-0 ${
                  theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
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

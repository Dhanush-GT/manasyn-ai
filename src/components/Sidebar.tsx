import React from 'react';
import { 
  Home, 
  BookOpen, 
  Target, 
  Brain, 
  Settings
} from 'lucide-react';
import type { AppView, UserProfile } from '../types';

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  onNewEntry?: () => void;
  user: UserProfile;
  milestonesCount?: number;
  entriesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  user,
  milestonesCount = 0,
  entriesCount = 0,
}) => {
  const navItems: {
    id: AppView;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
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
      icon: BookOpen, 
      badge: entriesCount > 0 ? entriesCount : undefined 
    },
    { 
      id: 'milestones', 
      label: 'Commitments', 
      desc: 'The next steps you choose to remember', 
      icon: Target, 
      badge: milestonesCount > 0 ? milestonesCount : undefined 
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
    <aside
      id="desktop-left-sidebar"
      className="hidden lg:flex flex-col w-64 fixed left-0 top-16 bottom-0 z-40 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 select-none transition-colors"
      aria-label="Desktop Primary Navigation"
    >
      {/* Primary Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3.5 py-5 space-y-1">
        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2.5">
          Menu
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              id={`desktop-sidebar-nav-${item.id}`}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all border text-left ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display tracking-tight text-xs font-bold truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold font-sans ${
                          isActive
                            ? 'bg-indigo-200/70 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* User Profile Info Card in Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
        <div 
          onClick={() => onViewChange('settings')}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          title="Account, privacy and personalization"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User Profile'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg border border-indigo-200 dark:border-indigo-800 object-cover shadow-xs shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold font-sans shadow-xs shrink-0">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user.displayName || 'Personal Journal'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
              Signed in with Google
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

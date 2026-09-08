import React from 'react';
import { 
  Menu, 
  Sun, 
  Moon, 
  Plus
} from 'lucide-react';
import { ManasynLogo } from './ManasynLogo';
import { PWAInstallButton } from './PWAInstallButton';
import type { UserProfile, AppView } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onNewEntry?: () => void;
  onSignOut?: () => void;
  activeView?: AppView;
  onViewChange?: (view: AppView) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onToggleSidebar?: () => void;
  onToggleSidebarMobile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onNewEntry,
  onViewChange,
  theme = 'dark',
  onToggleTheme,
  onToggleSidebar,
  onToggleSidebarMobile,
}) => {
  return (
    <header 
      id="main-navbar" 
      className="fixed top-0 inset-x-0 z-50 h-16 backdrop-blur-md bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between"
    >
      {/* Left: Mobile Hamburger & Brand Logo & Tagline */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {user && (
          <button
            id="nav-sidebar-toggle-btn"
            type="button"
            onClick={onToggleSidebar || onToggleSidebarMobile}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors shrink-0 flex items-center justify-center"
            aria-label="Toggle Navigation Menu"
            title="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div 
          onClick={() => onViewChange?.('dashboard')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          title="Go to Home Dashboard"
        >
          <ManasynLogo size={32} variant="full" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-sans border-l border-slate-200 dark:border-slate-800 pl-3 ml-1 hidden md:inline select-none">
            Talk freely. Find clarity. Move forward.
          </span>
        </div>
      </div>

      {/* Right: Install App Button, + New Reflection Button (Desktop) & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <PWAInstallButton compact />

        {user && onNewEntry && (
          <button
            id="header-new-reflection-btn"
            type="button"
            onClick={onNewEntry}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Start a new reflection"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Reflection</span>
          </button>
        )}

        {onToggleTheme && (
          <button
            id="nav-theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};

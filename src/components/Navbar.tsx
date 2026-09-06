import React from 'react';
import { 
  Menu, 
  Sun, 
  Moon, 
} from 'lucide-react';
import { ManasynLogo } from './ManasynLogo';
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
      {/* Left: Hamburger (Collapsible Sidebar toggle) + Brand Logo & Desktop Tagline */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {user && (
          <button
            id="nav-sidebar-toggle-btn"
            type="button"
            onClick={onToggleSidebar || onToggleSidebarMobile}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors shrink-0 flex items-center justify-center"
            aria-label="Toggle Navigation Sidebar"
            title="Toggle navigation sidebar"
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

      {/* Right: Theme Toggle ONLY */}
      <div className="flex items-center gap-2 shrink-0">
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



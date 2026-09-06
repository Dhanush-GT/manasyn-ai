import React from 'react';
import { Home, MessageSquare, Target, Plus, Brain } from 'lucide-react';
import type { AppView } from '../types';

interface BottomNavbarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  onNewEntry: () => void;
  milestonesCount?: number;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  activeView,
  onViewChange,
  onNewEntry,
  milestonesCount = 0,
}) => {
  return (
    <nav
      id="mobile-bottom-navbar"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800"
      aria-label="Universal Mobile Navigation"
    >
      <div className="relative flex items-center justify-between h-full max-w-md mx-auto px-2">
        {/* Left Action Cluster (Home, Reflections) */}
        <div className="flex items-center justify-around flex-1">
          {/* Home Button */}
          <button
            id="bottom-nav-home"
            type="button"
            onClick={() => onViewChange('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'dashboard'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans tracking-tight">Home</span>
          </button>

          {/* Reflections Button */}
          <button
            id="bottom-nav-reflections"
            type="button"
            onClick={() => onViewChange('reflections')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'reflections'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans tracking-tight">Reflections</span>
          </button>
        </div>

        {/* Center: Prominent Floating Action Button (New Reflection) */}
        <div className="flex items-center justify-center px-2 shrink-0">
          <button
            id="bottom-nav-new-entry"
            type="button"
            onClick={onNewEntry}
            className="-translate-y-4 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/40 ring-4 ring-slate-50 dark:ring-slate-950 active:scale-90 hover:scale-105 transition-all group"
            title="Create New Reflection"
            aria-label="Create New Reflection"
          >
            <Plus className="w-6 h-6 stroke-[2.75] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        {/* Right Action Cluster (Commitments, Patterns) */}
        <div className="flex items-center justify-around flex-1">
          {/* Commitments Button */}
          <button
            id="bottom-nav-commitments"
            type="button"
            onClick={() => onViewChange('milestones')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
              activeView === 'milestones'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Target className="w-5 h-5" />
              {milestonesCount > 0 && (
                <span className="absolute -top-1 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {milestonesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-sans tracking-tight">Commitments</span>
          </button>

          {/* Patterns Button */}
          <button
            id="bottom-nav-patterns"
            type="button"
            onClick={() => onViewChange('patterns')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'patterns'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-sans tracking-tight">Patterns</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

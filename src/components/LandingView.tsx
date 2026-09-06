import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  ShieldCheck, 
  Share2, 
  Lock, 
  ArrowRight, 
  Terminal, 
  Layers, 
  CheckCircle2, 
  Compass,
  Cpu,
  BrainCircuit,
  Zap,
  Sun,
  Moon
} from 'lucide-react';
import { ManasynLogo } from './ManasynLogo';

interface LandingViewProps {
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  isLoading,
  error,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <div id="landing-page-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white transition-colors">
      {/* Top Brand Nav */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex items-center justify-between border-b border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <ManasynLogo size={36} variant="full" />

        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <button
              id="landing-theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          )}

          <button
            id="landing-top-signin-btn"
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-12 text-center space-y-8 my-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900/90 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 text-xs font-sans shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Conversational Clarity &middot; Commitment Tracking &middot; Private & Isolated</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display leading-[1.15]">
          Talk freely. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-300 dark:via-violet-300 dark:to-purple-300">
            Find clarity. Move forward.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-sans">
          A calm conversational journal powered by Gemini. Reflect on your thoughts, untangle complex decisions, extract concrete commitments, and discover long-term patterns in your personal journey.
        </p>

        {error && (
          <div className="p-3 max-w-md mx-auto bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Primary CTA Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            id="landing-hero-signin-btn"
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        </div>

        {/* The Meaning of Manasyn Brand Explanation Section */}
        <section 
          id="landing-brand-meaning-section" 
          className="max-w-2xl mx-auto my-10 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                The Meaning of Manasyn
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans italic">
                (Pronounced: <span className="font-medium not-italic font-mono text-indigo-600 dark:text-indigo-400">MAN-uh-sin</span>)
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs sm:text-sm font-sans text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
              <p>
                <strong className="font-semibold text-slate-900 dark:text-white">Manas:</strong> Represents mind, thought, perception, and inner awareness.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
              <p>
                <strong className="font-semibold text-slate-900 dark:text-white">Syn:</strong> Represents synthesis, synchronization, and connection.
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-sans leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800/80">
            Manasyn is the space where scattered thoughts synchronize into clear progress.
          </p>
        </section>

        {/* Feature Highlights Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left pt-6">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Conversational Clarity
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Express raw stream-of-consciousness thoughts with guided conversational clarity and action steps.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Patterns & Journey
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Notice themes across your reflections, recurring mood patterns, and personal growth.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Private by Design
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Private by Design: Owner-scoped access controls ensure you alone can access your journal.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Commitment Tracking
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Seamlessly turn conversational insights into trackable milestones with deadlines and progress states.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-slate-200 dark:border-slate-900 text-center text-xs text-slate-500 font-sans">
        <p>Manasyn &bull; Personal Gemini Journal &bull; Powered by Google Cloud &bull; Cloud Firestore</p>
      </footer>
    </div>
  );
};

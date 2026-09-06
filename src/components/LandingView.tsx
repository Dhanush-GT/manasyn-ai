import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  BrainCircuit,
  Sun,
  Moon,
  X,
  FileText,
  Download,
  Mail
} from 'lucide-react';
import { ManasynLogo } from './ManasynLogo';

interface LandingViewProps {
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenFeedback: () => void;
}

type ModalType = 'privacy' | 'terms' | 'data-controls' | null;

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  isLoading,
  error,
  theme = 'dark',
  onToggleTheme,
  onOpenFeedback,
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const scrollToFeatures = () => {
    const el = document.getElementById('core-features-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="landing-page-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white transition-colors">
      {/* 1. Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <ManasynLogo size={36} variant="full" />

        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <button
              id="landing-theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
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
            <span>Sign in</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Flow */}
      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16 w-full space-y-16">
        
        {/* 2. Hero & Sign In */}
        <section className="text-center space-y-8 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-sans shadow-xs">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Conversational Clarity &middot; Meaningful Patterns &middot; Private by Design</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-display leading-[1.15]">
            Talk freely. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-300 dark:via-violet-300 dark:to-purple-300">
              Find clarity. Move forward.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed font-sans">
            A calm conversational journal powered by Gemini. Talk through your thoughts, untangle difficult decisions, capture the next steps you choose, and notice meaningful patterns over time.
          </p>

          {error && (
            <div className="p-3 max-w-md mx-auto bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Primary CTA & Secondary CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              id="landing-hero-signin-btn"
              type="button"
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold text-base shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>

            <button
              id="landing-how-it-works-btn"
              type="button"
              onClick={scrollToFeatures}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              See how it works
            </button>
          </div>
        </section>

        {/* 3. Core Benefit Cards */}
        <section id="core-features-section" className="space-y-6 pt-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 font-display">
              Designed for thoughtful clarity
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-sans">
              Three core capabilities to turn unstructured thoughts into forward momentum.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Conversational Clarity Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Conversational Clarity
              </h3>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Talk freely about what’s on your mind. Manasyn asks thoughtful follow-ups and helps you reach a clearer understanding.
              </p>
            </div>

            {/* Meaningful Patterns Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Meaningful Patterns
              </h3>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Notice recurring themes, changes in perspective, and the progress that matters to you over time.
              </p>
            </div>

            {/* Commitment Tracking Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Commitment Tracking
              </h3>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Save the next steps you choose during a reflection and return to them when you’re ready.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Private by Design Section */}
        <section id="landing-privacy-section" className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50">
                  Private by Design
                </h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Account protected
                </span>
              </div>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Access controls are designed so each signed-in user can access only their own journal. Selected content may be processed by Gemini to provide AI features.
              </p>
            </div>
          </div>
        </section>

        {/* 5. The Meaning of Manasyn */}
        <section 
          id="landing-brand-meaning-section" 
          className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 font-display">
                The Meaning of Manasyn
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans italic">
                (Pronounced: <span className="font-medium not-italic font-mono text-indigo-600 dark:text-indigo-400">MAN-uh-sin</span>)
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-sm sm:text-base font-sans text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
              <p>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">Manas:</strong> Represents mind, thought, perception, and inner awareness.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
              <p>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">Syn:</strong> Represents synthesis, synchronization, and connection.
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-sans leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800/80">
            Manasyn is the space where scattered thoughts synchronize into clear progress.
          </p>
        </section>

      </main>

      {/* 6. Footer & Trust Elements */}
      <footer className="px-6 py-10 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xs text-center space-y-4 font-sans">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-xl mx-auto">
          Your reflections are private to your account. Export or delete your data at any time.
        </p>
        
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Built with Gemini and Google Cloud
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 pt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <button 
            id="landing-footer-privacy-btn"
            type="button" 
            onClick={() => setActiveModal('privacy')} 
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium underline-offset-4 hover:underline"
          >
            Privacy
          </button>
          <button 
            id="landing-footer-terms-btn"
            type="button" 
            onClick={() => setActiveModal('terms')} 
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium underline-offset-4 hover:underline"
          >
            Terms
          </button>
          <button 
            id="landing-footer-data-controls-btn"
            type="button" 
            onClick={() => setActiveModal('data-controls')} 
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium underline-offset-4 hover:underline"
          >
            Data Controls
          </button>
          <button 
            id="landing-footer-contact-btn"
            type="button" 
            onClick={onOpenFeedback} 
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium underline-offset-4 hover:underline"
          >
            Contact
          </button>
        </div>
      </footer>

      {/* Functional Disclosure Modals */}
      {activeModal && (
        <div 
          id={`landing-${activeModal}-modal-backdrop`}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            id={`landing-${activeModal}-modal-card`}
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                  {activeModal === 'privacy' && <ShieldCheck className="w-5 h-5" />}
                  {activeModal === 'terms' && <FileText className="w-5 h-5" />}
                  {activeModal === 'data-controls' && <Download className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-display">
                    {activeModal === 'privacy' && 'Privacy Disclosure'}
                    {activeModal === 'terms' && 'Terms of Service'}
                    {activeModal === 'data-controls' && 'Data Controls & Ownership'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manasyn Personal Conversational Journal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
              {activeModal === 'privacy' && (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Account-Level Isolation
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      Access controls are designed so each signed-in user can access only their own journal. Your reflections, commitments, and tags are bound to your verified Google account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      AI Processing Boundaries
                    </h4>
                    <p className="text-xs sm:text-sm">
                      Selected content may be processed by Gemini to provide conversational reflections, prompt suggestions, and pattern synthesis. We do not use your private reflections to train third-party public models.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Zero Sale of Personal Data
                    </h4>
                    <p className="text-xs sm:text-sm">
                      Manasyn does not monetize user data, display behavioral advertisements, or sell personal reflections to data brokers.
                    </p>
                  </div>
                </>
              )}

              {activeModal === 'terms' && (
                <>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Personal Journaling Platform
                    </h4>
                    <p className="text-xs sm:text-sm">
                      Manasyn is provided as a conversational tool to help you reflect on thoughts, decisions, and goals. You retain full ownership and copyright of all journal entries you author.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1 text-xs sm:text-sm">
                    <p className="font-semibold">Important Health & Safety Notice</p>
                    <p>
                      Manasyn is an AI-powered conversational reflection assistant, not a licensed healthcare provider, medical service, or crisis intervention platform. If you are experiencing a mental health emergency, please contact local emergency services or professional crisis support.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Acceptable Use
                    </h4>
                    <p className="text-xs sm:text-sm">
                      You agree not to use Manasyn to store unlawful materials, attempt to breach security perimeters, or bypass owner-level access controls.
                    </p>
                  </div>
                </>
              )}

              {activeModal === 'data-controls' && (
                <>
                  <p>
                    You retain total ownership of your journal data. Manasyn gives you complete autonomy over your reflections:
                  </p>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">Full Data Export</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Export all your conversations, commitments, and metadata in clean JSON or formatted Markdown files at any time from the Export section.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">Granular & Account Deletion</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Delete individual reflection entries anytime, or permanently erase your entire account and all cloud database records from Profile & Settings.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              {activeModal === 'data-controls' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onSignIn();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span>Sign in to manage your data</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



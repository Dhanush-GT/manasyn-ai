import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  ShieldCheck, 
  Sliders, 
  Moon, 
  Sun, 
  Download, 
  LogOut, 
  ArrowLeft, 
  Sparkles, 
  Check, 
  Bell, 
  Mic, 
  Lock, 
  FileText
} from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsViewProps {
  user: UserProfile;
  onSignOut: () => void;
  onBackToJournal: () => void;
  onOpenExport?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onSignOut,
  onBackToJournal,
  onOpenExport,
  theme,
  onToggleTheme,
}) => {
  // Journal Preferences state with localStorage persistence
  const [defaultIntent, setDefaultIntent] = useState<string>(() => {
    return localStorage.getItem('pref_default_intent') || 'clear_mind';
  });
  const [reflectionTone, setReflectionTone] = useState<string>(() => {
    return localStorage.getItem('pref_reflection_tone') || 'calm';
  });
  const [voiceInputEnabled, setVoiceInputEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pref_voice_input') !== 'false';
  });
  const [dailyReminder, setDailyReminder] = useState<boolean>(() => {
    return localStorage.getItem('pref_daily_reminder') === 'true';
  });
  const [timeFormat, setTimeFormat] = useState<string>(() => {
    return localStorage.getItem('pref_time_format') || '12h';
  });
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    localStorage.setItem('pref_default_intent', defaultIntent);
    localStorage.setItem('pref_reflection_tone', reflectionTone);
    localStorage.setItem('pref_voice_input', String(voiceInputEnabled));
    localStorage.setItem('pref_daily_reminder', String(dailyReminder));
    localStorage.setItem('pref_time_format', timeFormat);
    
    setIsSavedNotice(true);
    const timer = setTimeout(() => setIsSavedNotice(false), 2000);
    return () => clearTimeout(timer);
  }, [defaultIntent, reflectionTone, voiceInputEnabled, dailyReminder, timeFormat]);

  return (
    <div 
      id="profile-settings-view" 
      className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-y-auto pb-28 md:pb-8"
    >
      {/* Top Banner */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="settings-back-btn"
              type="button"
              onClick={onBackToJournal}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Return to Reflections"
              aria-label="Return to Reflections"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <span>Profile & Settings</span>
                <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                  Account
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                Manage your profile, authentication, and conversational journal preferences.
              </p>
            </div>
          </div>

          {isSavedNotice && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-300 dark:border-emerald-800 animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5" />
              <span>Preferences saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* User Profile Card */}
        <section 
          id="user-profile-card" 
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>User Profile & Identity</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authenticated</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profile photo'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 object-cover shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl font-bold font-sans shadow-sm shrink-0">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            )}

            <div className="space-y-1 flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {user.displayName || 'Manasyn Journaler'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-sans">
                <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-semibold text-slate-900 dark:text-slate-200 select-all truncate">
                  {user.email || 'Private Account'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans pt-0.5">
                Connected via Google Federated Authentication &bull; User ID: <span className="font-mono text-[10px] select-all">{user.uid}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0">
              <button
                id="profile-sign-out-btn"
                type="button"
                onClick={onSignOut}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </section>

        {/* Journal Preferences Section */}
        <section 
          id="journal-preferences-card" 
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Journal Preferences</span>
            </div>
            <span className="text-[11px] text-slate-400 font-sans">Customizes AI Prompts</span>
          </div>

          <div className="space-y-4">
            {/* Default Reflection Intent */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">
                Default Reflection Intent
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the default conversational frame applied when creating a new reflection session.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {[
                  { id: 'clear_mind', label: 'Clear my mind', desc: 'Raw stream untangling and cognitive offloading' },
                  { id: 'make_decision', label: 'Make a decision', desc: 'Weighing trade-offs and clarity evaluation' },
                  { id: 'capture_idea', label: 'Capture an idea', desc: 'Fleshing out creative thoughts and concepts' },
                  { id: 'plan_next_step', label: 'Plan next step', desc: 'Deriving immediate concrete actions' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDefaultIntent(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      defaultIntent === opt.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-slate-900 dark:text-white ring-1 ring-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {defaultIntent === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Reflection Tone */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">
                AI Assistant Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'calm', label: 'Calm & Grounding' },
                  { id: 'action', label: 'Action-Oriented' },
                  { id: 'socratic', label: 'Socratic Inquiry' },
                ].map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setReflectionTone(tone.id)}
                    className={`py-2 px-3 rounded-xl border text-center text-xs font-semibold transition-all ${
                      reflectionTone === tone.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Input, Time Format & Check-in toggles */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-3.5">
              {/* Voice Input Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Voice-to-Text Microphone Capture</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Enables microphone transcription button in reflection prompts</p>
                </div>
                <button
                  id="settings-voice-toggle-btn"
                  type="button"
                  onClick={() => setVoiceInputEnabled(!voiceInputEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 min-w-[44px] ${
                    voiceInputEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title="Toggle Voice-to-Text"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      voiceInputEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Time Format Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Time Format (12h / 24h)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Display timestamp headers in {timeFormat === '24h' ? '24-hour format (e.g. 14:30)' : '12-hour AM/PM format (e.g. 2:30 PM)'}
                  </p>
                </div>
                <button
                  id="settings-time-format-toggle-btn"
                  type="button"
                  onClick={() => setTimeFormat(timeFormat === '12h' ? '24h' : '12h')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 min-w-[44px] ${
                    timeFormat === '24h' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title={`Switch to ${timeFormat === '12h' ? '24-hour' : '12-hour'} format`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      timeFormat === '24h' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Daily Reminder Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Daily Reflection Reminder</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Gentle evening notification prompt for mindful cognitive reset</p>
                </div>
                <button
                  id="settings-reminder-toggle-btn"
                  type="button"
                  onClick={() => setDailyReminder(!dailyReminder)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 min-w-[44px] ${
                    dailyReminder ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title="Toggle Daily Reminder"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      dailyReminder ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Display & Privacy Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Appearance */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Theme & Appearance</span>
              <span className="text-[11px] text-slate-500 font-sans capitalize">{theme} Mode</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle between high-contrast light slate canvas and focus-safe deep dark mode.
            </p>
            <button
              id="settings-theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Switch to Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span>Switch to Dark Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Privacy & Cloud Storage */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Data Privacy & Export</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">Protected</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All reflections and commitments are isolated to your authenticated Google account.
            </p>
            {onOpenExport && (
              <button
                id="settings-export-data-btn"
                type="button"
                onClick={onOpenExport}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-indigo-500" />
                <span>Export Journal Archive (.json / .md)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

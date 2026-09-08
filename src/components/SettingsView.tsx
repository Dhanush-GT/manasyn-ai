import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Mail, 
  Sliders, 
  Moon, 
  Sun, 
  Laptop, 
  Download, 
  LogOut, 
  ArrowLeft, 
  Check, 
  Compass, 
  Database, 
  MapPin, 
  Mic, 
  Clock, 
  Bell, 
  Trash2, 
  AlertTriangle, 
  Copy, 
  CheckCheck, 
  Shield, 
  ExternalLink,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { 
  UserProfile, 
  ThemeSetting, 
  TimeFormatSetting, 
  ReflectionIntentSetting, 
  ReflectionToneSetting,
  ReminderConfig,
  UserPreferences 
} from '../types';
import { 
  saveUserPreferences, 
  getUserPreferences, 
  deleteUserAccountAndData 
} from '../lib/firebase';

interface SettingsViewProps {
  user: UserProfile;
  onSignOut: () => void;
  onBackToJournal: () => void;
  onOpenExport?: () => void;
  onOpenLocations?: () => void;
  themePreference: ThemeSetting;
  onSelectTheme: (theme: ThemeSetting) => void;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'M', full: 'Mon' },
  { id: 2, label: 'T', full: 'Tue' },
  { id: 3, label: 'W', full: 'Wed' },
  { id: 4, label: 'T', full: 'Thu' },
  { id: 5, label: 'F', full: 'Fri' },
  { id: 6, label: 'S', full: 'Sat' },
  { id: 0, label: 'S', full: 'Sun' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onSignOut,
  onBackToJournal,
  onOpenExport,
  onOpenLocations,
  themePreference,
  onSelectTheme,
}) => {
  // Detected timezone
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // State initialized from localStorage
  const [defaultIntent, setDefaultIntent] = useState<ReflectionIntentSetting>(() => {
    const saved = localStorage.getItem('pref_default_intent') as ReflectionIntentSetting | null;
    return saved || 'clear_mind';
  });

  const [reflectionTone, setReflectionTone] = useState<ReflectionToneSetting>(() => {
    const saved = localStorage.getItem('pref_reflection_tone') as ReflectionToneSetting | null;
    return saved || 'calm';
  });

  const [voiceInputEnabled, setVoiceInputEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pref_voice_input') !== 'false';
  });

  const [timeFormat, setTimeFormat] = useState<TimeFormatSetting>(() => {
    const saved = localStorage.getItem('pref_time_format') as TimeFormatSetting | null;
    return saved || 'system';
  });

  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pref_reminder_enabled') === 'true';
  });

  const [reminderTime, setReminderTime] = useState<string>(() => {
    return localStorage.getItem('pref_reminder_time') || '20:00';
  });

  const [reminderDays, setReminderDays] = useState<number[]>(() => {
    const saved = localStorage.getItem('pref_reminder_days');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [1, 2, 3, 4, 5, 6, 0];
  });

  const [reminderTimezone, setReminderTimezone] = useState<string>(() => {
    return localStorage.getItem('pref_reminder_timezone') || detectedTimezone;
  });

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [copiedSupportId, setCopiedSupportId] = useState(false);
  const [testNotificationToast, setTestNotificationToast] = useState<string | null>(null);

  // Deletion Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync initial state from Firestore if available
  const isInitialMount = useRef(true);
  useEffect(() => {
    let isMounted = true;
    if (user?.uid) {
      getUserPreferences(user.uid).then((cloudPrefs) => {
        if (!isMounted || !cloudPrefs) return;
        if (cloudPrefs.defaultIntent) setDefaultIntent(cloudPrefs.defaultIntent);
        if (cloudPrefs.reflectionTone) setReflectionTone(cloudPrefs.reflectionTone);
        if (typeof cloudPrefs.voiceInputEnabled === 'boolean') setVoiceInputEnabled(cloudPrefs.voiceInputEnabled);
        if (cloudPrefs.timeFormat) setTimeFormat(cloudPrefs.timeFormat);
        if (cloudPrefs.theme) onSelectTheme(cloudPrefs.theme);
        if (cloudPrefs.reminder) {
          setReminderEnabled(cloudPrefs.reminder.enabled);
          if (cloudPrefs.reminder.time) setReminderTime(cloudPrefs.reminder.time);
          if (cloudPrefs.reminder.daysOfWeek) setReminderDays(cloudPrefs.reminder.daysOfWeek);
          if (cloudPrefs.reminder.timezone) setReminderTimezone(cloudPrefs.reminder.timezone);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Autosave handler with optimistic caching and Cloud Firestore persistence
  useEffect(() => {
    // Skip autosave on first render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // 1. Persist to localStorage immediately
    localStorage.setItem('pref_default_intent', defaultIntent);
    localStorage.setItem('pref_reflection_tone', reflectionTone);
    localStorage.setItem('pref_voice_input', String(voiceInputEnabled));
    localStorage.setItem('pref_time_format', timeFormat);
    localStorage.setItem('pref_reminder_enabled', String(reminderEnabled));
    localStorage.setItem('pref_reminder_time', reminderTime);
    localStorage.setItem('pref_reminder_days', JSON.stringify(reminderDays));
    localStorage.setItem('pref_reminder_timezone', reminderTimezone);

    // 2. Persist to Cloud Firestore with debouncing and status indicator
    if (!user?.uid) return;

    setSaveStatus('saving');
    setSaveErrorMsg(null);

    const timer = setTimeout(async () => {
      try {
        const payload: UserPreferences = {
          defaultIntent,
          reflectionTone,
          voiceInputEnabled,
          timeFormat,
          reminder: {
            enabled: reminderEnabled,
            time: reminderTime,
            daysOfWeek: reminderDays,
            timezone: reminderTimezone,
          },
          theme: themePreference,
        };

        await saveUserPreferences(user.uid, payload);
        setSaveStatus('saved');
        const clearTimer = setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2000);
        return () => clearTimeout(clearTimer);
      } catch (err) {
        console.error('Failed to save user preferences:', err);
        setSaveStatus('error');
        setSaveErrorMsg('Could not sync preferences to cloud. Saved locally.');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    defaultIntent,
    reflectionTone,
    voiceInputEnabled,
    timeFormat,
    reminderEnabled,
    reminderTime,
    reminderDays,
    reminderTimezone,
    themePreference,
    user?.uid,
  ]);

  const handleCopySupportId = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedSupportId(true);
    setTimeout(() => setCopiedSupportId(false), 2500);
  };

  const handleToggleDay = (dayId: number) => {
    setReminderDays((prev) => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== dayId);
      } else {
        return [...prev, dayId].sort();
      }
    });
  };

  const handleSendTestNotification = async () => {
    // If browser notifications supported
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Manasyn Daily Reflection', {
          body: 'Take a quiet breath and pause for a few moments to clear your mind.',
          icon: '/favicon.ico',
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('Manasyn Daily Reflection', {
            body: 'Take a quiet breath and pause for a few moments to clear your mind.',
            icon: '/favicon.ico',
          });
        }
      }
    }

    setTestNotificationToast('Test notification dispatched: "Time for your daily reflection 🌱"');
    setTimeout(() => setTestNotificationToast(null), 4000);
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') return;
    if (!user?.uid) return;

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await deleteUserAccountAndData(user.uid);
      // Firebase auth signout and state reset occurs inside deleteUserAccountAndData
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error('Account deletion error:', err);
      setDeleteError(errorObj?.message || 'Failed to complete data deletion. Please try again.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div 
      id="profile-settings-view" 
      className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-y-auto pb-28 sm:pb-12"
    >
      {/* Top Banner */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="settings-back-btn"
              type="button"
              onClick={onBackToJournal}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Return to Home"
              aria-label="Return to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <span>Settings</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                Manage your account and personalize your Manasyn experience.
              </p>
            </div>
          </div>

          {/* Dynamic Save State Feedback */}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800 animate-in fade-in duration-150">
                <Check className="w-3.5 h-3.5" />
                <span>Saved ✓</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Save failed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Error Banner if any */}
      {saveErrorMsg && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
            <span>{saveErrorMsg}</span>
            <button
              type="button"
              onClick={() => setSaveErrorMsg(null)}
              className="font-bold underline text-amber-900 dark:text-amber-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Notification Toast Alert */}
      {testNotificationToast && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <Bell className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{testNotificationToast}</span>
          </div>
        </div>
      )}

      {/* Main Content Sections */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">

        {/* 1. Account Section */}
        <section 
          id="user-profile-card" 
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Account</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Connected with Google</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profile photo'}
                  referrerPolicy="no-referrer"
                  className="w-13 h-13 rounded-2xl border border-indigo-200 dark:border-indigo-800 object-cover shadow-xs shrink-0"
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-lg font-bold font-sans shadow-xs shrink-0">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <div className="space-y-0.5 min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {user.displayName || 'Personal Account'}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-sans">
                  <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 select-all truncate max-w-[200px] sm:max-w-xs">
                    {user.email || 'Google Account'}
                  </span>
                </div>
              </div>
            </div>

            {/* De-escalated Neutral Sign Out Button */}
            <div className="w-full sm:w-auto pt-2 sm:pt-0">
              <button
                id="profile-sign-out-btn"
                type="button"
                onClick={onSignOut}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. Appearance Card with 3-Option Segmented Control */}
        <section 
          id="appearance-card"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appearance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose your preferred interface theme
              </p>
            </div>
            
            {/* 3-Option Segmented Control */}
            <div 
              id="settings-theme-segmented-control"
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0"
              role="radiogroup"
              aria-label="Theme Selection"
            >
              <button
                id="theme-btn-light"
                type="button"
                role="radio"
                aria-checked={themePreference === 'light'}
                onClick={() => onSelectTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  themePreference === 'light'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                id="theme-btn-dark"
                type="button"
                role="radio"
                aria-checked={themePreference === 'dark'}
                onClick={() => onSelectTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  themePreference === 'dark'
                    ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>

              <button
                id="theme-btn-system"
                type="button"
                role="radio"
                aria-checked={themePreference === 'system'}
                onClick={() => onSelectTheme('system')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  themePreference === 'system'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>System Default</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Reflection Preferences */}
        <section 
          id="journal-preferences-card" 
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Reflection Preferences</span>
            </div>
            <span className="text-[11px] text-slate-400 font-sans">Shapes how Manasyn responds</span>
          </div>

          {/* Default Intent Options */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">
                Default Reflection Intent
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pre-select the starting mode when you open a new conversation
              </p>
            </div>

            {/* Vertical stack on mobile, 2 columns on desktop */}
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { 
                  id: 'clear_mind', 
                  label: 'Clear my mind', 
                  desc: 'Talk through whatever is on your mind.' 
                },
                { 
                  id: 'make_decision', 
                  label: 'Make a decision', 
                  desc: 'Explore your options and what matters most.' 
                },
                { 
                  id: 'capture_idea', 
                  label: 'Capture an idea', 
                  desc: 'Develop a thought before you lose it.' 
                },
                { 
                  id: 'plan_next_step', 
                  label: 'Plan next steps', 
                  desc: 'Turn your thoughts into a practical next step.' 
                },
                { 
                  id: 'ask_each_time', 
                  label: 'Ask me each time', 
                  desc: 'Choose an intent whenever you start a new reflection' 
                },
              ].map((opt) => {
                const isSelected = defaultIntent === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`intent-pref-btn-${opt.id}`}
                    type="button"
                    onClick={() => setDefaultIntent(opt.id as ReflectionIntentSetting)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-slate-900 dark:text-white ring-1 ring-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reflection Tone Options */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">
                Assistant Tone
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Set how Manasyn frames questions and guides your reflection
              </p>
            </div>

            {/* Vertical stack on mobile, 3 columns on desktop */}
            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2.5">
              {[
                { 
                  id: 'calm', 
                  label: 'Calm and supportive', 
                  desc: 'Gentle responses that help you slow down and find perspective.' 
                },
                { 
                  id: 'practical', 
                  label: 'Practical and focused', 
                  desc: 'Direct responses that help you identify decisions and next steps.' 
                },
                { 
                  id: 'curious', 
                  label: 'Curious and reflective', 
                  desc: 'Thoughtful questions that help you explore assumptions and feelings.' 
                },
              ].map((tone) => {
                const isSelected = reflectionTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    id={`tone-pref-btn-${tone.id}`}
                    type="button"
                    onClick={() => setReflectionTone(tone.id as ReflectionToneSetting)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-slate-900 dark:text-white ring-1 ring-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{tone.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {tone.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Input & Hardware Permission Controls */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Voice input</p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Manasyn uses your microphone only after you tap the microphone button. Recording stops when you end voice input.
                </p>
              </div>

              <button
                id="settings-voice-toggle-btn"
                type="button"
                role="switch"
                aria-checked={voiceInputEnabled}
                onClick={() => setVoiceInputEnabled(!voiceInputEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 min-w-[44px] ${
                  voiceInputEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title="Toggle Voice Input"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    voiceInputEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Time Format Controls (12-hour, 24-hour, Use device setting) */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">
                  Time Format
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Choose how timestamps and session dates are formatted
              </p>
            </div>

            <div 
              id="settings-time-format-options" 
              className="flex flex-col sm:flex-row gap-2"
              role="radiogroup"
              aria-label="Time Format"
            >
              {[
                { id: '12h', label: '12-hour (2:30 PM)' },
                { id: '24h', label: '24-hour (14:30)' },
                { id: 'system', label: 'Use device setting' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  id={`time-format-btn-${opt.id}`}
                  type="button"
                  role="radio"
                  aria-checked={timeFormat === opt.id}
                  onClick={() => setTimeFormat(opt.id as TimeFormatSetting)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-center text-xs font-semibold transition-all ${
                    timeFormat === opt.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Reflection Reminders */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Daily reflection reminders</p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Receive a gentle prompt to pause and review your thoughts
                </p>
              </div>

              <button
                id="settings-reminder-toggle-btn"
                type="button"
                role="switch"
                aria-checked={reminderEnabled}
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 min-w-[44px] ${
                  reminderEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title="Toggle Reminders"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Revealed Configuration Options when Enabled */}
            {reminderEnabled && (
              <div 
                id="reminder-config-panel"
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-150"
              >
                {/* Time of Day & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Reminder Time
                    </label>
                    <input
                      id="reminder-time-input"
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Timezone
                    </label>
                    <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span className="truncate">{reminderTimezone}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">(Auto)</span>
                    </div>
                  </div>
                </div>

                {/* Days of the Week Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Days of the week
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map((d) => {
                      const isActive = reminderDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleToggleDay(d.id)}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center border ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={d.full}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Send Test Notification Affordance */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    id="send-test-notification-btn"
                    type="button"
                    onClick={handleSendTestNotification}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Send test notification</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. Privacy, Places & Canonical Data Export Link */}
        <section 
          id="privacy-and-places-card"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Data & Privacy</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Your reflections are associated with your account. Review how Manasyn stores, processes, and shares your data.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Canonical Export Link */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Export your data</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Download a copy of your reflections and other selected information.
                </p>
              </div>

              {onOpenExport && (
                <button
                  id="settings-canonical-export-btn"
                  type="button"
                  onClick={onOpenExport}
                  className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Open Export</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Places Link */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Saved Places</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  View and manage physical locations associated with your reflections.
                </p>
              </div>

              {onOpenLocations && (
                <button
                  id="settings-open-places-btn"
                  type="button"
                  onClick={onOpenLocations}
                  className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Open Places</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 5. Progressive Web App Installation */}
        <section 
          id="pwa-install-settings-card"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans border-b border-slate-200 dark:border-slate-800 pb-3">
            <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>App Installation</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Standalone App Experience</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                Install Manasyn directly to your home screen or dock for quick distraction-free reflections and offline access.
              </p>
            </div>

            <div className="shrink-0">
              <PWAInstallButton />
            </div>
          </div>
        </section>

        {/* 6. Support & Diagnostics (with safe Copy support ID) */}
        <section 
          id="help-and-support-card"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans border-b border-slate-200 dark:border-slate-800 pb-3">
            <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Help & Support</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Support Reference ID</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Share this anonymous identifier if you need help troubleshooting an issue.
              </p>
            </div>

            <button
              id="copy-support-id-btn"
              type="button"
              onClick={handleCopySupportId}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              {copiedSupportId ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy support ID</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 6. Delete Account & Data Section */}
        <section 
          id="delete-account-section"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 font-sans border-b border-rose-100 dark:border-rose-950 pb-3">
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Delete Account & Data</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Permanently delete all journal data
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Permanently delete your account and all associated reflections, commitments, places, and saved insights. This action is irreversible.
              </p>
            </div>

            <button
              id="open-delete-account-modal-btn"
              type="button"
              onClick={() => {
                setDeleteConfirmationText('');
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          </div>
        </section>

      </div>

      {/* Account Deletion Confirmation Modal */}
      {isDeleteModalOpen && (
        <div 
          id="delete-account-modal-root"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/80 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Permanently Delete Account & Data
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-sans mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                The following records will be permanently erased:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                <li>All written reflections and dialogue history</li>
                <li>All confirmed commitments and progress states</li>
                <li>All saved places, coordinates, and location tags</li>
                <li>All discovered patterns, themes, and saved insights</li>
                <li>All configured webhooks and delivery audit logs</li>
              </ul>
            </div>

            {/* Export First Prompt */}
            {onOpenExport && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Want to keep a copy before deleting?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    onOpenExport();
                  }}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download archive first</span>
                </button>
              </div>
            )}

            {/* Confirmation input */}
            <div className="space-y-2">
              <label 
                htmlFor="delete-confirm-input"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Type <span className="font-mono text-rose-600 dark:text-rose-400">DELETE</span> to confirm:
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-hidden"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {deleteError}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                id="cancel-delete-account-btn"
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                id="confirm-delete-account-btn"
                type="button"
                disabled={deleteConfirmationText.trim().toUpperCase() !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteAccountConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm shadow-rose-600/20"
              >
                {isDeletingAccount ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting all data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently delete all my data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

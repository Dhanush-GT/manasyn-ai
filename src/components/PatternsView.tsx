import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Calendar, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  Bookmark, 
  EyeOff, 
  ThumbsUp, 
  ThumbsDown, 
  Lock, 
  Filter, 
  X, 
  Edit3, 
  Plus, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Sparkle
} from 'lucide-react';
import type { 
  ReflectionEntry, 
  UserProfile, 
  JourneyPatternResult, 
  RecurringTheme, 
  ChangeInPerspective, 
  PossibleNextStep,
  SavedInsight,
  Milestone
} from '../types';
import { 
  saveMilestone, 
  saveInsight, 
  deleteInsight, 
  subscribeUserInsights 
} from '../lib/firebase';
import { MarkdownRenderer } from './MarkdownRenderer';

interface PatternsViewProps {
  entries: ReflectionEntry[];
  user: UserProfile;
  onCreateNewFromSynthesis?: (title: string, content: string) => void;
  onNavigateToReflections?: () => void;
  onSelectEntry?: (entryId: string) => void;
  onNewReflection?: () => void;
  onBackToDashboard?: () => void;
}

type DateRangeFilter = '7d' | '30d' | '90d' | 'all' | 'custom';

export const PatternsView: React.FC<PatternsViewProps> = ({
  entries,
  user,
  onCreateNewFromSynthesis,
  onNavigateToReflections,
  onSelectEntry,
  onNewReflection,
  onBackToDashboard,
}) => {
  // Filter out completely empty reflections with 0 messages
  const validEntries = useMemo(() => {
    return entries.filter((e) => e.messages && e.messages.length > 0);
  }, [entries]);

  // Date range filter state - default to last 30 days
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('30d');
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Analysis result state
  const [patternResult, setPatternResult] = useState<JourneyPatternResult | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(() => {
    return localStorage.getItem(`manasyn_last_analysis_${user.uid}`) || null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');

  // User feedback & interaction states on insight cards
  const [validationStatuses, setValidationStatuses] = useState<Record<string, 'accurate' | 'inaccurate' | null>>({});
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [savedInsightIds, setSavedInsightIds] = useState<Set<string>>(new Set());
  const [savedInsightsList, setSavedInsightsList] = useState<SavedInsight[]>([]);

  // Next steps editing & commitment state
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editedStepTitles, setEditedStepTitles] = useState<Record<string, string>>({});
  const [editedStepNotes, setEditedStepNotes] = useState<Record<string, string>>({});
  const [savedCommitmentStepIds, setSavedCommitmentStepIds] = useState<Set<string>>(new Set());
  const [dismissedStepIds, setDismissedStepIds] = useState<Set<string>>(new Set());

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Subscribe to user saved insights from Firestore
  useEffect(() => {
    if (!user.uid) return;
    const unsubscribe = subscribeUserInsights(
      user.uid,
      (insights) => {
        setSavedInsightsList(insights);
        const ids = new Set(insights.map((i) => i.id));
        setSavedInsightIds(ids);
      },
      (err) => {
        console.warn('Error fetching saved insights:', err);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Compute entries matching default 30-day filter
  useEffect(() => {
    const now = Date.now();
    let cutoffMs = 30 * 24 * 60 * 60 * 1000;
    if (dateRangeFilter === '7d') cutoffMs = 7 * 24 * 60 * 60 * 1000;
    if (dateRangeFilter === '30d') cutoffMs = 30 * 24 * 60 * 60 * 1000;
    if (dateRangeFilter === '90d') cutoffMs = 90 * 24 * 60 * 60 * 1000;
    if (dateRangeFilter === 'all') cutoffMs = Infinity;

    const filtered = validEntries.filter((e) => {
      const entryTime = new Date(e.createdAt).getTime();
      return isNaN(entryTime) || (now - entryTime) <= cutoffMs;
    });

    setSelectedEntryIds(new Set(filtered.map((e) => e.id)));
  }, [validEntries, dateRangeFilter]);

  // Filtered array of selected reflection entries
  const selectedEntries = useMemo(() => {
    return validEntries.filter((e) => selectedEntryIds.has(e.id));
  }, [validEntries, selectedEntryIds]);

  const totalMessagesInSelection = useMemo(() => {
    return selectedEntries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  }, [selectedEntries]);

  // Date range label calculation
  const dateRangeLabel = useMemo(() => {
    if (dateRangeFilter === '7d') return 'Last 7 days';
    if (dateRangeFilter === '30d') return 'Last 30 days';
    if (dateRangeFilter === '90d') return 'Last 90 days';
    if (dateRangeFilter === 'all') return 'All time';
    return 'Custom selection';
  }, [dateRangeFilter]);

  // Trigger Gemini Pattern Analysis
  const handleFindPatterns = async () => {
    if (selectedEntries.length === 0) {
      setError('Please select at least one reflection entry with messages to find patterns.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgressStep(`Looking across your reflections for meaningful patterns… Reviewing ${selectedEntries.length} reflections.`);

    try {
      setTimeout(() => {
        setProgressStep(`Looking for patterns… Reviewing ${selectedEntries.length} selected reflections. This may take a moment.`);
      }, 900);

      const response = await fetch('/api/gemini/synthesize-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: selectedEntries,
          userEmail: user.email,
          timeRange: dateRangeFilter,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete pattern analysis.');
      }

      const result: JourneyPatternResult = {
        recurring_themes: Array.isArray(data.recurring_themes) ? data.recurring_themes : [],
        changes_in_perspective: Array.isArray(data.changes_in_perspective) ? data.changes_in_perspective : [],
        possible_next_steps: Array.isArray(data.possible_next_steps) ? data.possible_next_steps : [],
        synthesisMarkdown: data.synthesis || '',
        modelUsed: data.modelUsed || 'gemini-3.6-flash',
        entriesAnalyzed: selectedEntries.length,
        dateRange: dateRangeLabel,
        analyzedAt: new Date().toISOString(),
      };

      setPatternResult(result);
      const timestampNow = new Date().toISOString();
      setLastAnalysisTime(timestampNow);
      localStorage.setItem(`manasyn_last_analysis_${user.uid}`, timestampNow);
      showToast('Pattern analysis complete. Review your recurring themes below.');
    } catch (err: unknown) {
      console.error('Pattern synthesis error:', err);
      setError('We couldn’t complete the analysis. Your reflections were not changed. Please try again.');
    } finally {
      setIsLoading(false);
      setProgressStep('');
    }
  };

  // Card validation action (Accurate vs Not quite)
  const handleToggleValidation = (cardId: string, status: 'accurate' | 'inaccurate') => {
    setValidationStatuses((prev) => {
      const current = prev[cardId];
      const next = current === status ? null : status;
      if (next === 'accurate') {
        showToast('Marked as accurate. Thank you for validating your pattern.');
      } else if (next === 'inaccurate') {
        showToast('Marked as not quite. We’ll keep your reflections distinct.');
      }
      return { ...prev, [cardId]: next };
    });
  };

  // Save insight to Firestore
  const handleToggleSaveInsight = async (
    id: string, 
    type: 'theme' | 'perspective' | 'next_step', 
    title: string, 
    description: string,
    supportingReflections?: { title: string; date: string }[]
  ) => {
    if (!user.uid) return;
    const isAlreadySaved = savedInsightIds.has(id);

    try {
      if (isAlreadySaved) {
        await deleteInsight(user.uid, id);
        showToast('Insight removed from saved insights.');
      } else {
        const newInsight: SavedInsight = {
          id,
          userId: user.uid,
          type,
          title,
          description,
          supportingReflections,
          savedAt: new Date().toISOString(),
        };
        await saveInsight(user.uid, newInsight);
        showToast('Insight saved to your personal journal insights.');
      }
    } catch (err) {
      console.error('Failed to update saved insight:', err);
      showToast('Could not save insight. Please check your connection.');
    }
  };

  // Hide card
  const handleHideCard = (cardId: string) => {
    setHiddenCardIds((prev) => new Set(prev).add(cardId));
    showToast('Pattern card hidden from this view.');
  };

  // Save Possible Next Step as explicit Commitment
  const handleSaveAsCommitment = async (step: PossibleNextStep) => {
    if (!user.uid) return;

    const titleToSave = editedStepTitles[step.id] || step.title;
    const notesToSave = editedStepNotes[step.id] || step.description;

    const newMilestone: Milestone = {
      id: `ms-from-step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user.uid,
      title: titleToSave,
      category: 'personal',
      targetTimeframe: 'This month',
      status: 'planned',
      notes: `Suggested from Pattern Analysis: ${notesToSave}`,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveMilestone(user.uid, newMilestone);
      setSavedCommitmentStepIds((prev) => new Set(prev).add(step.id));
      setEditingStepId(null);
      showToast('Saved as a commitment in your Commitments tracker!');
    } catch (err) {
      console.error('Failed to save commitment:', err);
      showToast('Could not save commitment. Please try again.');
    }
  };

  // Copy Markdown Report
  const handleCopyMarkdown = async () => {
    if (!patternResult) return;
    let mdContent = `# Patterns & Journey — Manasyn\n`;
    mdContent += `*Date Range: ${patternResult.dateRange} • Analyzed: ${patternResult.entriesAnalyzed} reflections*\n\n`;

    if (patternResult.recurring_themes.length > 0) {
      mdContent += `## Recurring Themes\n\n`;
      patternResult.recurring_themes.forEach((t) => {
        mdContent += `### ${t.title}\n${t.description}\n`;
        if (t.supporting_reflections?.length > 0) {
          mdContent += `*Supporting Reflections:*\n`;
          t.supporting_reflections.forEach((r) => {
            mdContent += `- "${r.title}" (${r.date})\n`;
          });
        }
        mdContent += `\n`;
      });
    }

    if (patternResult.changes_in_perspective.length > 0) {
      mdContent += `## Changes in Perspective\n\n`;
      patternResult.changes_in_perspective.forEach((c) => {
        mdContent += `### ${c.title}\n${c.description}\n`;
        if (c.supporting_reflections?.length > 0) {
          mdContent += `*Supporting Reflections:*\n`;
          c.supporting_reflections.forEach((r) => {
            mdContent += `- "${r.title}" (${r.date})\n`;
          });
        }
        mdContent += `\n`;
      });
    }

    if (patternResult.possible_next_steps.length > 0) {
      mdContent += `## Possible Next Steps\n\n`;
      patternResult.possible_next_steps.forEach((s) => {
        mdContent += `- **${s.title}**: ${s.description}\n`;
      });
      mdContent += `\n`;
    }

    try {
      await navigator.clipboard.writeText(mdContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Copied patterns report to clipboard.');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Download Markdown Report
  const handleDownloadMarkdown = () => {
    if (!patternResult) return;
    let mdContent = `# Patterns & Journey — Manasyn\n`;
    mdContent += `Generated on: ${new Date().toLocaleString()}\n`;
    mdContent += `User: ${user.displayName || user.email || 'Manasyn Journaler'}\n`;
    mdContent += `Reflections Analyzed: ${patternResult.entriesAnalyzed} (${patternResult.dateRange})\n\n`;

    if (patternResult.recurring_themes.length > 0) {
      mdContent += `## Recurring Themes\n\n`;
      patternResult.recurring_themes.forEach((t) => {
        mdContent += `### ${t.title}\n${t.description}\n\n`;
        if (t.supporting_reflections?.length > 0) {
          mdContent += `*Supporting Reflections:*\n`;
          t.supporting_reflections.forEach((r) => {
            mdContent += `- "${r.title}" (${r.date})\n`;
          });
          mdContent += `\n`;
        }
      });
    }

    if (patternResult.changes_in_perspective.length > 0) {
      mdContent += `## Changes in Perspective\n\n`;
      patternResult.changes_in_perspective.forEach((c) => {
        mdContent += `### ${c.title}\n${c.description}\n\n`;
        if (c.supporting_reflections?.length > 0) {
          mdContent += `*Supporting Reflections:*\n`;
          c.supporting_reflections.forEach((r) => {
            mdContent += `- "${r.title}" (${r.date})\n`;
          });
          mdContent += `\n`;
        }
      });
    }

    if (patternResult.possible_next_steps.length > 0) {
      mdContent += `## Possible Next Steps\n\n`;
      patternResult.possible_next_steps.forEach((s) => {
        mdContent += `- **${s.title}**: ${s.description}\n`;
      });
    }

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manasyn-patterns-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Downloaded patterns markdown file.');
  };

  // Format relative last analysis date
  const formatAnalysisTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  const totalThemesNoticed = patternResult 
    ? (patternResult.recurring_themes.length + patternResult.changes_in_perspective.length) 
    : 0;

  return (
    <div 
      id="patterns-full-page-view" 
      className="flex-1 overflow-y-auto p-4 sm:p-8 pb-32 md:pb-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-w-0 transition-colors scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Simplified 2-Line Header */}
        <div id="patterns-page-header" className="border-b border-slate-200 dark:border-slate-800 pb-5">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
            Patterns & Journey
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-sans">
            Notice recurring themes, changes in perspective, and the progress you're making over time.
          </p>
        </div>

        {/* Overhauled Metrics Grid: Pre-Analysis vs Post-Analysis */}
        {!patternResult ? (
          /* Pre-Analysis State Metrics */
          <div id="pre-analysis-metrics-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Reflections available
              </span>
              <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                {selectedEntries.length} <span className="text-xs font-normal text-slate-500">/ {validEntries.length}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-purple-500" />
                Date range
              </span>
              <p className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white mt-1.5 truncate">
                {dateRangeLabel}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                Messages included
              </span>
              <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                {totalMessagesInSelection}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                Last analysis
              </span>
              <p className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white mt-1.5 truncate">
                {formatAnalysisTime(lastAnalysisTime)}
              </p>
            </div>
          </div>
        ) : (
          /* Post-Analysis State Metrics */
          <div id="post-analysis-metrics-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Reflections analyzed
              </span>
              <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                {patternResult.entriesAnalyzed}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-purple-500" />
                Time period
              </span>
              <p className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white mt-1.5 truncate">
                {patternResult.dateRange || dateRangeLabel}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-emerald-500" />
                Themes noticed
              </span>
              <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                {totalThemesNoticed}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                Insights saved
              </span>
              <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                {savedInsightsList.length}
              </p>
            </div>
          </div>
        )}

        {/* Error Alert with Retry CTA */}
        {error && (
          <div id="patterns-error-banner" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-start justify-between gap-3 font-sans">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <p className="font-semibold">Analysis Notice</p>
                <p className="mt-0.5 text-rose-700 dark:text-rose-400">{error}</p>
              </div>
            </div>
            <button
              id="retry-analysis-btn"
              type="button"
              onClick={handleFindPatterns}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shrink-0 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State Banner */}
        {isLoading && (
          <div id="patterns-loading-banner" className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm flex items-center gap-3.5 shadow-xs font-sans">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-indigo-950 dark:text-white">Looking for patterns…</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                {progressStep || `Reviewing ${selectedEntries.length} selected reflections. This may take a moment.`}
              </p>
            </div>
          </div>
        )}

        {/* Main Content Area: Pre-Analysis Configuration vs Result Cards */}
        {!patternResult ? (
          <div className="space-y-6">
            
            {/* User Selection & Privacy Controls Card */}
            <div id="reflection-selection-card" className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-500" />
                    Selected Reflections
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-0.5">
                    {selectedEntries.length} reflection{selectedEntries.length === 1 ? '' : 's'} selected ({totalMessagesInSelection} messages total)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDateRangeFilter('7d')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        dateRangeFilter === '7d' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateRangeFilter('30d')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        dateRangeFilter === '30d' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      30 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateRangeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        dateRangeFilter === 'all' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      All
                    </button>
                  </div>

                  <button
                    id="choose-reflections-btn"
                    type="button"
                    onClick={() => setIsSelectionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <span>Choose reflections</span>
                  </button>
                </div>
              </div>

              {/* Selection preview chips */}
              {selectedEntries.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                  {selectedEntries.slice(0, 8).map((entry) => (
                    <span 
                      key={entry.id} 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
                    >
                      <span className="font-medium truncate max-w-[180px]">{entry.title}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  ))}
                  {selectedEntries.length > 8 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 font-medium">
                      +{selectedEntries.length - 8} more
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-sans">
                  No reflections match this date filter. Choose a wider date range or select reflections manually.
                </div>
              )}

              {/* Privacy Notice Card */}
              <div id="privacy-disclosure-card" className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                  Manasyn will use Gemini to analyze the reflections you select and identify recurring themes. Your original reflections will not be changed.{' '}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="text-indigo-600 dark:text-indigo-400 underline font-medium hover:text-indigo-500"
                  >
                    How your data is handled
                  </button>
                </p>
              </div>

              {/* Consolidated Primary Action Button */}
              <div className="pt-2">
                <button
                  id="find-my-patterns-primary-btn"
                  type="button"
                  disabled={isLoading || selectedEntries.length === 0}
                  onClick={handleFindPatterns}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition-all shadow-md ${
                    isLoading || selectedEntries.length === 0
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-98'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>Find My Patterns</span>
                </button>
              </div>
            </div>

            {/* "What Manasyn Can Help You Notice" Informational Card */}
            <div id="what-manasyn-notices-card" className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
              <div className="max-w-xl space-y-1.5">
                <h2 className="text-lg sm:text-xl font-bold font-display text-slate-900 dark:text-white">
                  What Manasyn Can Help You Notice
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                  By observing multiple reflection conversations together, Manasyn surfaces meaningful connections:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-sans">1. Recurring Themes</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                    Ideas, concerns, and priorities that appear across your reflections.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 font-sans">2. Changes in Perspective</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                    How your thinking, confidence, and priorities have shifted over time.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-sans">3. Possible Next Steps</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                    Actions you may want to consider based on what matters to you.
                  </p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Post-Analysis Results View */
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Action Bar: New Analysis, Copy, Download */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-display">
                  Journey Insights
                </span>
                <span className="text-[11px] font-sans px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {patternResult.entriesAnalyzed} reflections • {patternResult.dateRange}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="reanalyze-patterns-btn"
                  type="button"
                  onClick={() => setPatternResult(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Change reflections</span>
                </button>

                <button
                  id="copy-patterns-btn"
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Copy markdown report"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  id="download-patterns-btn"
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Download markdown report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            {/* Category 1: Recurring Themes */}
            <div id="recurring-themes-section" className="space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  Recurring Themes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Ideas, concerns, and priorities that appear across your reflections
                </p>
              </div>

              {patternResult.recurring_themes.filter((t) => !hiddenCardIds.has(t.id)).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {patternResult.recurring_themes
                    .filter((t) => !hiddenCardIds.has(t.id))
                    .map((theme) => {
                      const isValidatedAccurate = validationStatuses[theme.id] === 'accurate';
                      const isValidatedInaccurate = validationStatuses[theme.id] === 'inaccurate';
                      const isSaved = savedInsightIds.has(theme.id);

                      return (
                        <div 
                          key={theme.id} 
                          id={`theme-card-${theme.id}`}
                          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-all"
                        >
                          <div className="space-y-1.5">
                            <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white">
                              {theme.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                              {theme.description}
                            </p>
                          </div>

                          {/* Evidence Block */}
                          {theme.supporting_reflections && theme.supporting_reflections.length > 0 && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans">
                                Supporting reflections:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {theme.supporting_reflections.map((ref, idx) => (
                                  <span 
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                  >
                                    <span>"{ref.title}"</span>
                                    <span className="text-slate-400 dark:text-slate-500 font-normal text-[11px]">— {ref.date}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4 Explicit User Validation Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleValidation(theme.id, 'accurate')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isValidatedAccurate
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{isValidatedAccurate ? 'Feels accurate' : 'This feels accurate'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleValidation(theme.id, 'inaccurate')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isValidatedInaccurate
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5 text-amber-500" />
                                <span>{isValidatedInaccurate ? 'Marked not quite' : 'Not quite'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSaveInsight(theme.id, 'theme', theme.title, theme.description, theme.supporting_reflections)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isSaved
                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                                <span>{isSaved ? 'Saved to insights' : 'Save insight'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleHideCard(theme.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Hide this pattern from current report"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Hide</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs text-center font-sans">
                  No recurring themes to display.
                </div>
              )}
            </div>

            {/* Category 2: Changes in Perspective */}
            <div id="changes-in-perspective-section" className="space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  Changes in Perspective
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  How your thinking, confidence, and priorities have shifted over time
                </p>
              </div>

              {patternResult.changes_in_perspective.filter((c) => !hiddenCardIds.has(c.id)).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {patternResult.changes_in_perspective
                    .filter((c) => !hiddenCardIds.has(c.id))
                    .map((shift) => {
                      const isValidatedAccurate = validationStatuses[shift.id] === 'accurate';
                      const isValidatedInaccurate = validationStatuses[shift.id] === 'inaccurate';
                      const isSaved = savedInsightIds.has(shift.id);

                      return (
                        <div 
                          key={shift.id} 
                          id={`perspective-card-${shift.id}`}
                          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-all"
                        >
                          <div className="space-y-1.5">
                            <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white">
                              {shift.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                              {shift.description}
                            </p>
                          </div>

                          {/* Evidence Block */}
                          {shift.supporting_reflections && shift.supporting_reflections.length > 0 && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans">
                                Supporting reflections:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {shift.supporting_reflections.map((ref, idx) => (
                                  <span 
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                  >
                                    <span>"{ref.title}"</span>
                                    <span className="text-slate-400 dark:text-slate-500 font-normal text-[11px]">— {ref.date}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4 Explicit User Validation Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleValidation(shift.id, 'accurate')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isValidatedAccurate
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{isValidatedAccurate ? 'Feels accurate' : 'This feels accurate'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleValidation(shift.id, 'inaccurate')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isValidatedInaccurate
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5 text-amber-500" />
                                <span>{isValidatedInaccurate ? 'Marked not quite' : 'Not quite'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSaveInsight(shift.id, 'perspective', shift.title, shift.description, shift.supporting_reflections)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isSaved
                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                                <span>{isSaved ? 'Saved to insights' : 'Save insight'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleHideCard(shift.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Hide this perspective shift from current report"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Hide</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs text-center font-sans">
                  No perspective shifts to display.
                </div>
              )}
            </div>

            {/* Category 3: Possible Next Steps (No Automatic Commitments) */}
            <div id="possible-next-steps-section" className="space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Possible Next Steps
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Actions you may want to consider based on what matters to you (only saved if you choose)
                </p>
              </div>

              {patternResult.possible_next_steps.filter((s) => !dismissedStepIds.has(s.id)).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {patternResult.possible_next_steps
                    .filter((s) => !dismissedStepIds.has(s.id))
                    .map((step) => {
                      const isEditing = editingStepId === step.id;
                      const isSavedAsCommitment = savedCommitmentStepIds.has(step.id);
                      const currentTitle = editedStepTitles[step.id] ?? step.title;
                      const currentNotes = editedStepNotes[step.id] ?? step.description;

                      return (
                        <div 
                          key={step.id} 
                          id={`step-card-${step.id}`}
                          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-all"
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 font-sans mb-1">
                                  Step Title
                                </label>
                                <input
                                  type="text"
                                  value={currentTitle}
                                  onChange={(e) => setEditedStepTitles({ ...editedStepTitles, [step.id]: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 font-sans mb-1">
                                  Notes & Context
                                </label>
                                <textarea
                                  value={currentNotes}
                                  onChange={(e) => setEditedStepNotes({ ...editedStepNotes, [step.id]: e.target.value })}
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white">
                                {currentTitle}
                              </h3>
                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                                {currentNotes}
                              </p>
                            </div>
                          )}

                          {/* Next Step Action Controls */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                              {isSavedAsCommitment ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Saved as commitment</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSaveAsCommitment(step)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Save as commitment</span>
                                </button>
                              )}

                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingStepId(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                >
                                  <span>Done editing</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingStepId(step.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDismissedStepIds((prev) => new Set(prev).add(step.id));
                                showToast('Suggestion dismissed.');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Dismiss</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs text-center font-sans">
                  No pending next steps to display.
                </div>
              )}
            </div>

          </div>
        )}

        {/* Subtle Gemini Attribution Note at Page Bottom */}
        <div id="patterns-attribution-footer" className="pt-6 border-t border-slate-200 dark:border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-sans flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Powered by Gemini AI • Analyzed privately for your personal reflection journey</span>
          </p>
        </div>

      </div>

      {/* Selection Modal / Drawer */}
      {isSelectionModalOpen && (
        <div 
          id="reflection-selection-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSelectionModalOpen(false);
          }}
        >
          <div 
            id="reflection-selection-modal"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-display">
                  Choose Reflections for Analysis
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  Select which entries should be included when identifying patterns
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectionModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date Range Shortcuts */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-slate-400 font-medium mr-1">Range:</span>
                {(['7d', '30d', '90d', 'all'] as DateRangeFilter[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDateRangeFilter(range)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      dateRangeFilter === range
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '90d' ? '90 days' : 'All time'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedEntryIds(new Set(validEntries.map((e) => e.id)))}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Select all
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedEntryIds(new Set())}
                  className="text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Checklist of Reflections */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
              {validEntries.length > 0 ? (
                validEntries.map((entry) => {
                  const isChecked = selectedEntryIds.has(entry.id);
                  const msgCount = entry.messages?.length || 0;
                  const dateFormatted = new Date(entry.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <label
                      key={entry.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(selectedEntryIds);
                          if (e.target.checked) next.add(entry.id);
                          else next.delete(entry.id);
                          setSelectedEntryIds(next);
                          setDateRangeFilter('custom');
                        }}
                        className="mt-1 w-4 h-4 rounded-md text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {entry.title}
                          </p>
                          <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                            {dateFormatted}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                          {msgCount} message{msgCount === 1 ? '' : 's'}
                          {entry.tags && entry.tags.length > 0 && ` • ${entry.tags.join(', ')}`}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">
                  No reflection entries found.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-sans">
                {selectedEntryIds.size} of {validEntries.length} reflections selected
              </span>
              <button
                type="button"
                onClick={() => setIsSelectionModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Explanation Modal */}
      {isPrivacyModalOpen && (
        <div 
          id="privacy-explanation-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPrivacyModalOpen(false);
          }}
        >
          <div 
            id="privacy-explanation-modal"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-display">
                  How Your Reflections Are Handled
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">1. No Modification of Original Reflections</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pattern analysis is purely read-only. Your journal entries, thoughts, and message history remain untouched in your database.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">2. Tentative, Non-Clinical Perspective</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manasyn is an AI journal, not a therapist or diagnostician. Insights are framed as gentle observations for you to validate or dismiss.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">3. User Controlled Commitments</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Possible next steps are never automatically added to your Commitments list. You retain total control over what is saved.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">4. Secure Cloud Processing</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your reflections are synthesized through server-side Gemini API calls protected by your account authentication.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/80 dark:bg-slate-950/80">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div 
          id="patterns-toast-notification"
          className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xl border border-slate-800 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2"
        >
          <Info className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

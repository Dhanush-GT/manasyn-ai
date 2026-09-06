import React, { useState } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  MessageSquare,
  Calendar,
  Tag,
  AlertCircle,
  Plus
} from 'lucide-react';
import type { ReflectionEntry, UserProfile } from '../types';
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

export const PatternsView: React.FC<PatternsViewProps> = ({
  entries,
  user,
  onCreateNewFromSynthesis,
  onNavigateToReflections,
  onSelectEntry,
  onNewReflection,
  onBackToDashboard,
}) => {
  const [synthesisText, setSynthesisText] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');

  const validEntries = entries.filter((e) => e.messages && e.messages.length > 0);
  const totalTurns = validEntries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  const uniqueTags = Array.from(new Set(validEntries.flatMap((e) => e.tags || [])));
  const mappedPlaces = validEntries.filter((e) => e.location?.placeName);

  const handleGenerateSynthesis = async () => {
    if (validEntries.length === 0) {
      setError('You need at least one reflection with messages to synthesize longitudinal patterns.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgressStep('Aggregating isolated reflections...');

    try {
      setTimeout(() => {
        setProgressStep('Engaging Gemini 3.6 Flash Resilient Ladder...');
      }, 700);

      setTimeout(() => {
        setProgressStep('Synthesizing cross-entry cognitive patterns & action loops...');
      }, 1600);

      const response = await fetch('/api/gemini/synthesize-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: validEntries,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Synthesis generation failed');
      }

      setSynthesisText(data.synthesis);
      setModelUsed(data.modelUsed || 'gemini-3.6-flash');
    } catch (err: unknown) {
      console.error('Synthesis error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during synthesis.');
    } finally {
      setIsLoading(false);
      setProgressStep('');
    }
  };

  const handleCopy = async () => {
    if (!synthesisText) return;
    try {
      await navigator.clipboard.writeText(synthesisText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleDownload = () => {
    if (!synthesisText) return;
    const blob = new Blob([
      `# Manasyn — Personal Journey & Pattern Synthesis\n` +
      `Generated on: ${new Date().toLocaleString()}\n` +
      `User: ${user.displayName || user.email || 'Manasyn User'}\n` +
      `Entries Analyzed: ${validEntries.length}\n\n` +
      synthesisText
    ], { type: 'text/markdown;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manasyn-patterns-synthesis-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      id="patterns-full-page-view" 
      className="flex-1 overflow-y-auto p-4 sm:p-8 pb-28 md:pb-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-w-0 transition-colors"
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center shadow-xs shrink-0">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
                  Patterns & Journey Synthesis
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="w-3 h-3" />
                  Gemini AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-sans">
                Discover longitudinal patterns, recurring themes, and cognitive momentum across your reflections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              id="generate-synthesis-top-btn"
              type="button"
              disabled={isLoading || validEntries.length === 0}
              onClick={handleGenerateSynthesis}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                isLoading || validEntries.length === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-98'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing...</span>
                </>
              ) : synthesisText ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerate Synthesis</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Reflections</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Longitudinal Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Reflections
            </span>
            <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
              {validEntries.length}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
              Total Messages
            </span>
            <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
              {totalTurns}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-500" />
              Unique Tags
            </span>
            <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
              {uniqueTags.length}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Locations
            </span>
            <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
              {mappedPlaces.length}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-3 font-sans">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">Unable to generate synthesis</p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Step Banner */}
        {isLoading && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs sm:text-sm flex items-center gap-3 animate-pulse font-sans">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold">{progressStep || 'Synthesizing with Gemini...'}</span>
          </div>
        )}

        {/* Main Content: Result Card or Empty State */}
        {synthesisText ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Synthesis Card Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                  Longitudinal Report
                </span>
                {modelUsed && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Engine: {modelUsed}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="copy-synthesis-btn"
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Copy markdown to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  id="download-synthesis-btn"
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Download Markdown file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>

                {onCreateNewFromSynthesis && (
                  <button
                    id="create-reflection-from-synthesis-btn"
                    type="button"
                    onClick={() => {
                      onCreateNewFromSynthesis(
                        `Synthesis Reflection — ${new Date().toLocaleDateString()}`,
                        synthesisText
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    title="Open as a new Reflection session"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Open in Reflection</span>
                  </button>
                )}
              </div>
            </div>

            {/* Markdown Content */}
            <div className="p-6 sm:p-8 font-sans leading-relaxed text-slate-800 dark:text-slate-200 text-sm sm:text-base">
              <MarkdownRenderer content={synthesisText} isUser={false} />
            </div>
          </div>
        ) : (
          <div className="p-8 sm:p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="max-w-lg mx-auto space-y-2">
              <h2 className="text-lg sm:text-xl font-bold font-display text-slate-900 dark:text-white">
                Cross-Reflection Journey Insights
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                Manasyn uses Gemini to analyze your reflections as a connected personal narrative, identifying:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-sans">1. Recurring Dilemmas</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  The mental hurdles, trade-offs, and decisions that re-appear across sessions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 font-sans">2. Mindset Trajectories</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  How your confidence, clarity, and perspective shifted over time.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-sans">3. Strategic Next Steps</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  Concrete high-leverage action commitments to move you forward.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="generate-synthesis-main-btn"
                type="button"
                disabled={isLoading || validEntries.length === 0}
                onClick={handleGenerateSynthesis}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-md ${
                  isLoading || validEntries.length === 0
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-98'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                <span>Synthesize My Reflections Now</span>
              </button>
              {validEntries.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
                  No reflection messages found. Write a reflection first or load demo data.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

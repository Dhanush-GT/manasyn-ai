import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Tag, 
  BrainCircuit, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  Compass, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { ReflectionEntry, UserProfile } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface JourneySynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ReflectionEntry[];
  user: UserProfile;
  onCreateNewFromSynthesis?: (title: string, content: string) => void;
}

export const JourneySynthesisModal: React.FC<JourneySynthesisModalProps> = ({
  isOpen,
  onClose,
  entries,
  user,
  onCreateNewFromSynthesis,
}) => {
  const [synthesisText, setSynthesisText] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');

  if (!isOpen) return null;

  // Compute metrics from entries
  const totalTurns = entries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  const uniqueTags = Array.from(new Set(entries.flatMap((e) => e.tags || [])));
  const mappedPlaces = entries.filter((e) => e.location?.placeName);

  const handleGenerateSynthesis = async () => {
    if (entries.length === 0) {
      setError('You need at least one journal entry to generate a longitudinal synthesis.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgressStep('Reviewing selected journal reflections...');

    try {
      setTimeout(() => {
        setProgressStep('Looking across reflections for recurring themes and shifts in perspective...');
      }, 700);

      const response = await fetch('/api/gemini/synthesize-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
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
      `Entries Analyzed: ${entries.length}\n\n` +
      synthesisText
    ], { type: 'text/markdown;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manasyn-journey-synthesis-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      id="journey-synthesis-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="journey-synthesis-modal-card"
        className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800/80 text-indigo-400 flex items-center justify-center shadow-xs">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white font-display">
                  Patterns & Journey Synthesis
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                  <Sparkles className="w-2.5 h-2.5" />
                  Gemini
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Discover patterns, recurring themes, and personal momentum across your reflections
              </p>
            </div>
          </div>

          <button
            id="close-synthesis-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Metrics Strip */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-sans">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Reflections</span>
            <p className="text-base font-bold text-slate-100 mt-0.5">{entries.length}</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Messages</span>
            <p className="text-base font-bold text-slate-100 mt-0.5">{totalTurns}</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Locations</span>
            <p className="text-base font-bold text-slate-100 mt-0.5">{mappedPlaces.length}</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Themes / Tags</span>
            <p className="text-base font-bold text-slate-100 mt-0.5">{uniqueTags.length}</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!synthesisText && !isLoading && (
            <div className="text-center py-10 px-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400 shadow-xs">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="text-base font-bold text-white font-display">
                  Explore Patterns & Growth
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Gemini will analyze your past {entries.length} reflections to illuminate recurring themes, shifts in focus, and emergent commitments.
                </p>
              </div>

              <button
                id="start-synthesis-btn"
                type="button"
                onClick={handleGenerateSynthesis}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Synthesize {entries.length} Reflections
              </button>
            </div>
          )}

          {isLoading && (
            <div className="py-14 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex items-center justify-center" />
                <BrainCircuit className="w-6 h-6 text-indigo-400 absolute" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white font-display">
                  Synthesizing Patterns...
                </h4>
                <p className="text-xs text-indigo-300 font-sans">
                  {progressStep || 'Analyzing reflections with Gemini'}
                </p>
              </div>
            </div>
          )}

          {synthesisText && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 font-display">
                    Patterns & Journey Analysis
                  </span>
                  {modelUsed && (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-slate-950 text-indigo-300 border border-slate-800">
                      {modelUsed}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 font-sans">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export MD</span>
                  </button>
                </div>
              </div>

              {/* Rendered Synthesis */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800">
                <MarkdownRenderer content={synthesisText} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/90 text-xs font-sans">
          <div className="text-slate-500 text-[11px]">
            Server-side token proxy with resilient model fallback
          </div>

          <div className="flex items-center gap-2">
            {synthesisText && (
              <button
                id="re-synthesize-btn"
                type="button"
                onClick={handleGenerateSynthesis}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-Analyze</span>
              </button>
            )}
            <button
              id="close-synthesis-footer-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

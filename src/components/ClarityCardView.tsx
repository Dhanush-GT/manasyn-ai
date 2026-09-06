import React from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  Target, 
  Check, 
  X, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import type { ClarityCardData } from '../types';

interface ClarityCardViewProps {
  data: ClarityCardData;
  onConfirmCommitment?: () => void;
  onDismissCommitment?: () => void;
  isConfirming?: boolean;
}

export const ClarityCardView: React.FC<ClarityCardViewProps> = ({
  data,
  onConfirmCommitment,
  onDismissCommitment,
  isConfirming = false,
}) => {
  const { 
    whatIHeard, 
    coreDilemma, 
    suggestedNextStep, 
    extractedCommitment,
    commitmentConfirmed,
    commitmentDismissed
  } = data;

  return (
    <div 
      id="clarity-card" 
      className="mt-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 shadow-md p-4 sm:p-5 space-y-4 text-left transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-[#17182B] dark:text-slate-200 tracking-wide font-display uppercase">
            Clarity Card
          </span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          Suggested from your reflection
        </span>
      </div>

      {/* Grid of Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* What I Heard */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            What I Heard
          </p>
          <p className="text-xs text-[#17182B] dark:text-slate-200 leading-relaxed font-sans">
            {whatIHeard}
          </p>
        </div>

        {/* Core Dilemma / Question */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="w-3 h-3 text-violet-500 dark:text-violet-400" />
            Core Dilemma / Question
          </p>
          <p className="text-xs text-[#17182B] dark:text-slate-200 leading-relaxed font-sans">
            {coreDilemma}
          </p>
        </div>

        {/* Suggested Next Step */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Suggested Next Step
          </p>
          <p className="text-xs text-[#17182B] dark:text-slate-200 leading-relaxed font-sans">
            {suggestedNextStep}
          </p>
        </div>
      </div>

      {/* Extracted Commitment Draft Section with Interactive Confirm/Dismiss */}
      {extractedCommitment && !commitmentDismissed && (
        <div 
          id="extracted-commitment-box" 
          className={`p-3.5 rounded-xl border transition-all ${
            commitmentConfirmed
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 text-slate-800 dark:text-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                commitmentConfirmed
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                  : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60'
              }`}>
                {commitmentConfirmed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                    Suggested from your reflection
                  </span>
                  {extractedCommitment.category && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-sans">
                      #{extractedCommitment.category}
                    </span>
                  )}
                  {extractedCommitment.targetTimeframe && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {extractedCommitment.targetTimeframe}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#17182B] dark:text-white mt-0.5">
                  {extractedCommitment.title}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {commitmentConfirmed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <Check className="w-3.5 h-3.5" />
                  Saved to Commitments
                </span>
              ) : (
                <>
                  {onConfirmCommitment && (
                    <button
                      id="confirm-commitment-btn"
                      type="button"
                      onClick={onConfirmCommitment}
                      disabled={isConfirming}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isConfirming ? 'Saving...' : 'Confirm Commitment'}</span>
                    </button>
                  )}
                  {onDismissCommitment && (
                    <button
                      id="dismiss-commitment-btn"
                      type="button"
                      onClick={onDismissCommitment}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Dismiss this commitment draft"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

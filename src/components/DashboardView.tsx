import React from 'react';
import { 
  Sparkles, 
  Plus, 
  ArrowRight, 
  MessageSquare, 
  Target, 
  CheckCircle2, 
  Clock, 
  BrainCircuit, 
  ListCheck, 
  Lightbulb, 
  Calendar, 
  MapPin, 
  Compass,
  ArrowUpRight,
  TrendingUp,
  Flame,
  Check
} from 'lucide-react';
import type { ReflectionEntry, Milestone, ReflectionMode, UserProfile } from '../types';

interface DashboardViewProps {
  user: UserProfile;
  entries: ReflectionEntry[];
  milestones: Milestone[];
  onSelectEntry?: (entryId: string) => void;
  onOpenReflection?: (entryId: string) => void;
  onQuickStartWithIntent: (intent: ReflectionMode, defaultTitle?: string) => void;
  onNewReflection?: () => void;
  onViewAllReflections: () => void;
  onViewAllCommitments?: () => void;
  onViewAllMilestones?: () => void;
  onOpenSynthesis: () => void;
  onOpenSpatialMap?: () => void;
  onInjectDemoData?: () => void;
}

// Helper to strip markdown for preview snippets
const stripMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`{1,3}[^`\n]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  entries,
  milestones,
  onSelectEntry,
  onOpenReflection,
  onQuickStartWithIntent,
  onNewReflection,
  onViewAllReflections,
  onViewAllCommitments,
  onViewAllMilestones,
  onOpenSynthesis,
  onOpenSpatialMap,
  onInjectDemoData,
}) => {
  const handleOpenEntry = onSelectEntry || onOpenReflection || (() => {});
  const handleViewCommitments = onViewAllCommitments || onViewAllMilestones || (() => {});
  // Sort entries: newest updated first
  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
  });
  const recentEntries = sortedEntries.slice(0, 2);

  // Active milestones: in_progress first, then planned
  const inProgressMilestones = milestones.filter((m) => m.status === 'in_progress');
  const plannedMilestones = milestones.filter((m) => m.status === 'planned');
  const activeMilestones = [...inProgressMilestones, ...plannedMilestones].slice(0, 3);
  const achievedMilestones = milestones.filter((m) => m.status === 'achieved');

  // Friendly time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user.displayName ? user.displayName.split(' ')[0] : 'friend';

  // Quick Start Intent Cards definition
  const quickStartIntents: {
    mode: ReflectionMode;
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClasses: {
      bg: string;
      border: string;
      text: string;
      hoverBg: string;
      iconBg: string;
    };
  }[] = [
    {
      mode: 'clear_mind',
      title: 'Clear my mind',
      description: 'Stream-of-consciousness download when thoughts feel cluttered or overwhelming.',
      icon: <BrainCircuit className="w-5 h-5" />,
      colorClasses: {
        bg: 'bg-indigo-50/70 dark:bg-indigo-950/30',
        border: 'border-indigo-200/80 dark:border-indigo-900/60',
        text: 'text-indigo-700 dark:text-indigo-300',
        hoverBg: 'hover:border-indigo-400 dark:hover:border-indigo-700',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400',
      },
    },
    {
      mode: 'make_decision',
      title: 'Make a decision',
      description: 'Analyze trade-offs, evaluate potential risks, and structure ambiguous choices.',
      icon: <Target className="w-5 h-5" />,
      colorClasses: {
        bg: 'bg-teal-50/70 dark:bg-teal-950/30',
        border: 'border-teal-200/80 dark:border-teal-900/60',
        text: 'text-teal-700 dark:text-teal-300',
        hoverBg: 'hover:border-teal-400 dark:hover:border-teal-700',
        iconBg: 'bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-400',
      },
    },
    {
      mode: 'capture_idea',
      title: 'Capture an idea',
      description: 'Flesh out a nascent concept, creative spark, or unexpected breakthrough.',
      icon: <Lightbulb className="w-5 h-5" />,
      colorClasses: {
        bg: 'bg-amber-50/70 dark:bg-amber-950/30',
        border: 'border-amber-200/80 dark:border-amber-900/60',
        text: 'text-amber-700 dark:text-amber-300',
        hoverBg: 'hover:border-amber-400 dark:hover:border-amber-700',
        iconBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400',
      },
    },
    {
      mode: 'plan_next_step',
      title: 'Plan next steps',
      description: 'Convert a sprawling project into concrete, prioritized commitments with dates.',
      icon: <ListCheck className="w-5 h-5" />,
      colorClasses: {
        bg: 'bg-purple-50/70 dark:bg-purple-950/30',
        border: 'border-purple-200/80 dark:border-purple-900/60',
        text: 'text-purple-700 dark:text-purple-300',
        hoverBg: 'hover:border-purple-400 dark:hover:border-purple-700',
        iconBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400',
      },
    },
  ];

  return (
    <div id="dashboard-view-root" className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-28 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        
        {/* Welcome Snapshot Header */}
        <section id="dashboard-welcome-header" className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/40 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-medium font-sans">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Clarity Snapshot &middot; {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight leading-tight">
                {getGreeting()}, {displayName}.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                Welcome back. Here is your current clarity snapshot. Speak or write freely to untangle today's thoughts.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <button
                id="dashboard-new-reflection-btn"
                type="button"
                onClick={onNewReflection}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Reflection</span>
              </button>

              <button
                id="dashboard-synthesis-btn"
                type="button"
                onClick={onOpenSynthesis}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-600 font-medium text-xs sm:text-sm transition-all"
                title="Synthesize patterns across your journey"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="hidden sm:inline">Synthesize</span>
              </button>
            </div>
          </div>

          {/* Snapshot Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80">
              <p className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400">Total Reflections</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">{entries.length}</span>
                <span className="text-[10px] text-slate-500">logged</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80">
              <p className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400">In Progress</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-display text-purple-600 dark:text-purple-400">{inProgressMilestones.length}</span>
                <span className="text-[10px] text-slate-500">commitments</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80">
              <p className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400">Achieved</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">{achievedMilestones.length}</span>
                <span className="text-[10px] text-slate-500">milestones</span>
              </div>
            </div>

            <div 
              onClick={onOpenSpatialMap}
              className="p-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 cursor-pointer hover:border-cyan-400/60 transition-colors group"
            >
              <p className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Spatial Pins</span>
                <ArrowUpRight className="w-3 h-3 text-cyan-600 dark:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-display text-cyan-600 dark:text-cyan-400">
                  {entries.filter(e => e.location?.latitude && e.location?.longitude).length}
                </span>
                <span className="text-[10px] text-slate-500">locations</span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Start Intent Launchpad */}
        <section id="dashboard-quick-start-intents" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
                Quick Start by Intent
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-sans hidden sm:inline">
              Choose an entry mode to guide the conversational flow
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {quickStartIntents.map((item) => (
              <button
                key={item.mode}
                id={`quick-start-${item.mode}`}
                type="button"
                onClick={() => onQuickStartWithIntent(item.mode, item.title)}
                className={`flex flex-col text-left p-4 rounded-2xl border bg-white dark:bg-slate-900/80 ${item.colorClasses.border} ${item.colorClasses.hoverBg} shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all group`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className={`p-2.5 rounded-xl ${item.colorClasses.iconBg} transition-colors`}>
                    {item.icon}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className={`text-sm font-bold font-display mb-1 ${item.colorClasses.text}`}>
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Two-Column Grid: Recent Reflections & Active Commitments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Recent Reflections Column */}
          <section id="dashboard-recent-reflections" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
                  Recent Reflections
                </h2>
              </div>
              {entries.length > 0 && (
                <button
                  id="dashboard-view-all-reflections-btn"
                  type="button"
                  onClick={onViewAllReflections}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <span>View All ({entries.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {recentEntries.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">No reflections logged yet</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Select any intent above or start a blank reflection to begin your personal journal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onNewReflection || (() => onQuickStartWithIntent('clear_mind', 'New Reflection'))}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Start First Reflection</span>
                  </button>
                  {onInjectDemoData && (
                    <button
                      type="button"
                      onClick={onInjectDemoData}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Load Sample Sessions</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentEntries.map((entry) => {
                  const lastMessage = entry.messages && entry.messages.length > 0
                    ? entry.messages[entry.messages.length - 1]
                    : null;
                  const snippet = lastMessage ? stripMarkdown(lastMessage.content) : 'No messages yet...';

                  return (
                    <div
                      key={entry.id}
                      id={`dashboard-reflection-card-${entry.id}`}
                      onClick={() => handleOpenEntry(entry.id)}
                      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-400/80 dark:hover:border-indigo-700/80 shadow-xs hover:shadow-md cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-display truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {entry.title || 'Untitled Reflection'}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>&bull;</span>
                            <span>{entry.messages?.length || 0} messages</span>
                            {entry.location?.placeName && (
                              <>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 truncate max-w-[150px]">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{entry.location.placeName}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 font-sans line-clamp-2 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                        {snippet}
                      </p>

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                          {entry.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Commitments Column */}
          <section id="dashboard-active-commitments" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
                  Active Commitments
                </h2>
              </div>
              {milestones.length > 0 && (
                <button
                  type="button"
                  onClick={handleViewCommitments}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <span>Tracker ({milestones.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeMilestones.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                  <Target className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">No active commitments</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Turn conversational breakthroughs into concrete action items with target timeframes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleViewCommitments}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Commitment</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeMilestones.map((ms) => (
                  <div
                    key={ms.id}
                    id={`dashboard-milestone-card-${ms.id}`}
                    onClick={handleViewCommitments}
                    className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-purple-400/80 dark:hover:border-purple-700/80 shadow-xs hover:shadow-md cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80">
                          {ms.category || 'Commitment'}
                        </span>
                        {ms.status === 'in_progress' ? (
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            In Progress
                          </span>
                        ) : (
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Planned
                          </span>
                        )}
                      </div>

                      {ms.targetTimeframe && (
                        <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {ms.targetTimeframe}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      {ms.title}
                    </h4>

                    {ms.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 font-sans leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                        {ms.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Target, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  Layers, 
  Filter, 
  Cpu, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Flame,
  Search
} from 'lucide-react';
import type { Milestone, MilestoneCategory, MilestoneStatus, ReflectionEntry } from '../types';
import { saveMilestone, updateMilestoneStatus, deleteMilestone } from '../lib/firebase';

interface MilestonesTrackerViewProps {
  userId: string;
  milestones: Milestone[];
  entries: ReflectionEntry[];
  onSelectEntry: (entryId: string) => void;
  onOpenNewSession: () => void;
  onInjectDemoData?: () => void;
}

const CATEGORY_COLORS: Record<MilestoneCategory, { bg: string; text: string; border: string }> = {
  decision: { bg: 'bg-indigo-100 dark:bg-indigo-950/70', text: 'text-indigo-800 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/80' },
  idea: { bg: 'bg-violet-100 dark:bg-violet-950/70', text: 'text-violet-800 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800/80' },
  blocker: { bg: 'bg-rose-100 dark:bg-rose-950/70', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800/80' },
  learning: { bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/80' },
  project: { bg: 'bg-blue-100 dark:bg-blue-950/70', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/80' },
  infrastructure: { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-700' },
  scaling: { bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/80' },
  product: { bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/80' },
  architecture: { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-700' },
  operations: { bg: 'bg-amber-100 dark:bg-amber-950/70', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/80' },
  personal: { bg: 'bg-teal-100 dark:bg-teal-950/70', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800/80' },
  general: { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-700' },
};

export const MilestonesTrackerView: React.FC<MilestonesTrackerViewProps> = ({
  userId,
  milestones,
  entries,
  onSelectEntry,
  onOpenNewSession,
  onInjectDemoData,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<MilestoneCategory>('decision');
  const [newTimeframe, setNewTimeframe] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter milestones
  const filteredMilestones = milestones.filter((ms) => {
    const matchesCategory = selectedCategory === 'all' || ms.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || ms.status === selectedStatus;
    const matchesSearch =
      ms.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ms.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ms.targetTimeframe || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Calculate high-signal metrics
  const totalCount = milestones.length;
  const inProgressCount = milestones.filter((m) => m.status === 'in_progress').length;
  const achievedCount = milestones.filter((m) => m.status === 'achieved').length;
  const plannedCount = milestones.filter((m) => m.status === 'planned').length;
  const completionRate = totalCount > 0 ? Math.round((achievedCount / totalCount) * 100) : 0;

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      const milestone: Milestone = {
        id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        title: newTitle.trim(),
        category: newCategory,
        status: 'planned',
        targetTimeframe: newTimeframe.trim() || undefined,
        notes: newNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await saveMilestone(userId, milestone);
      setNewTitle('');
      setNewTimeframe('');
      setNewNotes('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create milestone:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (milestoneId: string, currentStatus: MilestoneStatus) => {
    let nextStatus: MilestoneStatus = 'in_progress';
    if (currentStatus === 'planned') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'achieved';
    else if (currentStatus === 'achieved') nextStatus = 'planned';

    try {
      await updateMilestoneStatus(userId, milestoneId, nextStatus);
    } catch (err) {
      console.error('Failed to update milestone status:', err);
    }
  };

  const handleDelete = async (milestoneId: string) => {
    if (!window.confirm('Are you sure you want to remove this milestone?')) return;
    try {
      await deleteMilestone(userId, milestoneId);
    } catch (err) {
      console.error('Failed to delete milestone:', err);
    }
  };

  return (
    <div id="milestones-tracker-view" className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-y-auto pb-28 md:pb-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <span>Commitments & Action Steps</span>
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                    Extracted from Reflections
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  Actionable commitments, decisions, and milestones harvested from your conversational reflections.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {totalCount === 0 && onInjectDemoData && (
              <button
                id="milestones-inject-demo-btn"
                type="button"
                onClick={onInjectDemoData}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Load Demo Commitments</span>
              </button>
            )}

            <button
              id="add-custom-milestone-btn"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Commitment</span>
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-sans uppercase text-slate-500 dark:text-slate-400">Total Tracked</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white font-display mt-0.5">{totalCount}</p>
            </div>
            <Layers className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-sans uppercase text-indigo-600 dark:text-indigo-300">In Progress</p>
              <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-300 font-display mt-0.5">{inProgressCount}</p>
            </div>
            <Clock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-sans uppercase text-emerald-600 dark:text-emerald-300">Achieved</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300 font-display mt-0.5">{achievedCount}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-sans uppercase text-purple-600 dark:text-purple-300">Completion Rate</p>
              <p className="text-xl font-extrabold text-purple-600 dark:text-purple-300 font-display mt-0.5">{completionRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar: Clean scrollbar-hidden horizontal scroll container with proper right-padding on mobile */}
      <div className="p-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 w-full min-w-0 max-w-full">
        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden w-full md:w-auto min-w-0 pr-6 md:pr-0 shrink-0 md:flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 shrink-0 font-medium">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            Category:
          </span>
          {['all', 'decision', 'idea', 'blocker', 'learning', 'project', 'personal'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors shrink-0 whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto min-w-0 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden pb-1 md:pb-0 pr-4 md:pr-0">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-xs shrink-0">
            {['all', 'planned', 'in_progress', 'achieved'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors shrink-0 whitespace-nowrap ${
                  selectedStatus === status
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-52 shrink-0 min-w-[130px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search commitments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* Milestones Content List */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {filteredMilestones.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white/60 dark:bg-slate-900/30 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              {milestones.length === 0 ? 'No Commitments Saved Yet' : 'No Matching Commitments'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md font-sans leading-relaxed">
              {milestones.length === 0
                ? 'Converse with your journal to explore decisions and plan next steps. When a Clarity Card is created, you can save commitments with one click.'
                : 'Try clearing your active filters or search terms.'}
            </p>
            <div className="flex items-center gap-2 mt-4">
              {milestones.length === 0 && onInjectDemoData && (
                <button
                  type="button"
                  onClick={onInjectDemoData}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Load Demo Commitments
                </button>
              )}
              <button
                type="button"
                onClick={onOpenNewSession}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs"
              >
                Start Reflection
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMilestones.map((ms) => {
              const catStyle = CATEGORY_COLORS[ms.category] || CATEGORY_COLORS.general;
              const sourceSession = ms.extractedFromSessionId
                ? entries.find((e) => e.id === ms.extractedFromSessionId)
                : null;

              return (
                <div
                  key={ms.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group shadow-xs hover:shadow-sm"
                >
                  <div>
                    {/* Top Row: Category Pill & Status Toggle */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {ms.category}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(ms.id, ms.status)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                          ms.status === 'achieved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                            : ms.status === 'in_progress'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title="Click to cycle status (Planned -> In Progress -> Achieved)"
                      >
                        {ms.status === 'achieved' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : ms.status === 'in_progress' ? (
                          <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Calendar className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        )}
                        <span className="capitalize">{ms.status.replace('_', ' ')}</span>
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors leading-snug">
                      {ms.title}
                    </h3>

                    {/* Notes / Description */}
                    {ms.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed font-sans">
                        {ms.notes}
                      </p>
                    )}
                  </div>

                  {/* Footer: Target Timeframe, Source Link, Delete */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      {ms.targetTimeframe && (
                        <span className="text-[11px] font-sans text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/40 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          {ms.targetTimeframe}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {sourceSession && (
                        <button
                          type="button"
                          onClick={() => onSelectEntry(sourceSession.id)}
                          className="text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                          title={`Extracted from reflection: ${sourceSession.title}`}
                        >
                          <span className="truncate max-w-[100px]">{sourceSession.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(ms.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete commitment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Add Milestone Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Add Commitment
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 font-sans">
              Formally track an action step, strategic priority, or key milestone.
            </p>

            <form onSubmit={handleCreateMilestone} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Commitment Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Draft first sprint outline for new dashboard"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MilestoneCategory)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize font-sans"
                  >
                    <option value="decision">Decision</option>
                    <option value="idea">Idea</option>
                    <option value="blocker">Blocker</option>
                    <option value="learning">Learning</option>
                    <option value="project">Project</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Timeframe
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. This Friday, Next Week"
                    value={newTimeframe}
                    onChange={(e) => setNewTimeframe(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Context & Next Steps
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Key dependencies, criteria for completion..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors disabled:opacity-50 font-sans"
                >
                  {isSubmitting ? 'Saving...' : 'Save Commitment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

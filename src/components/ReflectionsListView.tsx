import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Bookmark, 
  BookmarkCheck, 
  Trash2, 
  Clock, 
  MapPin, 
  Tag, 
  Sparkles, 
  ArrowRight, 
  SlidersHorizontal,
  Calendar,
  MessageSquare,
  X
} from 'lucide-react';
import type { ReflectionEntry, UserProfile, ReflectionMode } from '../types';

interface ReflectionsListViewProps {
  entries: ReflectionEntry[];
  onSelectEntry: (entryId: string) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onUpdateEntry: (updated: ReflectionEntry) => void;
  user: UserProfile;
}

// Helper to strip markdown for clean card snippets
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

export const ReflectionsListView: React.FC<ReflectionsListViewProps> = ({
  entries,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onUpdateEntry,
  user,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ReflectionMode | 'all' | 'pinned'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'messages'>('newest');

  // Filter out any 0-message empty reflections from active counts & lists
  const validEntries = useMemo(() => {
    return entries.filter(
      (e) => (e.messages && e.messages.length > 0) || (e.tags && e.tags.length > 0) || e.location
    );
  }, [entries]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    validEntries.forEach((entry) => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [validEntries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return validEntries
      .filter((entry) => {
        // Pinned filter
        if (selectedMode === 'pinned' && !entry.isPinned) {
          return false;
        }

        // Mode filter
        if (selectedMode !== 'all' && selectedMode !== 'pinned') {
          const hasMode = entry.messages.some((m) => m.mode === selectedMode);
          if (!hasMode) return false;
        }

        // Tag filter
        if (selectedTag) {
          if (!entry.tags || !entry.tags.includes(selectedTag)) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = (entry.title || '').toLowerCase().includes(q);
          const locationMatch = (entry.location?.placeName || '').toLowerCase().includes(q);
          const tagMatch = entry.tags?.some((t) => t.toLowerCase().includes(q));
          const messageMatch = entry.messages.some((m) => m.content.toLowerCase().includes(q));
          return titleMatch || locationMatch || tagMatch || messageMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'messages') {
          return b.messages.length - a.messages.length;
        }
        return 0;
      });
  }, [validEntries, selectedMode, selectedTag, searchQuery, sortBy]);

  const handleTogglePin = (entry: ReflectionEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateEntry({
      ...entry,
      isPinned: !entry.isPinned,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDelete = (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteEntry(entryId);
  };

  return (
    <div id="reflections-list-page" className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
              Reflections
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans mt-1">
            All your conversations, breakthroughs, and moments of clarity.
          </p>
        </div>

        <button
          id="reflections-list-new-entry-btn"
          type="button"
          onClick={onNewEntry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="reflections-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections, insights, tags, or places..."
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Sort:</span>
            <select
              id="reflections-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'messages')}
              className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 font-sans"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="messages">Most messages</option>
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setSelectedMode('all');
              setSelectedTag(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedMode === 'all' && selectedTag === null
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({validEntries.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMode('pinned');
              setSelectedTag(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedMode === 'pinned'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Pinned</span>
          </button>

          {/* Quick Tags */}
          {allTags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSelectedTag(selectedTag === tag ? null : tag);
                setSelectedMode('all');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all ${
                selectedTag === tag
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Reflections Grid */}
      {filteredEntries.length === 0 ? (
        <div id="reflections-empty-state" className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              {searchQuery || selectedTag || selectedMode !== 'all'
                ? 'No matching reflections found'
                : 'No reflections yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
              {searchQuery || selectedTag || selectedMode !== 'all'
                ? 'Try adjusting your search terms or clearing the active filters.'
                : 'Start a conversation to unpack your thoughts, find clarity, and save commitments.'}
            </p>
          </div>
          {searchQuery || selectedTag || selectedMode !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
                setSelectedMode('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={onNewEntry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Start your first reflection</span>
            </button>
          )}
        </div>
      ) : (
        <div id="reflections-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const firstUserMessage = entry.messages.find((m) => m.role === 'user');
            const snippet = firstUserMessage
              ? stripMarkdown(firstUserMessage.content)
              : 'Tap to view conversation and clarity card...';

            return (
              <div
                key={entry.id}
                id={`reflection-card-${entry.id}`}
                onClick={() => onSelectEntry(entry.id)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Card Header: Title, Pin, Delete */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate font-display">
                        {entry.title || 'Untitled Session'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400 font-sans">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {entry.location && (
                          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 truncate max-w-[140px]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{entry.location.placeName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(entry, e)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          entry.isPinned
                            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={entry.isPinned ? 'Unpin' : 'Pin'}
                        aria-label={entry.isPinned ? 'Unpin' : 'Pin'}
                      >
                        {entry.isPinned ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(entry.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete reflection"
                        aria-label="Delete reflection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Excerpt Snippet */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans line-clamp-3 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    {snippet}
                  </p>
                </div>

                {/* Card Footer: Tags & Message Count & Open */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                    {entry.tags && entry.tags.length > 0 ? (
                      entry.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                        <MessageSquare className="w-3 h-3" />
                        {entry.messages.length} message{entry.messages.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

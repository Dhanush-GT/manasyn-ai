import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  MapPin, 
  Share2, 
  Bookmark, 
  BookmarkCheck, 
  Trash2, 
  Bot, 
  User as UserIcon, 
  CornerDownLeft, 
  Lightbulb, 
  ListCheck, 
  FileText, 
  Compass,
  AlertCircle,
  Clock,
  Tag,
  CheckCircle2,
  Mic,
  MicOff,
  Radio,
  Target,
  ArrowRight,
  Cpu,
  X
} from 'lucide-react';
import type { ReflectionEntry, ChatMessage, ReflectionMode, LocationTag } from '../types';
import { WebhookExportModal } from './WebhookExportModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ManasynLogo } from './ManasynLogo';
import { ClarityCardView } from './ClarityCardView';
import type { UserProfile } from '../types';
import { auth, saveMilestone } from '../lib/firebase';

const INTENT_ROTATING_PROMPTS: Record<ReflectionMode, string[]> = {
  clear_mind: [
    "What's taking up your mental bandwidth today?",
    "What felt heavy, tangled, or overwhelming?",
    "What's one thing you want to let go of or unpack?",
    "Talk freely... unload whatever thoughts are looping."
  ],
  make_decision: [
    "What conflicting options are you weighing right now?",
    "What's the worst-case and best-case outcome of each path?",
    "What does your intuition say before logic steps in?",
    "What critical piece of information are you missing?"
  ],
  capture_idea: [
    "Describe the breakthrough or creative spark before it fades...",
    "What problem does this idea solve, and who needs it?",
    "What would the most exciting version of this look like?",
    "What's the very first prototype or experiment you could run?"
  ],
  plan_next_step: [
    "What is the complex project, and where are you stuck?",
    "What is the single highest-leverage next action?",
    "What can you delegate, postpone, or simplify today?",
    "If you could only finish one thing before tomorrow, what is it?"
  ],
  reflect: [
    "How are you genuinely feeling at this moment?",
    "What gave you energy today, and what drained it?",
    "What is something you learned about yourself recently?",
    "What are you grateful for right now?"
  ],
  brainstorm: [
    "If there were zero constraints or budget limits, what would you build?",
    "What are 3 wild, unconventional ways to solve this?",
    "What would a complete outsider suggest in your situation?",
    "What assumptions can you invert or challenge?"
  ],
  summarize: [
    "What were the core takeaways from your recent work?",
    "How would you explain the situation in 3 sentences?",
    "What patterns emerged across your reflections?",
    "What is the executive summary of your current progress?"
  ],
  action_items: [
    "What concrete deliverables need to be finalized this week?",
    "Who needs to be contacted, informed, or aligned with?",
    "What blocking dependency must be resolved first?",
    "What is your commitment for today?"
  ],
};

interface ReflectionWorkspaceProps {
  entry: ReflectionEntry | null;
  user: UserProfile;
  onUpdateEntry: (updated: ReflectionEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  isSaving?: boolean;
  initialMode?: ReflectionMode;
  onOpenLocations?: (entryId?: string) => void;
}

export const ReflectionWorkspace: React.FC<ReflectionWorkspaceProps> = ({
  entry,
  user,
  onUpdateEntry,
  onDeleteEntry,
  isSaving = false,
  initialMode,
  onOpenLocations,
}) => {
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<ReflectionMode>(initialMode || 'clear_mind');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(entry?.title || 'Untitled Reflection');
  const [milestoneNotification, setMilestoneNotification] = useState<{ title: string; count: number } | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Web Speech API State
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Rotating placeholder interval effect (rotates every 4s when user is not typing)
  useEffect(() => {
    if (inputText.trim() !== '' || isListening) return;

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => prev + 1);
    }, 4000);

    return () => clearInterval(interval);
  }, [inputText, isListening, mode]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check Web Speech API Support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      let baseText = inputText;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        baseText = inputText.trim() ? `${inputText.trim()} ` : '';
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(baseText + transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow microphone permissions in browser settings.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice input: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.error('Failed to initialize speech recognition:', err);
      setSpeechError('Failed to start microphone.');
      setIsListening(false);
    }
  };

  // Cleanup speech on unmount or entry change
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [entry?.id]);

  useEffect(() => {
    if (entry) {
      setTitleText(entry.title);
      setErrorMessage(null);
    }
  }, [entry?.id]);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, entry?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry?.messages, isAiLoading]);

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs">
          <Sparkles className="w-8 h-8 animate-pulse text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold font-display">
          No Reflection Selected
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm font-sans">
          Select an existing reflection from the menu or start a new reflection to begin.
        </p>
      </div>
    );
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isAiLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
      mode,
    };

    const updatedMessages = [...entry.messages, userMessage];
    const updatedEntry: ReflectionEntry = {
      ...entry,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    onUpdateEntry(updatedEntry);
    setInputText('');
    setIsAiLoading(true);
    setErrorMessage(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          history: updatedMessages,
          mode,
          locationName: entry.location?.placeName || '',
          userId: entry.userId,
          sessionId: entry.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to converse with Gemini (HTTP ${response.status})`);
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        role: 'model',
        content: data.text,
        timestamp: new Date().toISOString(),
        mode,
        clarityCard: data.clarityCard || null,
      };

      const finalEntry: ReflectionEntry = {
        ...updatedEntry,
        messages: [...updatedMessages, modelMessage],
        updatedAt: new Date().toISOString(),
      };

      // Auto-generate title if this was the first turn and default title
      if (
        (finalEntry.title === 'New Reflection' ||
          finalEntry.title === 'Untitled Reflection' ||
          finalEntry.title === 'Operational Session' ||
          finalEntry.title === 'Untitled Session') &&
        updatedMessages.length === 1
      ) {
        try {
          const titleRes = await fetch('/api/gemini/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userMessage.content }),
          });
          const titleData = await titleRes.json();
          if (titleData.title) {
            finalEntry.title = titleData.title;
            setTitleText(titleData.title);
          }
        } catch (tErr) {
          console.warn('Auto-title generation failed:', tErr);
        }
      }

      onUpdateEntry(finalEntry);
    } catch (err: unknown) {
      console.error('Error conversing with Gemini:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while connecting with Gemini AI.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConfirmCommitment = async (msgIndex: number) => {
    if (!entry || !user?.uid) return;
    const targetMsg = entry.messages[msgIndex];
    if (!targetMsg?.clarityCard?.extractedCommitment) return;

    const draft = targetMsg.clarityCard.extractedCommitment;
    const newMilestone = {
      id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user.uid,
      title: draft.title,
      category: draft.category || 'project',
      targetTimeframe: draft.targetTimeframe,
      notes: draft.notes || `Extracted from reflection "${entry.title}"`,
      status: 'planned' as const,
      extractedFromSessionId: entry.id,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveMilestone(user.uid, newMilestone);
      const updatedMessages = [...entry.messages];
      updatedMessages[msgIndex] = {
        ...targetMsg,
        clarityCard: {
          ...targetMsg.clarityCard,
          commitmentConfirmed: true,
          confirmedMilestoneId: newMilestone.id,
        },
      };
      onUpdateEntry({
        ...entry,
        messages: updatedMessages,
        updatedAt: new Date().toISOString(),
      });
      setMilestoneNotification({
        title: draft.title,
        count: 1,
      });
      setTimeout(() => setMilestoneNotification(null), 5000);
    } catch (err) {
      console.error('Failed to confirm commitment:', err);
      setErrorMessage('Failed to save commitment to Firestore.');
    }
  };

  const handleDismissCommitment = (msgIndex: number) => {
    if (!entry) return;
    const targetMsg = entry.messages[msgIndex];
    if (!targetMsg?.clarityCard) return;

    const updatedMessages = [...entry.messages];
    updatedMessages[msgIndex] = {
      ...targetMsg,
      clarityCard: {
        ...targetMsg.clarityCard,
        commitmentDismissed: true,
      },
    };
    onUpdateEntry({
      ...entry,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleText.trim() && titleText !== entry.title) {
      onUpdateEntry({
        ...entry,
        title: titleText.trim(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleTogglePin = () => {
    onUpdateEntry({
      ...entry,
      isPinned: !entry.isPinned,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/^#+/, '').toLowerCase();
      if (cleanTag && !entry.tags.includes(cleanTag)) {
        onUpdateEntry({
          ...entry,
          tags: [...entry.tags, cleanTag],
          updatedAt: new Date().toISOString(),
        });
      }
      setTagInput('');
    }
  };

  const handleQuickAddTag = (tag: string) => {
    const cleanTag = tag.replace(/^#+/, '').toLowerCase();
    if (!entry.tags.includes(cleanTag)) {
      onUpdateEntry({
        ...entry,
        tags: [...entry.tags, cleanTag],
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateEntry({
      ...entry,
      tags: entry.tags.filter((t) => t !== tagToRemove),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSelectLocation = (loc: LocationTag | undefined) => {
    onUpdateEntry({
      ...entry,
      location: loc,
      updatedAt: new Date().toISOString(),
    });
  };

  // Dynamic mode-specific placeholder rotating through prompts
  const getDynamicPlaceholder = () => {
    if (isListening) return "Listening to your thoughts... speak freely";
    const prompts = INTENT_ROTATING_PROMPTS[mode] || INTENT_ROTATING_PROMPTS.clear_mind;
    return prompts[placeholderIndex % prompts.length];
  };

  return (
    <div id="reflection-workspace" className="flex-1 flex flex-col min-h-[calc(100vh-16rem)] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden relative w-full max-w-5xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Milestone Extraction Toast Notification */}
      {milestoneNotification && (
        <div id="milestone-extracted-toast" className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border-b border-purple-500/40 px-4 py-2 flex items-center justify-between text-xs text-purple-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>Strategic Milestone Harvested:</strong> &ldquo;{milestoneNotification.title}&rdquo; {milestoneNotification.count > 1 ? `(+${milestoneNotification.count - 1} more)` : ''} &bull; Persisted to your Milestones Tracker.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMilestoneNotification(null)}
            className="text-purple-400 hover:text-white text-xs font-semibold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Workspace Header */}
      <div className="p-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 shrink-0 w-full min-w-0">
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              id="reflection-title-input"
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-300 dark:border-slate-700"
            />
          ) : (
            <h1
              id="reflection-title-display"
              onClick={() => setIsEditingTitle(true)}
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-cyan-400 cursor-pointer flex items-center gap-2 group transition-colors truncate"
              title="Click to edit title"
            >
              <span className="truncate">{entry.title || 'Untitled Session'}</span>
              <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 font-normal shrink-0">
                (edit)
              </span>
            </h1>
          )}

          {/* Location & Metadata Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(entry.updatedAt || entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Location Tag Pill */}
            {entry.location ? (
              <div className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <button
                  id="location-tag-pill"
                  type="button"
                  onClick={() => onOpenLocations?.(entry.id)}
                  className="inline-flex items-center gap-1.5 hover:underline truncate max-w-[150px]"
                  title="View or change location in full-page Locations view"
                >
                  <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate">{entry.location.placeName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLocation(undefined)}
                  className="p-0.5 text-indigo-400 hover:text-rose-500 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                  title="Remove location tag"
                  aria-label="Remove location tag"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                id="add-location-btn"
                type="button"
                onClick={() => onOpenLocations?.(entry.id)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                title="Tag location on full-page map"
              >
                <MapPin className="w-3 h-3" />
                <span>Tag Location</span>
              </button>
            )}

            {/* Webhook export status */}
            {entry.webhookExportedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                Dispatched
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Connections (Share / Webhook) */}
          <button
            id="workspace-export-webhook-btn"
            type="button"
            onClick={() => setIsWebhookModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Connections: Share selected insights with connected apps"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Connections</span>
          </button>

          {/* Pin Button */}
          <button
            id="pin-entry-btn"
            type="button"
            onClick={handleTogglePin}
            className={`p-2 rounded-lg border transition-colors ${
              entry.isPinned
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={entry.isPinned ? 'Unpin reflection' : 'Pin reflection'}
          >
            {entry.isPinned ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          {/* Delete Button */}
          <button
            id="delete-entry-btn"
            type="button"
            onClick={() => onDeleteEntry(entry.id)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Delete this reflection"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tags Bar */}
      <div className="px-3 sm:px-6 py-2 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs shrink-0 no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden w-full min-w-0 pr-4">
        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 text-[11px] font-sans shrink-0 whitespace-nowrap shadow-2xs"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-rose-500 ml-0.5"
                title="Remove tag"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            id="tag-input"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="+ tag (e.g. #decision)"
            className="bg-transparent text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none w-28 font-sans shrink-0"
          />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="hidden sm:flex items-center gap-1 ml-auto pl-2 border-l border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 shrink-0">
          <span className="text-slate-400 font-sans">Quick:</span>
          {['decision', 'idea', 'blocker', 'learning', 'project'].map((quickTag) => {
            const isAdded = entry.tags.includes(quickTag);
            return (
              <button
                key={quickTag}
                type="button"
                onClick={() => isAdded ? handleRemoveTag(quickTag) : handleQuickAddTag(quickTag)}
                className={`px-2 py-0.5 rounded-md transition-colors font-sans text-[11px] whitespace-nowrap ${
                  isAdded
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                }`}
                title={isAdded ? `Remove #${quickTag}` : `Add #${quickTag}`}
              >
                {isAdded ? '✓' : '+'}#{quickTag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat / Multi-Turn Reflection Messages Stream */}
      <div id="messages-container" className="flex-1 overflow-y-auto pb-44 p-4 sm:p-6 space-y-6">
        {entry.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-md">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
              Talk freely. Find clarity. Move forward.
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-sans max-w-md">
              Clear your mind, make a tough decision, capture an idea, or plan your next step. Manasyn brings calm structure to your raw reflections.
            </p>
          </div>
        ) : (
          entry.messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                id={`message-bubble-${index}`}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <ManasynLogo size={20} variant="symbol" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm min-w-0 break-words ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {!isUser && msg.mode && (
                    <span className="inline-block text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 mb-2 border border-indigo-800/80">
                      {msg.mode === 'clear_mind' ? 'Clear my mind' :
                       msg.mode === 'make_decision' ? 'Make a decision' :
                       msg.mode === 'capture_idea' ? 'Capture an idea' :
                       msg.mode === 'plan_next_step' ? 'Plan next step' :
                       msg.mode.replace('_', ' ')}
                    </span>
                  )}
                  <MarkdownRenderer content={msg.content} isUser={isUser} />

                  {/* Structured Clarity Card */}
                  {!isUser && msg.clarityCard && (
                    <ClarityCardView
                      data={msg.clarityCard}
                      onConfirmCommitment={() => handleConfirmCommitment(index)}
                      onDismissCommitment={() => handleDismissCommitment(index)}
                    />
                  )}

                  <span
                    className={`block text-[10px] font-sans mt-2 text-right ${
                      isUser ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: localStorage.getItem('pref_time_format') !== '24h'
                    })}
                  </span>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isAiLoading && (
          <div className="flex gap-3 sm:gap-4 justify-start animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
              <Cpu className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
            <div className="bg-slate-900 rounded-2xl rounded-bl-xs p-4 border border-slate-800 text-xs sm:text-sm text-slate-400 flex items-center gap-2 font-sans">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span>Reflecting and structuring your thoughts...</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Mode Selector and Prompt Input Bar - Fixed to bottom viewport directly above Bottom Navbar */}
      <div className="fixed bottom-20 inset-x-0 z-40 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-4 pt-2 shadow-lg">
        <div className="max-w-5xl mx-auto w-full px-3 sm:px-6">
          {/* Reflection Conversational Intent Chips - Swipeable Horizontal Row */}
          <div className="flex flex-row overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide w-full gap-3 px-4 mb-2">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 min-w-max self-center mr-0.5 select-none">
              Intent:
            </span>
            {[
              { id: 'clear_mind' as ReflectionMode, label: 'Clear my mind', icon: Sparkles },
              { id: 'make_decision' as ReflectionMode, label: 'Make a decision', icon: Target },
              { id: 'capture_idea' as ReflectionMode, label: 'Capture an idea', icon: Lightbulb },
              { id: 'plan_next_step' as ReflectionMode, label: 'Plan next step', icon: ArrowRight },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = mode === item.id;
              return (
                <button
                  key={item.id}
                  id={`mode-selector-${item.id}`}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setPlaceholderIndex(0);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 min-w-max whitespace-nowrap font-sans select-none ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/80 shadow-xs ring-1 ring-indigo-500/30 font-bold'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="shrink-0 min-w-max">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input Text Form */}
          {speechError && (
            <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between font-sans">
              <span>{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {isListening && (
            <div className="mb-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between animate-pulse font-sans">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                <span className="font-semibold">Transcribing speech... speak freely</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold hover:bg-rose-700 transition-colors"
              >
                Stop Transcribing
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                id="reflection-chat-input"
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={getDynamicPlaceholder()}
                className={`w-full resize-none rounded-xl p-2.5 sm:p-3 pr-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border ${
                  isListening 
                    ? 'border-rose-500 ring-2 ring-rose-500/30' 
                    : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                } text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none max-h-32 font-sans`}
              />

              {/* Voice Dictation Toggle Button inside textarea */}
              <button
                id="voice-dictation-btn"
                type="button"
                onClick={toggleListening}
                title={isListening ? "Stop Voice Dictation" : isSpeechSupported ? "Start Voice Dictation" : "Voice dictation not supported in browser"}
                disabled={!isSpeechSupported}
                className={`absolute right-2.5 bottom-2.5 p-1.5 rounded-lg transition-all ${
                  isListening
                    ? 'bg-rose-600 text-white animate-bounce shadow-md'
                    : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                } ${!isSpeechSupported ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>

            <button
              id="reflection-send-btn"
              type="submit"
              disabled={!inputText.trim() || isAiLoading}
              className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 text-white shadow-md shadow-indigo-950/40 transition-all shrink-0 flex items-center justify-center h-[46px] w-[46px] active:scale-95"
              title="Send reflection"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Integrations Modal */}
      <WebhookExportModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        user={user}
        currentEntry={entry}
        onEntryDispatched={(id) => {
          onUpdateEntry({
            ...entry,
            webhookExportedAt: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
};

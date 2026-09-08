import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  FileText, 
  Code, 
  Check, 
  Send, 
  Webhook as WebhookIcon, 
  Plus, 
  Trash2, 
  AlertCircle, 
  ExternalLink,
  Shield,
  ShieldAlert,
  Layers,
  MapPin,
  Target,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Calendar,
  Filter,
  Eye,
  EyeOff,
  History,
  Lock,
  Sparkles,
  Info,
  RefreshCw,
  FolderArchive,
  ChevronRight,
  AlertTriangle,
  X
} from 'lucide-react';
import type { 
  ReflectionEntry, 
  Milestone, 
  LocationTag, 
  UserProfile, 
  WebhookConfig, 
  WebhookDeliveryLog, 
  WebhookTargetType, 
  WebhookEventTrigger, 
  WebhookPayloadScope,
  ExportDateScope,
  ExportFormat,
  ExportOptions 
} from '../types';
import { 
  filterExportEntries, 
  downloadMarkdownZipArchive, 
  downloadJsonExport, 
  generateExportManifest 
} from '../lib/exportUtils';
import { 
  saveUserWebhook, 
  deleteUserWebhook, 
  subscribeUserWebhooks, 
  recordWebhookDeliveryLog,
  subscribeWebhookLogs,
  subscribeUserPlaces
} from '../lib/firebase';

interface ExportViewProps {
  entries: ReflectionEntry[];
  milestones?: Milestone[];
  user: UserProfile;
  onBackToDashboard?: () => void;
  onEntryUpdated?: (updated: ReflectionEntry) => Promise<void> | void;
}

export const ExportView: React.FC<ExportViewProps> = ({
  entries,
  milestones = [],
  user,
  onBackToDashboard,
  onEntryUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'archive' | 'webhooks'>('archive');

  // Places state for location export options
  const [savedPlaces, setSavedPlaces] = useState<LocationTag[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserPlaces(user.uid, (places) => {
      setSavedPlaces(places);
    });
    return () => unsub();
  }, [user?.uid]);

  // ==================== ARCHIVE EXPORT STATE ====================
  const [exportFormat, setExportFormat] = useState<ExportFormat>('zip_markdown');
  const [dateScope, setDateScope] = useState<ExportDateScope>('30_days'); // DEFAULT: Last 30 days
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Privacy defaults: Locations OFF by default, exact coordinates OFF by default
  const [includePlaces, setIncludePlaces] = useState<boolean>(false);
  const [includeExactCoordinates, setIncludeExactCoordinates] = useState<boolean>(false);
  const [includeCommitments, setIncludeCommitments] = useState<boolean>(true);
  const [includeInsights, setIncludeInsights] = useState<boolean>(true);
  const [includeTags, setIncludeTags] = useState<boolean>(true);
  const [excludeDrafts, setExcludeDrafts] = useState<boolean>(true);
  
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedPlaceFilter, setSelectedPlaceFilter] = useState<string>('all');

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Available tags across reflections
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.tags) e.tags.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [entries]);

  // Available place names across reflections
  const availablePlaceNames = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.location?.placeName) set.add(e.location.placeName);
    });
    savedPlaces.forEach((p) => {
      if (p.placeName) set.add(p.placeName);
    });
    return Array.from(set).sort();
  }, [entries, savedPlaces]);

  // Filtered entries according to active scope & filter settings
  const exportOptions: ExportOptions = useMemo(() => ({
    format: exportFormat,
    dateScope,
    startDate: dateScope === 'custom' ? startDate : undefined,
    endDate: dateScope === 'custom' ? endDate : undefined,
    includeCommitments,
    includePlaces,
    includeExactCoordinates,
    includeInsights,
    includeTags,
    excludeDrafts,
    selectedTagFilter: selectedTagFilter !== 'all' ? selectedTagFilter : undefined,
    selectedPlaceFilter: selectedPlaceFilter !== 'all' ? selectedPlaceFilter : undefined,
  }), [
    exportFormat, 
    dateScope, 
    startDate, 
    endDate, 
    includeCommitments, 
    includePlaces, 
    includeExactCoordinates, 
    includeInsights, 
    includeTags, 
    excludeDrafts, 
    selectedTagFilter, 
    selectedPlaceFilter
  ]);

  const filteredEntries = useMemo(() => {
    return filterExportEntries(entries, exportOptions);
  }, [entries, exportOptions]);

  const totalFilteredMessages = useMemo(() => {
    return filteredEntries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  }, [filteredEntries]);

  // Execute export download
  const handleDownloadArchive = async () => {
    if (filteredEntries.length === 0 && !includeCommitments) return;
    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      if (exportFormat === 'zip_markdown') {
        await downloadMarkdownZipArchive(
          filteredEntries,
          includeCommitments ? milestones : [],
          includePlaces ? savedPlaces : [],
          exportOptions,
          user
        );
        setExportSuccessMessage(`Successfully packaged and downloaded ${filteredEntries.length} reflections as a ZIP archive.`);
      } else {
        downloadJsonExport(
          filteredEntries,
          includeCommitments ? milestones : [],
          includePlaces ? savedPlaces : [],
          exportOptions,
          user
        );
        setExportSuccessMessage(`Successfully exported ${filteredEntries.length} reflections as JSON package.`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Could not complete the export. Please verify browser permissions and try again.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportSuccessMessage(null), 6000);
    }
  };

  // ==================== WEBHOOKS INTEGRATION STATE ====================
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(true);

  // Subscribe to webhooks from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setIsLoadingWebhooks(false);
      return;
    }
    const unsub = subscribeUserWebhooks(user.uid, (list) => {
      setWebhooks(list);
      setIsLoadingWebhooks(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // Webhook Creation / Edit Modal State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTargetType, setFormTargetType] = useState<WebhookTargetType>('slack');
  const [formSecret, setFormSecret] = useState('');
  const [formTriggers, setFormTriggers] = useState<WebhookEventTrigger[]>(['manual_only']);
  const [formPayloadScope, setFormPayloadScope] = useState<WebhookPayloadScope>('title_only');
  const [formIncludeTags, setFormIncludeTags] = useState(false);
  const [formIncludeCommitments, setFormIncludeCommitments] = useState(false);
  const [formIncludePlaceName, setFormIncludePlaceName] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Security confirmation for full reflection payload scope
  const [showScopeConfirmation, setShowScopeConfirmation] = useState(false);
  const [pendingScopeChange, setPendingScopeChange] = useState<WebhookPayloadScope | null>(null);

  // Deletion confirmation modal
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookConfig | null>(null);

  // Testing dispatch state
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; statusCode?: number; durationMs?: number } | null>(null);

  // Logs drawer / modal
  const [selectedWebhookForLogs, setSelectedWebhookForLogs] = useState<WebhookConfig | null>(null);
  const [activeWebhookLogs, setActiveWebhookLogs] = useState<WebhookDeliveryLog[]>([]);

  useEffect(() => {
    if (!user?.uid || !selectedWebhookForLogs) {
      setActiveWebhookLogs([]);
      return;
    }
    const unsub = subscribeWebhookLogs(user.uid, selectedWebhookForLogs.id, (logs) => {
      setActiveWebhookLogs(logs);
    });
    return () => unsub();
  }, [user?.uid, selectedWebhookForLogs]);

  // Open modal for creating a new webhook
  const handleOpenCreateModal = () => {
    setEditingWebhook(null);
    setFormName('');
    setFormUrl('');
    setFormTargetType('slack');
    setFormSecret('');
    setFormTriggers(['manual_only']);
    setFormPayloadScope('title_only');
    setFormIncludeTags(false);
    setFormIncludeCommitments(false);
    setFormIncludePlaceName(false);
    setFormError(null);
    setIsWebhookModalOpen(true);
  };

  // Open modal for editing an existing webhook
  const handleOpenEditModal = (wh: WebhookConfig) => {
    setEditingWebhook(wh);
    setFormName(wh.name || '');
    setFormUrl(wh.webhookUrl || '');
    setFormTargetType(wh.targetType || 'slack');
    setFormSecret(''); // Keep secret blank unless changing
    setFormTriggers(wh.triggerEvents && wh.triggerEvents.length > 0 ? wh.triggerEvents : ['manual_only']);
    setFormPayloadScope(wh.payloadScope || 'title_only');
    setFormIncludeTags(wh.includeTags || false);
    setFormIncludeCommitments(wh.includeCommitments || false);
    setFormIncludePlaceName(wh.includePlaceName || false);
    setFormError(null);
    setIsWebhookModalOpen(true);
  };

  // Handle payload scope changes with safety warning
  const handlePayloadScopeSelect = (scope: WebhookPayloadScope) => {
    if (scope === 'full_reflection') {
      setPendingScopeChange(scope);
      setShowScopeConfirmation(true);
    } else {
      setFormPayloadScope(scope);
    }
  };

  const confirmScopeChange = () => {
    if (pendingScopeChange) {
      setFormPayloadScope(pendingScopeChange);
    }
    setShowScopeConfirmation(false);
    setPendingScopeChange(null);
  };

  const toggleTriggerEvent = (trigger: WebhookEventTrigger) => {
    if (formTriggers.includes(trigger)) {
      if (formTriggers.length === 1) {
        // Must have at least one trigger
        return;
      }
      setFormTriggers(formTriggers.filter((t) => t !== trigger));
    } else {
      setFormTriggers([...formTriggers, trigger]);
    }
  };

  // Validate and Save Webhook
  const handleSaveWebhook = async () => {
    setFormError(null);
    if (!formName.trim()) {
      setFormError('Please enter a friendly name for this integration.');
      return;
    }
    if (!formUrl.trim()) {
      setFormError('Please enter a valid webhook destination URL.');
      return;
    }

    // Client-side URL sanitization & validation
    try {
      const parsed = new URL(formUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setFormError('Webhook URL must begin with https://');
        return;
      }
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
        setFormError('Security Error: Private local IP addresses and localhost are prohibited.');
        return;
      }
    } catch {
      setFormError('Please enter a valid URL (e.g., https://hooks.slack.com/services/...)');
      return;
    }

    const newConfig: WebhookConfig = {
      id: editingWebhook?.id || `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user.uid,
      name: formName.trim(),
      targetType: formTargetType,
      webhookUrl: formUrl.trim(),
      secret: formSecret.trim() ? formSecret.trim() : (editingWebhook?.secret || undefined),
      maskedSecret: formSecret.trim() ? `••••••••${formSecret.trim().slice(-4)}` : editingWebhook?.maskedSecret,
      isEnabled: editingWebhook ? editingWebhook.isEnabled : true,
      isPaused: false, // Reset paused state on update
      consecutiveFailures: 0,
      triggerEvents: formTriggers,
      payloadScope: formPayloadScope,
      includeTags: formIncludeTags,
      includeCommitments: formIncludeCommitments,
      includePlaceName: formIncludePlaceName,
      includeExactCoordinates: false, // strictly false
      createdAt: editingWebhook?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveUserWebhook(user.uid, newConfig);
      setIsWebhookModalOpen(false);
    } catch (err) {
      console.error('Error saving webhook:', err);
      setFormError('Failed to save webhook configuration. Please try again.');
    }
  };

  // Toggle Enable / Pause Webhook
  const handleToggleWebhookState = async (wh: WebhookConfig) => {
    try {
      const updated: WebhookConfig = {
        ...wh,
        isEnabled: !wh.isEnabled,
        isPaused: false, // Clear pause when user toggles
        consecutiveFailures: 0,
      };
      await saveUserWebhook(user.uid, updated);
    } catch (err) {
      console.error('Error toggling webhook:', err);
    }
  };

  // Delete Webhook
  const handleConfirmDelete = async () => {
    if (!webhookToDelete) return;
    try {
      await deleteUserWebhook(user.uid, webhookToDelete.id);
      setWebhookToDelete(null);
    } catch (err) {
      console.error('Error deleting webhook:', err);
    }
  };

  // Test Dispatch Action
  const handleSendTestPayload = async (wh: WebhookConfig) => {
    setTestingWebhookId(wh.id);
    setTestResult(null);

    try {
      const response = await fetch('/api/webhooks/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookId: wh.id,
          webhookUrl: wh.webhookUrl,
          targetType: wh.targetType,
          secret: wh.secret,
          userEmail: user.email || '',
        }),
      });

      const data = await response.json();
      const success = response.ok && data.success;

      const logEntry: WebhookDeliveryLog = {
        id: `log-${Date.now()}`,
        webhookId: wh.id,
        timestamp: new Date().toISOString(),
        eventType: 'test_ping',
        statusCode: data.statusCode || (success ? 200 : 502),
        status: success ? 'success' : 'failed',
        deliveryId: data.deliveryId || `del-${Date.now()}`,
        retryCount: 0,
        durationMs: data.durationMs || 120,
        error: success ? undefined : (data.error || data.message),
      };

      await recordWebhookDeliveryLog(user.uid, wh.id, logEntry);

      setTestResult({
        id: wh.id,
        success,
        message: success 
          ? `Test succeeded! Received HTTP ${data.statusCode} in ${data.durationMs || 0}ms.`
          : `Test failed: ${data.error || data.message || 'Unknown network error'}`,
        statusCode: data.statusCode,
        durationMs: data.durationMs,
      });

      // Update webhook's last dispatched state
      await saveUserWebhook(user.uid, {
        ...wh,
        lastDispatchedAt: new Date().toISOString(),
        lastDeliveryStatus: success ? 'success' : 'failed',
      });
    } catch (err: unknown) {
      setTestResult({
        id: wh.id,
        success: false,
        message: `Network error: ${err instanceof Error ? err.message : 'Could not reach server'}`,
      });
    } finally {
      setTestingWebhookId(null);
      setTimeout(() => setTestResult(null), 8000);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-y-auto pb-28 sm:pb-12 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <FolderArchive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Export & Integrations
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Zero-Cloud-Leakage
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Export your personal archive or connect private webhooks to sync your reflections.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
          <button
            id="tab-archive-export"
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'archive'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            Archive Export
          </button>
          <button
            id="tab-webhooks-integrations"
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'webhooks'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <WebhookIcon className="w-4 h-4" />
            Webhooks & Sync
            {webhooks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {webhooks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* ==================== TAB 1: ARCHIVE EXPORT ==================== */}
        {activeTab === 'archive' && (
          <div className="space-y-6">
            
            {/* Dynamic Scope & Metrics Header Card */}
            <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Archive Data Portability
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Package your reflections, insights, and commitments into portable Markdown or structured JSON.
                  </p>
                </div>

                {/* Inline Compact Summary Banner */}
                <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl text-xs">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {filteredEntries.length} reflection{filteredEntries.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {totalFilteredMessages} message{totalFilteredMessages === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {includeCommitments ? `${milestones.length} commitments` : '0 commitments'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className={includePlaces ? 'text-amber-700 dark:text-amber-300 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                    {includePlaces ? `${savedPlaces.length} places` : 'Location data excluded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Column: Scope & Filter Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Date Scope Filter */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Reflection Date Scope
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Default: Last 30 days
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: '30_days', label: 'Last 30 days' },
                      { id: '90_days', label: 'Last 90 days' },
                      { id: 'all', label: 'All reflections' },
                      { id: 'custom', label: 'Custom range' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        id={`scope-btn-${opt.id}`}
                        onClick={() => setDateScope(opt.id as ExportDateScope)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                          dateScope === opt.id
                            ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Range Inputs */}
                  {dateScope === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Content Filter Options */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tag Filter */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        Filter by Tag (Optional)
                      </label>
                      <select
                        value={selectedTagFilter}
                        onChange={(e) => setSelectedTagFilter(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">All Tags ({availableTags.length} available)</option>
                        {availableTags.map((tag) => (
                          <option key={tag} value={tag}>#{tag}</option>
                        ))}
                      </select>
                    </div>

                    {/* Place Filter */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Filter by Place (Optional)
                      </label>
                      <select
                        value={selectedPlaceFilter}
                        onChange={(e) => setSelectedPlaceFilter(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">All Places ({availablePlaceNames.length} available)</option>
                        {availablePlaceNames.map((place) => (
                          <option key={place} value={place}>{place}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Exclude Drafts Checkbox */}
                  <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={excludeDrafts}
                      onChange={(e) => setExcludeDrafts(e.target.checked)}
                      className="w-4 h-4 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span>Exclude empty reflections or unfinished drafts</span>
                  </label>
                </div>

                {/* 2. Privacy & Data Inclusion Controls */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Data Inclusion & Privacy Settings
                  </h3>

                  <div className="space-y-3.5">
                    {/* Commitments Toggle */}
                    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Include commitments</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Include the next steps and commitments you chose to save.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeCommitments}
                        onChange={(e) => setIncludeCommitments(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* Saved Insights Toggle */}
                    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Include saved insights & clarity cards</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Structured data containing reflections, messages, timestamps, saved insights, tags, and selected metadata.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeInsights}
                        onChange={(e) => setIncludeInsights(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* Location Toggle (OFF BY DEFAULT) */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Include saved places and location information</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Privacy Default: Off
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                            This may include sensitive location details linked to your reflections.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={includePlaces}
                          onChange={(e) => {
                            setIncludePlaces(e.target.checked);
                            if (!e.target.checked) setIncludeExactCoordinates(false);
                          }}
                          className="w-4 h-4 mt-0.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </div>

                      {/* Nested exact coordinates toggle */}
                      {includePlaces && (
                        <div className="ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 pt-1">
                          <div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Include exact GPS coordinates</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              When disabled, only place names and general area names are included. Raw coordinates remain excluded.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={includeExactCoordinates}
                            onChange={(e) => setIncludeExactCoordinates(e.target.checked)}
                            className="w-3.5 h-3.5 mt-0.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Format Selection, Manifest Preview & Dynamic Download (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Export Format Selection */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Package Format
                  </h3>

                  <div className="space-y-3">
                    {/* Option 1: ZIP Markdown Archive */}
                    <div 
                      onClick={() => setExportFormat('zip_markdown')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        exportFormat === 'zip_markdown'
                          ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <FolderArchive className={`w-4 h-4 ${exportFormat === 'zip_markdown' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">ZIP Archive (Markdown + Manifest)</span>
                        </div>
                        <input
                          type="radio"
                          name="export_format"
                          checked={exportFormat === 'zip_markdown'}
                          onChange={() => setExportFormat('zip_markdown')}
                          className="text-indigo-600 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 ml-6">
                        Includes structured <code className="text-indigo-600 dark:text-indigo-300">reflections/*.md</code>, <code className="text-indigo-600 dark:text-indigo-300">commitments.md</code>, and an automated <code className="text-indigo-600 dark:text-indigo-300">README.md</code> manifest.
                      </p>
                    </div>

                    {/* Option 2: JSON Package */}
                    <div 
                      onClick={() => setExportFormat('json')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        exportFormat === 'json'
                          ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Code className={`w-4 h-4 ${exportFormat === 'json' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">JSON Data Package (Portable)</span>
                        </div>
                        <input
                          type="radio"
                          name="export_format"
                          checked={exportFormat === 'json'}
                          onChange={() => setExportFormat('json')}
                          className="text-indigo-600 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 ml-6">
                        Single validated JSON file containing full schema versioning, message logs, and portability metadata.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Manifest Summary Box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs shadow-xs">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-medium flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Generated Manifest (README.md)
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Schema v1.0.0</span>
                  </div>

                  <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                    <div className="flex justify-between">
                      <span>Reflections in Scope:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{filteredEntries.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dialogue Messages:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{totalFilteredMessages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commitments Included:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{includeCommitments ? milestones.length : 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Places Included:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{includePlaces ? savedPlaces.length : 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Exact Coordinates:</span>
                      <span className={includeExactCoordinates ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                        {includeExactCoordinates ? 'Included' : 'Omitted for privacy'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Download Action */}
                <div className="space-y-3">
                  <button
                    id="btn-download-archive"
                    type="button"
                    disabled={isExporting || (filteredEntries.length === 0 && !includeCommitments)}
                    onClick={handleDownloadArchive}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-semibold text-sm shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating Package...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download {filteredEntries.length} reflection{filteredEntries.length === 1 ? '' : 's'}
                      </>
                    )}
                  </button>

                  {exportSuccessMessage && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{exportSuccessMessage}</span>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB 2: WEBHOOKS & INTEGRATIONS ==================== */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">

            {/* MANDATORY PRIVACY WARNING BANNER */}
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Privacy & Data Destination Notice
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-200/80 leading-relaxed">
                  Reflections may contain sensitive personal information. Data sent to this endpoint will be governed by the destination’s privacy and retention policies.
                </p>
              </div>
            </div>

            {/* Webhooks Header & Create Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <WebhookIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Configured Endpoints
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Secure outgoing HTTP webhooks with cryptographic HMAC signing and strict SSRF defenses.
                </p>
              </div>

              <button
                id="btn-add-webhook"
                type="button"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Webhook Endpoint
              </button>
            </div>

            {/* Test Result Toast */}
            {testResult && (
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                testResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTestResult(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Webhook Endpoints List */}
            {isLoadingWebhooks ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                Loading integrations...
              </div>
            ) : webhooks.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <WebhookIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Webhook Endpoints Configured</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Connect Slack, Discord, or a custom HTTPS listener. Outgoing payloads require manual triggers or explicit event opt-ins.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Configure First Endpoint
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{wh.name}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {wh.targetType}
                          </span>
                          {wh.isPaused ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <PauseCircle className="w-3 h-3" />
                              Paused
                            </span>
                          ) : wh.isEnabled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-xl">
                          {wh.webhookUrl}
                        </p>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {/* Send test payload */}
                        <button
                          type="button"
                          disabled={testingWebhookId === wh.id}
                          onClick={() => handleSendTestPayload(wh)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {testingWebhookId === wh.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )}
                          Send test payload
                        </button>

                        {/* Toggle state */}
                        <button
                          type="button"
                          onClick={() => handleToggleWebhookState(wh)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                          title={wh.isEnabled ? 'Pause or disable' : 'Enable webhook'}
                        >
                          {wh.isEnabled && !wh.isPaused ? (
                            <PauseCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>

                        {/* View delivery logs */}
                        <button
                          type="button"
                          onClick={() => setSelectedWebhookForLogs(wh)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                          title="View Delivery Logs"
                        >
                          <History className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => setWebhookToDelete(wh)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                          title="Delete Webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Auto-pause notice if 3 failures occurred */}
                    {wh.isPaused && wh.pauseReason && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{wh.pauseReason}</span>
                      </div>
                    )}

                    {/* Details Badges */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {/* Triggers */}
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Triggers:</span>
                      {wh.triggerEvents?.map((tr) => (
                        <span key={tr} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                          {tr.replace('_', ' ')}
                        </span>
                      ))}

                      <span className="text-slate-300 dark:text-slate-700">•</span>

                      {/* Scope */}
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Scope:</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono">
                        {wh.payloadScope ? wh.payloadScope.replace('_', ' ') : 'title only'}
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>

                      {/* Secret */}
                      <span className="text-slate-400 dark:text-slate-500 font-medium">Signing:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {wh.maskedSecret || 'HMAC Disabled'}
                      </span>

                      {wh.lastDispatchedAt && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-slate-500">
                            Last sent {new Date(wh.lastDispatchedAt).toLocaleTimeString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ==================== MODAL: ADD / EDIT WEBHOOK ==================== */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <WebhookIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {editingWebhook ? 'Edit Webhook Integration' : 'Add Webhook Integration'}
              </h2>
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Friendly Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Integration Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Personal Journal Slack Channel"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Target Format */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'slack', label: 'Slack Webhook' },
                    { id: 'discord', label: 'Discord Webhook' },
                    { id: 'custom_json', label: 'Custom HTTPS JSON' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormTargetType(p.id as WebhookTargetType)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        formTargetType === p.id
                          ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL (HTTPS Required) *
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Secret Token for HMAC-SHA256 Signing */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Secret Key (HMAC-SHA256 Signature)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Optional</span>
                </label>
                <input
                  type="password"
                  placeholder={editingWebhook?.maskedSecret ? `Current: ${editingWebhook.maskedSecret}` : 'Enter secret for X-Manasyn-Signature'}
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  When configured, requests include header <code className="text-indigo-600 dark:text-indigo-300">X-Manasyn-Signature: sha256=...</code>
                </p>
              </div>

              {/* Event Triggers */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Event Triggers (Strict Opt-In)
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'manual_only', title: 'Only when manually shared (Default)', desc: 'Safest mode. Requires clicking "Sync to Webhook" manually.' },
                    { id: 'reflection_completed', title: 'When a reflection is completed', desc: 'Dispatches when you finish a dialogue.' },
                    { id: 'commitment_saved', title: 'When a commitment is saved', desc: 'Dispatches when a new next step or commitment is recorded.' },
                    { id: 'export_ready', title: 'When an export archive is ready', desc: 'Dispatches a link or summary when an export is generated.' },
                  ].map((tr) => (
                    <label key={tr.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950/60 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formTriggers.includes(tr.id as WebhookEventTrigger)}
                        onChange={() => toggleTriggerEvent(tr.id as WebhookEventTrigger)}
                        className="w-4 h-4 mt-0.5 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{tr.title}</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{tr.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Payload Scope */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data Scope Selection
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'title_only', label: 'Title Only', desc: 'Safest Default' },
                    { id: 'approved_summary', label: 'Approved Summary', desc: 'High-level synthesis' },
                    { id: 'full_reflection', label: 'Full Reflection', desc: 'Requires confirmation' },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => handlePayloadScopeSelect(sc.id as WebhookPayloadScope)}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        formPayloadScope === sc.id
                          ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold">{sc.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{sc.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Metadata Inclusion */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Optional Metadata</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIncludeTags}
                      onChange={(e) => setFormIncludeTags(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Include Tags</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIncludeCommitments}
                      onChange={(e) => setFormIncludeCommitments(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Include Commitments</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formIncludePlaceName}
                      onChange={(e) => setFormIncludePlaceName(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Include Place Name</span>
                  </label>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWebhook}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {editingWebhook ? 'Update Webhook' : 'Save Integration'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL: FULL SCOPE WARNING CONFIRMATION ==================== */}
      {showScopeConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Full Reflection Scope Warning</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Selecting <strong>Full Reflection</strong> will transmit your complete conversational dialogue turns to the external endpoint. Are you sure you want to enable raw text transmission?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowScopeConfirmation(false);
                  setPendingScopeChange(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Keep Title Only
              </button>
              <button
                type="button"
                onClick={confirmScopeChange}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs"
              >
                Yes, Enable Full Scope
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: DELETE CONFIRMATION ==================== */}
      {webhookToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Integration?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Are you sure you want to remove <strong>{webhookToDelete.name}</strong>? Outgoing webhooks to this URL will cease immediately.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWebhookToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs"
              >
                Delete Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DRAWER / MODAL: DELIVERY AUDIT LOGS ==================== */}
      {selectedWebhookForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-lg h-full p-6 flex flex-col justify-between shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Delivery Logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedWebhookForLogs.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWebhookForLogs(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {activeWebhookLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No delivery logs recorded for this endpoint yet.
                </div>
              ) : (
                activeWebhookLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.status === 'success' ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            HTTP {log.statusCode}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            HTTP {log.statusCode || 502}
                          </span>
                        )}
                        <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">{log.eventType}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.error && (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono">{log.error}</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Delivery ID: {log.deliveryId}</span>
                      <span>Duration: {log.durationMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedWebhookForLogs(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

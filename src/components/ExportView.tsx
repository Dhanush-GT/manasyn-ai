import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  Code, 
  Check, 
  Send, 
  Webhook, 
  Plus, 
  Trash2, 
  AlertCircle, 
  ExternalLink,
  Shield,
  Layers,
  MapPin,
  Target
} from 'lucide-react';
import type { ReflectionEntry, Milestone, UserProfile } from '../types';

interface ExportViewProps {
  entries: ReflectionEntry[];
  milestones?: Milestone[];
  user: UserProfile;
  onBackToDashboard?: () => void;
  onEntryUpdated?: (updated: ReflectionEntry) => Promise<void> | void;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  format: 'slack' | 'discord' | 'custom';
  secretToken?: string;
  enabled: boolean;
}

export const ExportView: React.FC<ExportViewProps> = ({
  entries,
  milestones = [],
  user,
  onBackToDashboard,
  onEntryUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'archive' | 'webhooks'>('archive');

  // Archive Export state
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [includeLocations, setIncludeLocations] = useState(true);
  const [includeMilestones, setIncludeMilestones] = useState(true);
  const [includeRawSystemIds, setIncludeRawSystemIds] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(() => {
    try {
      const stored = localStorage.getItem(`manasyn_webhooks_${user.uid}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookFormat, setNewWebhookFormat] = useState<'slack' | 'discord' | 'custom'>('slack');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<{ id?: string; message: string; type: 'success' | 'error' } | null>(null);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);

  const validEntries = entries.filter((e) => e.messages && e.messages.length > 0);
  const totalMessages = validEntries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);

  const saveWebhooksToStorage = (updated: WebhookConfig[]) => {
    setWebhooks(updated);
    try {
      localStorage.setItem(`manasyn_webhooks_${user.uid}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save webhooks to localStorage:', e);
    }
  };

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;

    const newConfig: WebhookConfig = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newWebhookName.trim(),
      url: newWebhookUrl.trim(),
      format: newWebhookFormat,
      secretToken: newWebhookSecret.trim() || undefined,
      enabled: true,
    };

    const updated = [...webhooks, newConfig];
    saveWebhooksToStorage(updated);
    setNewWebhookName('');
    setNewWebhookUrl('');
    setNewWebhookSecret('');
    setWebhookStatus({ message: 'Webhook destination added successfully.', type: 'success' });
    setTimeout(() => setWebhookStatus(null), 3000);
  };

  const handleDeleteWebhook = (id: string) => {
    const updated = webhooks.filter((w) => w.id !== id);
    saveWebhooksToStorage(updated);
  };

  const handleTestDispatch = async (webhook: WebhookConfig) => {
    setIsDispatching(webhook.id);
    setWebhookStatus(null);

    const latestEntry = validEntries[0];
    const payload = webhook.format === 'slack'
      ? {
          text: `*Manasyn Reflection Update*\n*User:* ${user.displayName || user.email}\n*Latest Session:* ${latestEntry?.title || 'No sessions yet'}\n*Active Commitments:* ${milestones.filter(m => m.status === 'in_progress').length}`,
        }
      : webhook.format === 'discord'
      ? {
          content: `**Manasyn Reflection Update**\n**User:** ${user.displayName || user.email}\n**Latest Session:** ${latestEntry?.title || 'No sessions yet'}\n**Active Commitments:** ${milestones.filter(m => m.status === 'in_progress').length}`,
        }
      : {
          app: 'Manasyn',
          event: 'reflection_export',
          user: { id: user.uid, email: user.email },
          totalEntries: validEntries.length,
          latestEntry: latestEntry || null,
          exportedAt: new Date().toISOString(),
        };

    try {
      // Direct outbound webhook dispatch
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.secretToken ? { 'X-Manasyn-Secret': webhook.secretToken } : {}),
        },
        mode: 'no-cors', // handle standard external webhook endpoints safely
        body: JSON.stringify(payload),
      });

      setWebhookStatus({
        id: webhook.id,
        message: `Dispatched test payload to ${webhook.name}.`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Webhook dispatch error:', err);
      setWebhookStatus({
        id: webhook.id,
        message: err instanceof Error ? err.message : 'Failed to dispatch webhook payload.',
        type: 'error',
      });
    } finally {
      setIsDispatching(null);
      setTimeout(() => setWebhookStatus(null), 5000);
    }
  };

  const handleDownloadArchive = () => {
    setIsExporting(true);

    try {
      let fileContent = '';
      let fileName = '';
      let mimeType = '';

      if (format === 'json') {
        const exportData = {
          exportedAt: new Date().toISOString(),
          version: '2.0.0',
          application: 'Manasyn Clarity Engine',
          user: {
            id: user.uid,
            email: user.email,
            displayName: user.displayName,
          },
          reflections: validEntries.map((entry) => ({
            id: includeRawSystemIds ? entry.id : undefined,
            title: entry.title,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            tags: entry.tags,
            location: includeLocations ? entry.location : undefined,
            messages: entry.messages.map((m) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              mode: m.mode,
              clarityCard: m.clarityCard,
            })),
          })),
          milestones: includeMilestones ? milestones : undefined,
        };

        fileContent = JSON.stringify(exportData, null, 2);
        fileName = `manasyn-reflections-export-${new Date().toISOString().slice(0, 10)}.json`;
        mimeType = 'application/json;charset=utf-8;';
      } else {
        // Markdown Export
        let md = `# Manasyn Reflection Journal\n`;
        md += `*Exported on: ${new Date().toLocaleString()}*\n`;
        md += `*User: ${user.displayName || user.email || 'Manasyn User'}*\n`;
        md += `*Total Reflections: ${validEntries.length}*\n\n---\n\n`;

        if (includeMilestones && milestones.length > 0) {
          md += `## Strategic Commitments & Milestones\n\n`;
          milestones.forEach((m) => {
            const check = m.status === 'achieved' ? '[x]' : '[ ]';
            md += `- ${check} **${m.title}** (${m.category})${m.targetTimeframe ? ` — Target: ${m.targetTimeframe}` : ''}\n`;
            if (m.notes) md += `  - *Notes:* ${m.notes}\n`;
          });
          md += `\n---\n\n`;
        }

        md += `## Reflection Sessions\n\n`;
        validEntries.forEach((entry, idx) => {
          md += `### ${idx + 1}. ${entry.title || 'Untitled Reflection'}\n`;
          md += `- **Date:** ${new Date(entry.createdAt).toLocaleString()}\n`;
          if (entry.tags && entry.tags.length > 0) {
            md += `- **Tags:** ${entry.tags.map((t) => `#${t}`).join(', ')}\n`;
          }
          if (includeLocations && entry.location?.placeName) {
            md += `- **Location:** ${entry.location.placeName}\n`;
          }
          md += `\n`;

          entry.messages.forEach((msg) => {
            const roleName = msg.role === 'user' ? 'User' : 'Manasyn';
            md += `#### **${roleName}** (${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})\n\n`;
            md += `${msg.content}\n\n`;

            if (msg.clarityCard) {
              md += `> **Clarity Synthesis:**\n`;
              md += `> - *Core Dilemma:* ${msg.clarityCard.coreDilemma || msg.clarityCard.whatIHeard}\n`;
              md += `> - *Suggested Next Step:* ${msg.clarityCard.suggestedNextStep}\n`;
              if (msg.clarityCard.extractedCommitment) {
                md += `> - *Commitment:* ${msg.clarityCard.extractedCommitment.title} (${msg.clarityCard.extractedCommitment.targetTimeframe || 'Planned'})\n`;
              }
              md += `\n`;
            }
          });

          md += `\n---\n\n`;
        });

        fileContent = md;
        fileName = `manasyn-reflections-export-${new Date().toISOString().slice(0, 10)}.md`;
        mimeType = 'text/markdown;charset=utf-8;';
      }

      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 3000);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      id="export-full-page-view" 
      className="flex-1 overflow-y-auto p-4 sm:p-8 pb-28 md:pb-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-w-0 transition-colors"
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center shadow-xs shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
                Export &amp; Integrations
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-sans">
                Export your full reflection archive or stream data to external tools via Webhooks.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 self-start sm:self-auto font-sans">
            <button
              id="export-tab-archive"
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'archive'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Archive Export
            </button>
            <button
              id="export-tab-webhooks"
              type="button"
              onClick={() => setActiveTab('webhooks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'webhooks'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Webhooks
            </button>
          </div>
        </div>

        {activeTab === 'archive' ? (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Available Reflections
                </span>
                <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                  {validEntries.length}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  Total Messages
                </span>
                <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                  {totalMessages}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  Tracked Commitments
                </span>
                <p className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white mt-1">
                  {milestones.length}
                </p>
              </div>
            </div>

            {/* Export Configuration Form */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                  Archive Format &amp; Scope
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                  Choose the structure that best fits your notes system or external data pipeline.
                </p>
              </div>

              {/* Format Selection Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  id="format-select-markdown"
                  onClick={() => setFormat('markdown')}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    format === 'markdown'
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${format === 'markdown' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Formatted Markdown (.md)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Ideal for Obsidian, Notion, Bear, Logseq, and human-readable reading.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  id="format-select-json"
                  onClick={() => setFormat('json')}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    format === 'json'
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${format === 'json' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <Code className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Complete JSON Archive (.json)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Structured schema containing raw timestamps, synthesis cards, and tags.
                    </p>
                  </div>
                </button>
              </div>

              {/* Data Inclusion Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer text-xs sm:text-sm font-sans">
                  <input
                    type="checkbox"
                    checked={includeLocations}
                    onChange={(e) => setIncludeLocations(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Include Location context &amp; place names</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs sm:text-sm font-sans">
                  <input
                    type="checkbox"
                    checked={includeMilestones}
                    onChange={(e) => setIncludeMilestones(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Target className="w-3.5 h-3.5 text-purple-500" />
                    <span>Include Strategic Commitments &amp; Milestones</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs sm:text-sm font-sans">
                  <input
                    type="checkbox"
                    checked={includeRawSystemIds}
                    onChange={(e) => setIncludeRawSystemIds(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Include internal database identifiers (IDs)</span>
                  </div>
                </label>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  id="download-archive-btn"
                  type="button"
                  disabled={isExporting || validEntries.length === 0}
                  onClick={handleDownloadArchive}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-md ${
                    isExporting || validEntries.length === 0
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-98'
                  }`}
                >
                  {exportedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Archive Downloaded</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Archive ({format.toUpperCase()})</span>
                    </>
                  )}
                </button>
                {validEntries.length === 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                    No reflections available to export.
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Webhook Configuration Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Configured Webhook Endpoints</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                  Dispatch reflection summaries automatically to your team channels or workflow automations.
                </p>
              </div>

              {webhookStatus && (
                <div className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 font-sans ${
                  webhookStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}>
                  {webhookStatus.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span>{webhookStatus.message}</span>
                </div>
              )}

              {/* List of Destinations */}
              {webhooks.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2 font-sans">
                  <Webhook className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No webhooks configured yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Add a Slack Incoming Webhook, Discord Channel Webhook, or your custom API endpoint below.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div
                      key={wh.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {wh.name}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {wh.format}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-md">
                          {wh.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isDispatching === wh.id}
                          onClick={() => handleTestDispatch(wh)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isDispatching === wh.id ? 'Sending...' : 'Test Payload'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Webhook Form */}
              <form onSubmit={handleAddWebhook} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 font-sans">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Add New Webhook Destination
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Label / Target
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. #personal-clarity"
                      value={newWebhookName}
                      onChange={(e) => setNewWebhookName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Payload Format
                    </label>
                    <select
                      value={newWebhookFormat}
                      onChange={(e) => setNewWebhookFormat(e.target.value as 'slack' | 'discord' | 'custom')}
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="slack">Slack Incoming Webhook</option>
                      <option value="discord">Discord Channel Webhook</option>
                      <option value="custom">Standard JSON Endpoint</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Auth Token / Secret (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Bearer token or signature"
                      value={newWebhookSecret}
                      onChange={(e) => setNewWebhookSecret(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Webhook Destination URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <button
                  id="add-webhook-btn"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Webhook Destination</span>
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

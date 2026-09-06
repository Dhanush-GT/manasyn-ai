import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Check, 
  X, 
  Trash2, 
  Plus, 
  Radio, 
  ExternalLink, 
  AlertCircle, 
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Share2
} from 'lucide-react';
import type { UserProfile, ReflectionEntry, WebhookConfig, WebhookTargetType } from '../types';
import { saveWebhookConfig, deleteWebhookConfig, subscribeWebhookConfigs } from '../lib/firebase';

interface WebhookExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentEntry?: ReflectionEntry;
  onEntryDispatched?: (entryId: string) => void;
}

export const WebhookExportModal: React.FC<WebhookExportModalProps> = ({
  isOpen,
  onClose,
  user,
  currentEntry,
  onEntryDispatched,
}) => {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [targetType, setTargetType] = useState<WebhookTargetType>('slack');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);

  // Subscribe to user webhook configs
  useEffect(() => {
    if (!isOpen || !user.uid) return;
    const unsub = subscribeWebhookConfigs(
      user.uid,
      (data) => setConfigs(data),
      (err) => console.error('Error fetching webhook configs:', err)
    );
    return () => unsub();
  }, [isOpen, user.uid]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/webhooks/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          targetType,
          userEmail: user.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestResult({
          success: false,
          message: data.error || 'Webhook test failed.',
        });
      } else {
        setTestResult({
          success: true,
          message: 'Connection verified! Webhook responded successfully.',
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error testing webhook.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!webhookUrl.trim()) return;
    const newConfig: WebhookConfig = {
      id: `wh-${Date.now()}`,
      userId: user.uid,
      targetType,
      webhookUrl: webhookUrl.trim(),
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveWebhookConfig(user.uid, newConfig);
      setWebhookUrl('');
      setTestResult(null);
    } catch (err) {
      console.error('Failed to save webhook config:', err);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      await deleteWebhookConfig(user.uid, configId);
    } catch (err) {
      console.error('Failed to delete config:', err);
    }
  };

  const handleDispatchActiveEntry = async (config: WebhookConfig) => {
    if (!currentEntry) return;
    setIsDispatching(true);
    setDispatchResult(null);

    // Build entry summary
    const summaryText = currentEntry.summary || (
      currentEntry.messages.length > 0
        ? currentEntry.messages.map((m) => `${m.role === 'user' ? 'User' : 'Aura'}: ${m.content}`).join('\n\n')
        : 'Reflection without messages'
    );

    try {
      const res = await fetch('/api/webhooks/dispatch-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          targetType: config.targetType,
          title: currentEntry.title || 'Untitled Reflection',
          summary: summaryText,
          locationName: currentEntry.location?.placeName || '',
          date: currentEntry.updatedAt || currentEntry.createdAt,
          userEmail: user.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDispatchResult(`Dispatch failed: ${data.error || 'Server error'}`);
      } else {
        setDispatchResult('✨ Reflection summary successfully dispatched!');
        if (onEntryDispatched) {
          onEntryDispatched(currentEntry.id);
        }
      }
    } catch (err: unknown) {
      setDispatchResult(`Error: ${err instanceof Error ? err.message : 'Dispatch failed'}`);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div
      id="webhook-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        id="webhook-export-card"
        className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800/80 text-purple-400 flex items-center justify-center shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-display">
                Connections
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Share selected insights with connected apps (Slack, Discord, or custom webhooks)
              </p>
            </div>
          </div>
          <button
            id="close-webhook-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Security Note */}
          <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs text-cyan-300 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>
              All webhook dispatches execute via the server proxy with strict SSRF filtering to keep secrets safe.
            </span>
          </div>

          {/* Quick Dispatch Active Entry */}
          {currentEntry && configs.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Dispatch Active Session
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-xs font-sans">
                  "{currentEntry.title}"
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {configs.map((cfg) => (
                  <button
                    key={cfg.id}
                    id={`dispatch-to-${cfg.id}`}
                    type="button"
                    disabled={isDispatching}
                    onClick={() => handleDispatchActiveEntry(cfg)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-950/30 transition-all"
                  >
                    <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-bounce' : ''}`} />
                    <span>Send to {cfg.targetType.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {dispatchResult && (
                <p className="text-xs font-semibold text-cyan-400 pt-1">
                  {dispatchResult}
                </p>
              )}
            </div>
          )}

          {/* Existing Configs List */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Active Configured Destinations ({configs.length})
            </h4>

            {configs.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono italic">
                No external webhooks configured yet. Add your Slack or Discord endpoint below.
              </p>
            ) : (
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden font-mono">
                {configs.map((cfg) => (
                  <div key={cfg.id} className="p-3 bg-slate-950/80 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="px-2 py-0.5 rounded-md font-bold uppercase text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                        {cfg.targetType}
                      </span>
                      <span className="text-slate-300 font-mono text-[11px] truncate max-w-sm">
                        {cfg.webhookUrl}
                      </span>
                    </div>

                    <button
                      id={`delete-webhook-${cfg.id}`}
                      type="button"
                      onClick={() => handleDeleteConfig(cfg.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Remove Webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Webhook Form */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 font-mono">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Connect New Webhook</span>
            </h4>

            <div className="grid grid-cols-3 gap-2">
              {(['slack', 'discord', 'custom_json'] as WebhookTargetType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    targetType === type
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type === 'slack' ? 'Slack Incoming' : type === 'discord' ? 'Discord Webhook' : 'Custom JSON'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Webhook Endpoint URL *
              </label>
              <input
                id="webhook-url-input"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 font-sans"
              />
            </div>

            {testResult && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                id="test-webhook-btn"
                type="button"
                disabled={!webhookUrl.trim() || isTesting}
                onClick={handleTestConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>

              <button
                id="save-webhook-btn"
                type="button"
                disabled={!webhookUrl.trim()}
                onClick={handleSaveConfig}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Webhook</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex justify-end font-mono">
          <button
            id="close-webhook-footer-btn"
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

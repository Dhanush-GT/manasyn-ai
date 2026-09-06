import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  FileJson, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  MessageSquare, 
  Database,
  Sparkles
} from 'lucide-react';
import type { ReflectionEntry, UserProfile } from '../types';

interface WorkspaceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ReflectionEntry[];
  user: UserProfile;
}

export const WorkspaceExportModal: React.FC<WorkspaceExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  user,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'json'>('markdown');
  const [includeLocations, setIncludeLocations] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  if (!isOpen) return null;

  const totalTurns = entries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  const mappedCount = entries.filter((e) => e.location?.placeName).length;

  const generateMarkdownArchive = (): string => {
    const timestamp = new Date().toISOString();
    let md = '';

    // Metadata Frontmatter
    if (includeMetadata) {
      md += `---\n`;
      md += `title: "Manasyn Personal Journal Archive"\n`;
      md += `export_date: "${timestamp}"\n`;
      md += `user_email: "${user.email || 'anonymous'}"\n`;
      md += `user_name: "${user.displayName || 'Manasyn User'}"\n`;
      md += `total_reflections: ${entries.length}\n`;
      md += `total_messages: ${totalTurns}\n`;
      md += `mapped_coordinates: ${mappedCount}\n`;
      md += `storage_backend: "Cloud Firestore (Owner-Bound Subcollection)"\n`;
      md += `---\n\n`;
    }

    md += `# ⚡ Manasyn — Personal Gemini Journal & Memory Archive\n\n`;
    md += `*Exported on ${new Date().toLocaleString()} for ${user.displayName || user.email || 'Authenticated Operator'}*\n\n`;
    md += `## 📑 Table of Contents\n\n`;

    entries.forEach((entry, idx) => {
      const title = entry.title || `Reflection ${idx + 1}`;
      const anchor = `entry-${idx + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const dateStr = new Date(entry.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
      md += `${idx + 1}. [${title} (${dateStr})](#${anchor})\n`;
    });

    md += `\n---\n\n`;

    // Entries body
    entries.forEach((entry, idx) => {
      const title = entry.title || `Reflection ${idx + 1}`;
      const anchor = `entry-${idx + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const createdDate = new Date(entry.createdAt).toLocaleString();
      const updatedDate = new Date(entry.updatedAt).toLocaleString();

      md += `<a name="${anchor}"></a>\n`;
      md += `## ${idx + 1}. ${title}\n\n`;
      md += `**Created:** ${createdDate} | **Last Updated:** ${updatedDate}\n\n`;

      if (includeLocations && entry.location?.placeName) {
        md += `📍 **Location Sanctuary:** ${entry.location.placeName}`;
        if (entry.location.formattedAddress) {
          md += ` (${entry.location.formattedAddress})`;
        }
        if (typeof entry.location.latitude === 'number' && typeof entry.location.longitude === 'number') {
          md += ` [${entry.location.latitude.toFixed(4)}°N, ${entry.location.longitude.toFixed(4)}°W]`;
        }
        md += `\n\n`;
      }

      if (entry.tags && entry.tags.length > 0) {
        md += `🏷️ **Tags:** ${entry.tags.map((t) => `\`#${t}\``).join(' ')}\n\n`;
      }

      if (entry.summary) {
        md += `> **Executive Summary:** ${entry.summary}\n\n`;
      }

      md += `### Messages (${entry.messages?.length || 0})\n\n`;

      if (!entry.messages || entry.messages.length === 0) {
        md += `*(No dialogue recorded for this session)*\n\n`;
      } else {
        entry.messages.forEach((msg) => {
          const roleLabel = msg.role === 'user' ? `👤 **User**` : `✨ **Manasyn**`;
          const modeLabel = msg.mode ? ` \`[Mode: ${msg.mode}]\`` : '';
          const msgTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          md += `${roleLabel}${modeLabel} *(at ${msgTime})*:\n\n`;
          md += `${msg.content}\n\n`;
        });
      }

      md += `---\n\n`;
    });

    return md;
  };

  const generateJsonArchive = (): string => {
    const archivePayload = {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      },
      stats: {
        totalReflections: entries.length,
        totalMessages: totalTurns,
        mappedSanctuaries: mappedCount,
      },
      reflections: entries.map((e) => ({
        id: e.id,
        title: e.title,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        tags: e.tags || [],
        isPinned: Boolean(e.isPinned),
        location: includeLocations ? e.location || null : null,
        summary: e.summary || null,
        messages: (e.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          mode: m.mode || 'reflect',
        })),
      })),
    };

    return JSON.stringify(archivePayload, null, 2);
  };

  const handleExecuteExport = () => {
    setIsExporting(true);
    setExportedSuccess(false);

    try {
      let content = '';
      let mimeType = '';
      let fileExtension = '';

      const dateStamp = new Date().toISOString().slice(0, 10);

      if (selectedFormat === 'markdown') {
        content = generateMarkdownArchive();
        mimeType = 'text/markdown;charset=utf-8;';
        fileExtension = 'md';
      } else {
        content = generateJsonArchive();
        mimeType = 'application/json;charset=utf-8;';
        fileExtension = 'json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `manasyn-journal-backup-${dateStamp}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 3000);
    } catch (err) {
      console.error('Export generation failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      id="workspace-export-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="workspace-export-modal-card"
        className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white font-display">
                Export your data
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Full structured data archive direct from your isolated Firestore subcollection
              </p>
            </div>
          </div>

          <button
            id="close-export-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          {/* Metrics Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Sessions</span>
              <span className="text-base font-bold text-white">{entries.length}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Messages</span>
              <span className="text-base font-bold text-cyan-400">{totalTurns}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Coordinates</span>
              <span className="text-base font-bold text-indigo-400">{mappedCount}</span>
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 block">
              Choose Export Format:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat('markdown')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  selectedFormat === 'markdown'
                    ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500 shadow-xs'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileText className={`w-5 h-5 ${selectedFormat === 'markdown' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {selectedFormat === 'markdown' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-display">Structured Markdown (.md)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                    Formatted with TOC, headers, metadata frontmatter, and dialogue logs.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  selectedFormat === 'json'
                    ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500 shadow-xs'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileJson className={`w-5 h-5 ${selectedFormat === 'json' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {selectedFormat === 'json' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-display">Full JSON Backup (.json)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                    Machine-parseable raw structure for portable data pipelines.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Options checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={includeLocations}
                onChange={(e) => setIncludeLocations(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-cyan-500 bg-slate-800 border-slate-700"
              />
              <span>Include tagged geographic locations & coordinates</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-cyan-500 bg-slate-800 border-slate-700"
              />
              <span>Include YAML frontmatter metadata & table of contents</span>
            </label>
          </div>

          {/* Privacy Guarantee Badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              100% Client-Side generation. Workspace data never passes through third-party servers.
            </span>
          </div>

          {exportedSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Archive downloaded successfully!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            id="execute-workspace-export-btn"
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting || entries.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download {selectedFormat.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

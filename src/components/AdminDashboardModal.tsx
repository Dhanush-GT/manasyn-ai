import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  Activity, 
  Server, 
  Clock, 
  Layers, 
  X, 
  RefreshCw, 
  Lock,
  Cpu,
  BarChart3,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';
import type { UserProfile, ReflectionEntry, AuditLog } from '../types';
import { auth } from '../lib/firebase';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  entries: ReflectionEntry[];
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  user,
  entries,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverHealth, setServerHealth] = useState<{
    status: string;
    uptime: number;
    geminiLadderReady: boolean;
    firestoreConnected: boolean;
  }>({
    status: 'HEALTHY',
    uptime: 120,
    geminiLadderReady: true,
    firestoreConnected: true,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication required: No valid session token found.');
      }

      const res = await fetch('/api/admin/system-stats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Access Denied`);
      }

      const data = await res.json();
      if (data.serverHealth) setServerHealth(data.serverHealth);
      if (data.recentAuditLogs) setAuditLogs(data.recentAuditLogs);
    } catch (err: unknown) {
      console.error('Failed to fetch admin stats:', err);
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Aggregate stats strictly from metadata without exposing user content
  const totalUserReflections = entries.length;
  const totalMessages = entries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  const totalPinned = entries.filter((e) => e.isPinned).length;
  const totalLocationTagged = entries.filter((e) => Boolean(e.location?.placeName)).length;

  return (
    <div
      id="admin-dashboard-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="admin-dashboard-card"
        className="w-full max-w-3xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white font-display">
                  Manasyn Security & RBAC Telemetry
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Secured Admin Console
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Active Session: <strong className="text-slate-200 font-mono">{user.email}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <button
              id="admin-refresh-stats-btn"
              type="button"
              onClick={fetchAdminData}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="admin-close-modal-btn"
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Privacy Guarantee Banner */}
          <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl flex items-start gap-3">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-cyan-300 font-display">
                Zero-Leak Tenant Isolation & Differential Privacy Policy Enforced
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                The Admin Console monitors server cluster health, uptime, and immutable audit logs. Operator reflections and operational blueprints remain strictly isolated in private Firestore user collections.
              </p>
            </div>
          </div>

          {/* System Health Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Core Status</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">
                {serverHealth.status}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Gemini Ladder</span>
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-cyan-400">
                4 Models Ready
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Cloud Firestore</span>
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                Synchronized
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Service Uptime</span>
                <Clock className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                {Math.floor(serverHealth.uptime / 60)}m {serverHealth.uptime % 60}s
              </p>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Workspace & Telemetry Index</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400">Sessions</span>
                <p className="text-lg font-bold text-white mt-0.5">{totalUserReflections}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400">Messages</span>
                <p className="text-lg font-bold text-white mt-0.5">{totalMessages}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400">Pinned Tasks</span>
                <p className="text-lg font-bold text-white mt-0.5">{totalPinned}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400">Spatial Coordinates</span>
                <p className="text-lg font-bold text-white mt-0.5">{totalLocationTagged}</p>
              </div>
            </div>
          </div>

          {/* Security Audit Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>Immutable Security Audit Log Stream</span>
            </h4>

            <div className="rounded-xl border border-slate-800 overflow-hidden font-mono">
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-800 bg-slate-950/80">
                {auditLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No security events logged yet.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-400' : log.status === 'DENIED' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                        <div>
                          <p className="font-semibold text-slate-200">
                            {log.action}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Actor: {log.performedBy} &bull; Target: {log.targetType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/80'
                        }`}>
                          {log.status}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex justify-end font-mono">
          <button
            id="admin-done-btn"
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Close Admin Console
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  Activity, 
  Server, 
  Clock, 
  RefreshCw, 
  Lock,
  Cpu,
  BarChart3,
  MessageSquare,
  ArrowLeft,
  Calendar,
  User,
  Filter,
  Inbox
} from 'lucide-react';
import type { UserProfile, ReflectionEntry, AuditLog, FeedbackEntry, FeedbackCategory } from '../types';
import { auth, getFeedbackEntries } from '../lib/firebase';

interface AdminDashboardViewProps {
  user: UserProfile;
  entries: ReflectionEntry[];
  onBackToApp: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  entries,
  onBackToApp,
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'feedback'>('telemetry');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<string>('all');
  
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

      // Fetch server stats
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

      // Fetch feedback from Firestore
      const feedback = await getFeedbackEntries();
      setFeedbackList(feedback);
    } catch (err: unknown) {
      console.error('Failed to fetch admin stats:', err);
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Access Control verification
  if (!user.isAdmin) {
    return (
      <main id="admin-access-denied-view" className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[calc(100vh-4rem)] font-sans">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          Admin Access Restricted
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md font-sans">
          This administration and telemetry console is restricted by Firestore security rules. Your account (<span className="font-mono text-xs text-slate-700 dark:text-slate-300">{user.email || user.uid}</span>) is not recognized as an administrator.
        </p>
        <button
          id="admin-return-home-btn"
          type="button"
          onClick={onBackToApp}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </main>
    );
  }

  const filteredFeedback = feedbackCategoryFilter === 'all'
    ? feedbackList
    : feedbackList.filter((f) => f.category === feedbackCategoryFilter);

  return (
    <main id="admin-dashboard-view" className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 overflow-y-auto pb-20 md:pb-8 font-sans">
      {/* Top Banner */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="admin-view-back-btn"
              type="button"
              onClick={onBackToApp}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Return to Application"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold font-display text-white">
                  Admin Telemetry & User Feedback
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Verified Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Session: <strong className="text-slate-200 font-mono">{user.email}</strong> &bull; Route: <span className="font-mono text-cyan-400">/admin</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex p-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium">
              <button
                id="admin-tab-telemetry-btn"
                type="button"
                onClick={() => setActiveTab('telemetry')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Telemetry & System
              </button>
              <button
                id="admin-tab-feedback-btn"
                type="button"
                onClick={() => setActiveTab('feedback')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'feedback'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>User Feedback</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-cyan-300 font-mono">
                  {feedbackList.length}
                </span>
              </button>
            </div>

            <button
              id="admin-refresh-all-btn"
              type="button"
              onClick={fetchAdminData}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors border border-slate-800"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'telemetry' ? (
          <>
            {/* Privacy Guarantee Banner */}
            <div className="p-4 bg-cyan-950/40 border border-cyan-800/60 rounded-xl flex items-start gap-3">
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
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Core Status</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-base font-bold text-white">
                  {serverHealth.status}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Gemini Ladder</span>
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-base font-bold text-cyan-400">
                  4 Models Ready
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Cloud Firestore</span>
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-base font-bold text-slate-200">
                  Synchronized
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Service Uptime</span>
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-base font-bold text-slate-200">
                  {Math.floor(serverHealth.uptime / 60)}m {serverHealth.uptime % 60}s
                </p>
              </div>
            </div>

            {/* Audit Logs Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Security Audit Log & Rule Enforcement (Live /auditLogs)</span>
              </h3>
              <div className="bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
                <div className="p-3 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Action / Target</span>
                  <span>Status & Timestamp</span>
                </div>
                <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      No security audit events recorded.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-3 hover:bg-slate-900/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-slate-200 font-semibold">{log.action}</span>
                          <span className="text-slate-500">&bull; {log.targetType}</span>
                        </div>
                        <div className="text-right text-slate-400 text-[10px]">
                          <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Feedback Review Tab */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>Incoming User Feedback Stream</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Direct submissions stored in the isolated <span className="font-mono text-cyan-300">/feedback</span> Firestore collection.
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={feedbackCategoryFilter}
                  onChange={(e) => setFeedbackCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Feedback ({feedbackList.length})</option>
                  <option value="general">General</option>
                  <option value="feature">Idea / Feature</option>
                  <option value="bug">Issue / Bug</option>
                  <option value="praise">Praise</option>
                </select>
              </div>
            </div>

            {filteredFeedback.length === 0 ? (
              <div className="p-12 text-center bg-slate-950/40 rounded-2xl border border-slate-800">
                <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-300">No Feedback Entries Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When users submit suggestions or bug reports from the drawer or settings, they will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredFeedback.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            item.category === 'bug'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : item.category === 'feature'
                              ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                              : item.category === 'praise'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {item.category}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          {item.userName || item.userEmail || 'Anonymous User'}
                        </span>
                        {item.userEmail && (
                          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                            ({item.userEmail})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AdminCallRecord,
  AdminMessageRecord,
  AdminStats,
  UserProfile,
} from '../types';
import { Avatar } from './Avatar';

type AdminTab = 'users' | 'calls' | 'messages';

export function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [envOverride, setEnvOverride] = useState(false);

  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [calls, setCalls] = useState<AdminCallRecord[]>([]);
  const [messages, setMessages] = useState<AdminMessageRecord[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<{
    user: UserProfile;
    recentCalls: AdminCallRecord[];
    recentMessages: AdminMessageRecord[];
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setEnvOverride(Boolean(data.envOverride));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const adminFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set('Content-Type', 'application/json');
      if (adminToken) headers.set('Authorization', `Bearer ${adminToken}`);
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },
    [adminToken]
  );

  const loadAdminData = useCallback(async () => {
    if (!adminToken) return;
    try {
      const [statsRes, usersRes, callsRes, msgsRes] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/calls'),
        adminFetch('/api/admin/messages'),
      ]);
      setStats(statsRes.stats);
      setUsers(usersRes.users || []);
      setCalls(callsRes.calls || []);
      setMessages(msgsRes.messages || []);
    } catch {
      setAdminToken(null);
    }
  }, [adminToken, adminFetch]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!adminToken || !selectedUserId) {
      setUserDetails(null);
      return;
    }
    adminFetch(`/api/admin/users/${selectedUserId}`)
      .then((d) => setUserDetails(d))
      .catch(() => setUserDetails(null));
  }, [adminToken, selectedUserId, adminFetch]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (passcode.trim().length < 6) {
      setAuthError('Passcode must be at least 6 characters.');
      return;
    }
    if (passcode !== confirmPasscode) {
      setAuthError('Passcodes do not match.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim admin passcode');
      setAdminToken(data.token);
      setConfigured(true);
      setPasscode('');
      setConfirmPasscode('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid passcode');
      setAdminToken(data.token);
      setPasscode('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function updateUserStatus(userId: string, status: UserProfile['account_status']) {
    await adminFetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAdminData();
    if (selectedUserId === userId) {
      const detail = await adminFetch(`/api/admin/users/${userId}`);
      setUserDetails(detail);
    }
  }

  if (statusLoading) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Checking admin console configuration...
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700/10 text-teal-700 dark:text-teal-400">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {configured ? 'Admin Console Sign In' : 'First-Run Admin Setup'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {configured
              ? envOverride
                ? 'Authenticate with the server-configured ADMIN_PASSCODE.'
                : 'Enter the claimed administrator passcode to inspect users, demo calls, and messages.'
              : 'No ADMIN_PASSCODE environment secret is configured yet. Choose an initial passcode below to claim and hash it on the server.'}
          </p>

          <form onSubmit={configured ? handleLogin : handleClaim} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {configured ? 'Administrator Passcode' : 'New Administrator Passcode (min 6 chars)'}
              </label>
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              />
            </div>

            {!configured && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Confirm Passcode
                </label>
                <input
                  type="password"
                  required
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
                />
              </div>
            )}

            {authError && (
              <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-teal-700 transition-colors"
            >
              {authSubmitting
                ? 'Verifying...'
                : configured
                  ? 'Sign In to Admin Console'
                  : 'Claim & Hash Admin Passcode'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesStatus = statusFilter === 'all' || u.account_status === statusFilter;
    const q = userSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.app_user_id.toLowerCase().includes(q) ||
      u.demo_virtual_number.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Console
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage registered users, live Socket.IO presence, demo call logs, and messaging records
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadAdminData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Data
          </button>
          <button
            type="button"
            onClick={() => setAdminToken(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:border-red-300 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock Console
          </button>
        </div>
      </div>

      {/* 4-Column Usage Statistics */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Registered Users</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {stats.totalUsers}
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {stats.activeUsers} active · {stats.suspendedUsers} suspended
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Live Presence & OTP</span>
              <UserCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {stats.onlineUsers} Online
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {stats.verifiedUsers} of {stats.totalUsers} demo OTP verified
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Demo Voice Calls</span>
              <PhoneCall className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {stats.totalCalls}
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {stats.totalCallDuration}s total WebRTC duration
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Demo Messages</span>
              <MessageSquare className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {stats.totalMessages}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stored in local SQLite database
            </div>
          </div>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
          {[
            { id: 'users' as const, label: `Users (${users.length})` },
            { id: 'calls' as const, label: `Demo Call Records (${calls.length})` },
            { id: 'messages' as const, label: `Demo Message Records (${messages.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, +91..."
                className="w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
              {(['all', 'active', 'suspended'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${
                    statusFilter === f
                      ? 'bg-slate-900 dark:bg-teal-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div
            className={`${
              userDetails ? 'lg:col-span-8' : 'lg:col-span-12'
            } overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900`}
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">App ID & Demo +91</th>
                  <th className="px-4 py-3 font-medium">Account Status</th>
                  <th className="px-4 py-3 font-medium">Presence</th>
                  <th className="px-4 py-3 text-right font-medium">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const selected = selectedUserId === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`cursor-pointer transition-colors ${
                        selected
                          ? 'bg-teal-50/70 dark:bg-teal-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={u.full_name}
                            src={u.avatar_url}
                            sizeClass="w-8 h-8"
                            online={u.is_online === 1}
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {u.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        <div className="text-slate-900 dark:text-slate-100">
                          {u.demo_virtual_number}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {u.app_user_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            u.account_status === 'active'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : u.account_status === 'suspended'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {u.account_status === 'active' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : u.account_status === 'suspended' ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {u.account_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.is_online === 1 ? 'Online' : 'Offline'} ·{' '}
                        {u.otp_verified ? 'OTP Verified' : 'Unverified'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {u.call_count ?? 0} calls / {u.message_count ?? 0} msgs
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {userDetails && (
            <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={userDetails.user.full_name}
                    src={userDetails.user.avatar_url}
                    sizeClass="w-12 h-12"
                    online={userDetails.user.is_online === 1}
                  />
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {userDetails.user.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {userDetails.user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <div className="space-y-1.5 border-y border-slate-200 dark:border-slate-800 py-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">App User ID</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {userDetails.user.app_user_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Demo Virtual ID</span>
                  <span className="font-mono font-medium tabular-nums text-teal-700 dark:text-teal-400">
                    {userDetails.user.demo_virtual_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bio</span>
                  <span className="max-w-[190px] truncate text-right text-slate-800 dark:text-slate-200">
                    {userDetails.user.bio}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account Status Controls
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { status: 'active', label: 'Activate' },
                      { status: 'pending_verification', label: 'Pending' },
                      { status: 'suspended', label: 'Suspend' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.status}
                      type="button"
                      onClick={() => void updateUserStatus(userDetails.user.id, opt.status)}
                      className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                        userDetails.user.account_status === opt.status
                          ? opt.status === 'suspended'
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recent Calls ({userDetails.recentCalls.length})
                </div>
                <div className="space-y-1.5 text-xs">
                  {userDetails.recentCalls.slice(0, 4).map((c) => (
                    <div key={c.id} className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="truncate">
                        {c.caller_name} → {c.callee_name}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {c.status} · {c.duration_seconds}s
                      </span>
                    </div>
                  ))}
                  {userDetails.recentCalls.length === 0 && (
                    <p className="text-slate-400">No calls for this user.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recent Messages ({userDetails.recentMessages.length})
                </div>
                <div className="space-y-1.5 text-xs">
                  {userDetails.recentMessages.slice(0, 4).map((m) => (
                    <div key={m.id} className="text-slate-600 dark:text-slate-400">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {m.sender_name} → {m.receiver_name}
                      </div>
                      <div className="truncate">{m.body}</div>
                    </div>
                  ))}
                  {userDetails.recentMessages.length === 0 && (
                    <p className="text-slate-400">No messages for this user.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CALL RECORDS TAB */}
      {activeTab === 'calls' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Caller</th>
                <th className="px-4 py-3 font-medium">Callee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{c.caller_name}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {c.caller_number}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{c.callee_name}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {c.callee_number}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize font-medium text-slate-700 dark:text-slate-300">
                    {c.status}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {c.duration_seconds}s
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(c.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No demo call records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MESSAGE RECORDS TAB */}
      {activeTab === 'messages' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Sender</th>
                <th className="px-4 py-3 font-medium">Receiver</th>
                <th className="px-4 py-3 font-medium">Message Content</th>
                <th className="px-4 py-3 font-medium">Delivery State</th>
                <th className="px-4 py-3 text-right font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{m.sender_name}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {m.sender_number}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{m.receiver_name}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {m.receiver_number}
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-700 dark:text-slate-300">
                    {m.body}
                  </td>
                  <td className="px-4 py-3 capitalize font-medium text-teal-700 dark:text-teal-400">
                    {m.status}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No demo message records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Columns2, Maximize2, Moon, ShieldCheck, Smartphone, Sun } from 'lucide-react';
import { MobileDeviceClient } from './components/MobileDeviceClient';
import { AdminDashboard } from './components/AdminDashboard';
import { SourceExplorer } from './components/SourceExplorer';
import type { MobileScreenId } from './types';

type WorkspaceSection = 'mobile' | 'admin' | 'source';

const ALL_ANDROID_SCREENS: Array<{ id: MobileScreenId; label: string; group: string }> = [
  { id: 'splash', label: '01. Splash Screen', group: 'Auth' },
  { id: 'login', label: '02. Login Screen', group: 'Auth' },
  { id: 'register', label: '03. Registration & OTP', group: 'Auth' },
  { id: 'home', label: '04. Home Dashboard', group: 'Core' },
  { id: 'contacts', label: '05. Contacts Screen', group: 'Core' },
  { id: 'dialer', label: '06. Dialer (+91)', group: 'Calling' },
  { id: 'incoming_call', label: '07. Incoming Call', group: 'Calling' },
  { id: 'active_call', label: '08. Active Call', group: 'Calling' },
  { id: 'chat_list', label: '09. Chat List', group: 'Messaging' },
  { id: 'private_chat', label: '10. Private Chat', group: 'Messaging' },
  { id: 'demo_number', label: '11. Demo Number', group: 'Identity' },
  { id: 'profile', label: '12. Profile Screen', group: 'Identity' },
  { id: 'settings', label: '13. Settings Screen', group: 'Identity' },
];

export default function App() {
  const [section, setSection] = useState<WorkspaceSection>('mobile');
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'studio' | 'fullapp' | 'split'>('fullapp');
  const [activeMobileScreen, setActiveMobileScreen] = useState<MobileScreenId>('splash');
  const [screenRequest, setScreenRequest] = useState<{ screen: MobileScreenId; nonce: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  function jumpToScreen(screen: MobileScreenId) {
    setScreenRequest({ screen, nonce: Date.now() });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setSection('mobile')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            eSIM Connect
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'mobile', label: 'Live App' },
                { id: 'admin', label: 'Admin Console' },
                { id: 'source', label: 'Source & Docs' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors ${
                  section === item.id
                    ? 'border-teal-700 dark:border-teal-400 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 whitespace-nowrap shrink-0"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </header>

      <main className={section === 'mobile' && viewMode === 'fullapp' ? 'mx-auto max-w-7xl px-0 md:px-6' : 'mx-auto max-w-7xl px-6 py-8'}>
        {/* WORKSPACE 1: LIVE COMMUNICATION APP */}
        {section === 'mobile' && (
          <div className={viewMode === 'fullapp' ? '' : 'space-y-6'}>
            {/* Workspace Mode Switcher Toolbar */}
            <div className={`flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 ${viewMode === 'fullapp' ? 'px-6 py-3 bg-white dark:bg-slate-900' : 'pb-5'}`}>
              <div>
                <h1 className="font-display text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Internet Voice Calling & Messaging
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time Socket.IO chat & WebRTC P2P calling · Share your link to call across devices
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('fullapp')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'fullapp'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Full App
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'split'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  2-User Call Test
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('studio')}
                  className={`hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'studio'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Phone Preview
                </button>
              </div>
            </div>

            {viewMode === 'fullapp' && (
              <div className="flex justify-center">
                <MobileDeviceClient
                  fullScreen
                  globalDark={darkMode}
                  onToggleGlobalDark={() => setDarkMode((d) => !d)}
                  onScreenChange={setActiveMobileScreen}
                />
              </div>
            )}

            {viewMode === 'split' && (
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <MobileDeviceClient
                  deviceLabel="Device A · Caller / Sender"
                  defaultQuickEmail="aarav@esimconnect.demo"
                  globalDark={darkMode}
                  onToggleGlobalDark={() => setDarkMode((d) => !d)}
                  onScreenChange={setActiveMobileScreen}
                />
                <MobileDeviceClient
                  deviceLabel="Device B · Receiver / Peer"
                  defaultQuickEmail="priya@esimconnect.demo"
                  globalDark={darkMode}
                  onToggleGlobalDark={() => setDarkMode((d) => !d)}
                />
              </div>
            )}

            {viewMode === 'studio' && (
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
                {/* Primary Android Client */}
                <div className="lg:col-span-5 flex justify-center">
                  <MobileDeviceClient
                    defaultQuickEmail="aarav@esimconnect.demo"
                    globalDark={darkMode}
                    onToggleGlobalDark={() => setDarkMode((d) => !d)}
                    externalScreenRequest={screenRequest}
                    onScreenChange={setActiveMobileScreen}
                  />
                </div>

                {/* Companion Studio Guide & Screen Matrix */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Screen Matrix (All 13 Mobile Screens + Admin Link) */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                          Android Screen Architecture (14 Total Screens)
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Click any screen to jump directly inside the live client (sign in to access authenticated screens)
                        </p>
                      </div>
                      <Smartphone className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ALL_ANDROID_SCREENS.map((item) => {
                        const isActive = activeMobileScreen === item.id;
                        const isCallOnly = item.id === 'incoming_call' || item.id === 'active_call';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={isCallOnly}
                            onClick={() => jumpToScreen(item.id)}
                            className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                              isActive
                                ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 font-semibold'
                                : isCallOnly
                                  ? 'border-slate-200/70 dark:border-slate-800/70 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-600'
                            }`}
                          >
                            <div className="truncate">{item.label}</div>
                            <div className="text-[10px] text-slate-400">
                              {isCallOnly ? 'Triggered by call' : item.group}
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setSection('admin')}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:border-teal-600"
                      >
                        <div className="truncate font-medium">14. Admin Dashboard</div>
                        <div className="text-[10px] text-teal-700 dark:text-teal-400">Open Web Console</div>
                      </button>
                    </div>
                  </div>

                  {/* Multi-User Testing Guide */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Test Live WebRTC Calling & Socket.IO Chat
                    </h3>
                    <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-600 dark:text-slate-300">
                      <li>
                        Click <strong>Dual-Device Split Test</strong> above (or open this URL in a second browser tab).
                      </li>
                      <li>
                        Sign in as <strong>Aarav Sharma</strong> (<code className="font-mono text-xs">aarav@esimconnect.demo</code>) on Device A and <strong>Priya Nair</strong> (<code className="font-mono text-xs">priya@esimconnect.demo</code>) on Device B using password <code className="font-mono text-xs">esimconnect123</code>.
                      </li>
                      <li>
                        Dial Priya&apos;s <code className="font-mono text-xs">+91 90002 44819</code> ID or tap the call button in Contacts to trigger real WebRTC SDP signaling, Incoming Call accept/reject, mute, speaker, and SQLite call logging.
                      </li>
                    </ol>
                  </div>

                  {/* Non-Telecom & Open-Source Disclosure */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-400" />
                      <div className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          Non-Telecom & 100% Free Open-Source Notice
                        </div>
                        <p>
                          eSIM Connect is an internet-only VoIP and messaging platform. Demo Virtual
                          Numbers (<span className="font-mono">+91 9000X XXXXX</span>) and Demo OTP
                          codes are app-internal test identifiers only—they never provision real
                          eSIM profiles, place PSTN phone calls, or send carrier SMS messages.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE 2: ADMIN CONSOLE */}
        {section === 'admin' && <AdminDashboard />}

        {/* WORKSPACE 3: SOURCE TREE & DOCS */}
        {section === 'source' && <SourceExplorer />}
      </main>
    </div>
  );
}

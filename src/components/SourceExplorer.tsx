import { useEffect, useState } from 'react';
import { Check, Copy, FileCode2, FolderTree, Terminal } from 'lucide-react';

interface ProjectFileNode {
  path: string;
  name: string;
  category: string;
  size: number;
}

export function SourceExplorer() {
  const [files, setFiles] = useState<ProjectFileNode[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [selectedPath, setSelectedPath] = useState<string>('README.md');
  const [content, setContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/project-files')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.files)) setFiles(d.files);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    setLoadingContent(true);
    fetch(`/api/project-files/read?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content || ''))
      .catch(() => setContent('Failed to load file content.'))
      .finally(() => setLoadingContent(false));
  }, [selectedPath]);

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'android', label: 'Android (Kotlin)' },
    { id: 'backend', label: 'Backend (Node.js)' },
    { id: 'database', label: 'Database (SQLite)' },
    { id: 'docs', label: 'Docs & Guides' },
  ];

  const visibleFiles = files.filter((f) =>
    category === 'all' ? true : f.category === category || (category === 'docs' && f.category === 'admin-dashboard')
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Source Tree & Build Documentation
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Inspect the complete Kotlin Jetpack Compose Android app, Node.js backend, SQLite schema, and APK build guides
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                category === cat.id
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Command Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Terminal className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            Run Full-Stack Server Locally
          </div>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-200">
            npm install && npm run dev
          </pre>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Terminal className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            Build Android Debug APK (from /android)
          </div>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-200">
            ./gradlew assembleDebug
          </pre>
        </div>
      </div>

      {/* File Tree + Viewer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 max-h-[620px] overflow-y-auto">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <FolderTree className="h-3.5 w-3.5" />
            Project Files ({visibleFiles.length})
          </div>
          <div className="space-y-0.5">
            {visibleFiles.map((file) => {
              const active = file.path === selectedPath;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'bg-teal-700/10 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate font-mono">{file.path}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                    {(file.size / 1024).toFixed(1)}k
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden max-h-[620px]">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode2 className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
              <span className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-white">
                {selectedPath}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-600 whitespace-nowrap"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-slate-950 p-4">
            {loadingContent ? (
              <p className="font-mono text-xs text-slate-400">Loading file...</p>
            ) : (
              <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
                {content}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

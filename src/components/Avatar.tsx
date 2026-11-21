import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  sizeClass?: string;
  online?: boolean;
}

export function Avatar({ name, src, sizeClass = 'w-10 h-10', online }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-teal-700/15 dark:bg-teal-400/15 text-teal-800 dark:text-teal-200 font-display text-xs font-semibold border border-teal-700/20 dark:border-teal-400/20">
          {initials || 'EC'}
        </div>
      )}
      {typeof online === 'boolean' && (
        <span
          title={online ? 'Online' : 'Offline'}
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            online ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { decodeSnapshot } from '../lib/snapshot';
import type { SnapshotPayload } from '../lib/snapshot';
import { Markdown } from './Markdown';

/** Read-only viewer for a #snap=... shared chat. Decodes entirely in the browser. */
export function SnapshotViewer({ encoded, onExit }: { encoded: string; onExit: () => void }) {
  const [payload, setPayload] = useState<SnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    decodeSnapshot(encoded)
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch(() => { if (!cancelled) setError('This snapshot link is damaged or incomplete.'); });
    return () => { cancelled = true; };
  }, [encoded]);

  const messages = useMemo(() => payload?.messages ?? [], [payload]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-500">Shared snapshot · read only</p>
          <h1 className="truncate text-sm font-semibold">{payload?.title ?? 'Loading…'}</h1>
        </div>
        <button type="button" onClick={onExit} className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Open Agent Deck</button>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 p-3">
        {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {messages.map((m, i) => (
          <article key={i} className={`rounded-xl border p-3 text-sm ${m.role === 'user' ? 'ml-8 border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40' : 'mr-8 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{m.role === 'user' ? 'You' : 'Assistant'}</p>
            {m.role === 'assistant' ? <Markdown source={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
          </article>
        ))}
      </main>
    </div>
  );
}

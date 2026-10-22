import { formatDuration, formatRate } from '../lib/stats';
import type { ResponseStats } from '../lib/types';

interface StatsPanelProps {
  stats: ResponseStats | undefined;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 text-sm dark:border-slate-800">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white p-4 xl:block dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Last response</h2>
      {!stats ? (
        <p className="text-xs text-slate-500">Stats appear here after a response finishes.</p>
      ) : (
        <dl>
          <Row label="Time to first token" value={formatDuration(stats.ttftMs)} />
          <Row label="Total latency" value={formatDuration(stats.totalMs)} />
          <Row label="Throughput" value={formatRate(stats.tokensPerSecond)} />
          <Row label="Prompt tokens" value={stats.promptTokens?.toString() ?? '-'} />
          <Row label="Completion tokens" value={stats.completionTokens.toString()} />
          <Row label="Total tokens" value={stats.totalTokens?.toString() ?? '-'} />
          <p className="pt-3 text-xs text-slate-500">
            {stats.estimated
              ? 'Completion tokens are estimated (about 4 characters per token) because the provider did not report usage.'
              : 'Token counts are reported by the provider.'}
          </p>
        </dl>
      )}
    </aside>
  );
}

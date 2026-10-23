import { useMemo, useState } from 'react';
import type { AIFeature } from '../lib/types';

interface FeatureHubProps {
  features: AIFeature[];
  onChange: (features: AIFeature[]) => void;
  onClose: () => void;
}

const categories = ['All', 'Core', 'Productivity', 'Safety', 'Power user'] as const;

export function FeatureHub({ features, onChange, onClose }: FeatureHubProps) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => features.filter((feature) =>
    (category === 'All' || feature.category === category) &&
    `${feature.name} ${feature.description}`.toLowerCase().includes(query.toLowerCase()),
  ), [category, features, query]);
  const enabled = features.filter((feature) => feature.enabled).length;

  function toggle(id: string) {
    onChange(features.map((feature) => feature.id === id ? { ...feature, enabled: !feature.enabled } : feature));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 pt-8 backdrop-blur-sm md:p-10">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">MercuReal intelligence</p>
            <h2 className="mt-2 text-xl font-semibold">AI features</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">Turn on the behaviors you want your assistant to use. They apply to new messages and never hide your text.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close AI features">×</button>
        </header>
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search features" aria-label="Search features" className="min-h-10 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400" />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Feature categories">
            {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-selected={category === item} className={`rounded-full px-3 py-2 text-xs ${category === item ? 'bg-cyan-300 font-semibold text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{item}</button>)}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-400"><span>{enabled} of {features.length} enabled</span><span>Changes save automatically</span></div>
        <div className="grid gap-3 p-4 pt-1 md:grid-cols-2 md:p-5 md:pt-1">
          {visible.map((feature) => <button key={feature.id} type="button" onClick={() => toggle(feature.id)} aria-pressed={feature.enabled} className={`flex min-h-32 flex-col items-start rounded-xl border p-4 text-left transition ${feature.enabled ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
            <span className="flex w-full items-center justify-between gap-3"><span className="font-medium">{feature.name}</span><span className={`h-2.5 w-2.5 rounded-full ${feature.enabled ? 'bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]' : 'bg-slate-600'}`} /></span>
            <span className="mt-2 text-sm leading-5 text-slate-400">{feature.description}</span>
            <span className="mt-auto pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{feature.category}</span>
          </button>)}
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { useModal } from '../lib/useModal';
import { searchPalette, SHORTCUTS, type PaletteItem } from '../lib/palette';
import { extractVariables, fillVariables, type PromptTemplate } from '../lib/prompts';
import { clampMaxTokens, clampTemperature } from '../lib/chatSettings';

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useModal(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[80dvh] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${wide ? 'max-w-xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-9 min-w-9 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function CommandPalette({ items, onRun, onClose }: { items: PaletteItem[]; onRun: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const results = useMemo(() => searchPalette(items, query), [items, query]);
  const active = Math.min(idx, Math.max(0, results.length - 1));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (results.length ? (i + 1) % results.length : 0)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (results.length ? (i - 1 + results.length) % results.length : 0)); }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); onRun(results[active].id); }
  }

  return (
    <Dialog title="Command palette" onClose={onClose} wide>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
        onKeyDown={onKey}
        placeholder="Search chats, skills, settings, actions"
        aria-label="Search commands"
        className="mb-3 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-500 md:text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <ul role="listbox" aria-label="Results" className="space-y-1">
        {results.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">No matches.</li>}
        {results.map((item, i) => (
          <li key={item.id} role="option" aria-selected={i === active}>
            <button
              type="button"
              onClick={() => onRun(item.id)}
              onMouseEnter={() => setIdx(i)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${i === active ? 'bg-indigo-50 dark:bg-slate-800' : ''}`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{item.hint ?? item.group}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <dl className="space-y-2 text-sm">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex justify-between gap-4">
            <dt className="font-mono text-xs text-indigo-500">{s.keys}</dt>
            <dd className="text-right text-slate-600 dark:text-slate-300">{s.action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

/** Asks for each {{name}} value before a prompt is inserted or sent. */
export function PromptFillModal({ prompt, onDone, onClose }: { prompt: PromptTemplate; onDone: (text: string) => void; onClose: () => void }) {
  const names = extractVariables(prompt.body);
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <Dialog title={`Fill in: ${prompt.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); onDone(fillVariables(prompt.body, values)); }}
      >
        {names.map((n) => (
          <label key={n} className="block text-sm">
            <span className="mb-1 block font-mono text-xs text-slate-500">{`{{${n}}}`}</span>
            <input
              value={values[n] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [n]: e.target.value }))}
              className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-500 md:text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        ))}
        <p className="rounded-md bg-slate-100 p-2 text-xs whitespace-pre-wrap dark:bg-slate-800">{fillVariables(prompt.body, values)}</p>
        <button type="submit" className="min-h-11 w-full rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500">Insert</button>
      </form>
    </Dialog>
  );
}

export function PromptLibrary({ prompts, onChange, onUse, onClose }: { prompts: PromptTemplate[]; onChange: (next: PromptTemplate[]) => void; onUse: (p: PromptTemplate) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? prompts.filter((p) => `${p.name} ${p.body}`.toLowerCase().includes(q)) : prompts;
  }, [prompts, query]);

  function save() {
    if (!name.trim() || !body.trim()) return;
    onChange([...prompts, { id: `p_${Date.now().toString(36)}`, name: name.trim(), body: body.trim() }]);
    setName('');
    setBody('');
  }

  return (
    <Dialog title="Prompt library" onClose={onClose} wide>
      <p className="mb-2 text-xs text-slate-500">Type /prompt in the composer, or use a saved prompt here. Use {'{{name}}'} for fill-in variables.</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter prompts" aria-label="Filter prompts" className="mb-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
      <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
        {shown.length === 0 && <li className="text-xs text-slate-500">No saved prompts yet.</li>}
        {shown.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate text-xs text-slate-500">{p.body}</p></div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => onUse(p)} className="min-h-11 rounded-md bg-indigo-600 px-3 text-xs text-white">Use</button>
              <button type="button" aria-label={`Delete ${p.name}`} onClick={() => onChange(prompts.filter((x) => x.id !== p.id))} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs dark:border-slate-700">Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prompt name" aria-label="Prompt name" className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Prompt text, e.g. Summarise {{topic}} for {{audience}}" aria-label="Prompt text" rows={3} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
        <button type="button" onClick={save} disabled={!name.trim() || !body.trim()} className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm text-white disabled:opacity-50">Save prompt</button>
      </div>
    </Dialog>
  );
}

export function ConversationSettings({ conversation, globalSystemPrompt, onSave, onClose }: { conversation: { systemPrompt?: string; temperature?: number; maxTokens?: number }; globalSystemPrompt: string; onSave: (patch: { systemPrompt?: string; temperature?: number; maxTokens?: number }) => void; onClose: () => void }) {
  const [systemPrompt, setSystemPrompt] = useState(conversation.systemPrompt ?? '');
  const [temperature, setTemperature] = useState(conversation.temperature !== undefined ? String(conversation.temperature) : '');
  const [maxTokens, setMaxTokens] = useState(conversation.maxTokens !== undefined ? String(conversation.maxTokens) : '');

  function save() {
    const t = temperature.trim() === '' ? undefined : clampTemperature(Number(temperature));
    const m = maxTokens.trim() === '' ? undefined : clampMaxTokens(Number(maxTokens));
    onSave({ systemPrompt: systemPrompt.trim() === '' ? undefined : systemPrompt, temperature: t, maxTokens: m });
    onClose();
  }

  return (
    <Dialog title="This chat's settings" onClose={onClose}>
      <label className="block text-xs font-medium">System prompt override (blank uses the global one)
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder={globalSystemPrompt || 'No global system prompt set'} rows={4} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-medium">Temperature
          <input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="default" className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <label className="text-xs font-medium">Max tokens
          <input type="number" min="1" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="default" className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base md:text-sm dark:border-slate-700 dark:bg-slate-900" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm dark:border-slate-700">Cancel</button>
        <button type="button" onClick={save} className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm text-white">Save</button>
      </div>
    </Dialog>
  );
}

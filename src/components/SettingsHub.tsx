import { useRef, useState } from 'react';
import { SettingsPanel, FallbackField, CrossProviderField } from './SettingsPanel';
import { SkillsPanel } from './SkillsPanel';
import { DEFAULT_CONTEXT_BUDGET } from '../lib/context';
import { FONT_SIZES, clampMaxTokens, clampTemperature, type FontSize } from '../lib/chatSettings';
import { buildBackup, parseBackup, restoreEntries, summarizeBackup, type BackupFile } from '../lib/backup';
import { DATA_PREFIX } from '../lib/backup';
import type { AgentSkill, ProviderConfig } from '../lib/types';
import type { BundledSkill } from '../lib/skills';

export type HubTab = 'providers' | 'skills' | 'mcp' | 'chat' | 'appearance' | 'data';

const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP' },
  { id: 'chat', label: 'Chat' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
];

interface SettingsHubProps {
  tab: HubTab;
  onTabChange: (tab: HubTab) => void;
  onClose: () => void;
  providers: ProviderConfig[];
  activeProviderId: string;
  onProvidersChange: (next: ProviderConfig[]) => void;
  onActivate: (id: string) => void;
  skills: AgentSkill[];
  onSkillsChange: (next: AgentSkill[]) => void;
  bundledSkills: BundledSkill[];
  disabledSkills: string[];
  onDisabledSkillsChange: (next: string[]) => void;
  mcpContent: React.ReactNode;
  systemPrompt: string;
  onSystemPromptChange: (next: string) => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  getStorage: () => Record<string, string>;
  setStorage: (entries: Record<string, string>) => void;
  clearStorage: () => void;
}

const field =
  'mt-1 min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-500 md:min-h-0 md:text-sm dark:border-slate-700 dark:bg-slate-950';
const button =
  'min-h-11 rounded-md border border-slate-300 px-4 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
const primary = 'min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50';

export function SettingsHub(props: SettingsHubProps) {
  const { tab, onTabChange, onClose } = props;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = HUB_TABS[(index + (e.key === 'ArrowRight' ? 1 : HUB_TABS.length - 1)) % HUB_TABS.length];
    onTabChange(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="flex h-dvh w-full flex-col bg-white/95 backdrop-blur-xl md:h-[88vh] md:max-w-3xl md:rounded-2xl md:border md:border-white/60 md:shadow-2xl dark:bg-slate-900/95 dark:md:border-white/10">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-5 dark:border-slate-800">
          <h2 className="text-base font-semibold">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="min-h-11 min-w-11 rounded-md px-3 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            Close
          </button>
        </div>
        <div role="tablist" aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-800">
          {HUB_TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="settings-tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              onKeyDown={(e) => onTabKey(e, i)}
              onClick={() => onTabChange(t.id)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm ${tab === t.id ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          {tab === 'providers' && (
            <SettingsPanel
              embedded
              providers={props.providers}
              activeId={props.activeProviderId}
              onChange={props.onProvidersChange}
              onActivate={props.onActivate}
              onClose={onClose}
            />
          )}
          {tab === 'skills' && (
            <SkillsPanel
              embedded
              skills={props.skills}
              onChange={props.onSkillsChange}
              bundled={props.bundledSkills}
              disabled={props.disabledSkills}
              onDisabledChange={props.onDisabledSkillsChange}
              onClose={onClose}
            />
          )}
          {tab === 'mcp' && props.mcpContent}
          {tab === 'chat' && <ChatTab {...props} />}
          {tab === 'appearance' && <AppearanceTab {...props} />}
          {tab === 'data' && <DataTab {...props} />}
        </div>
      </div>
    </div>
  );
}

function ChatTab({ providers, activeProviderId, onProvidersChange, systemPrompt, onSystemPromptChange }: SettingsHubProps) {
  const provider = providers.find((p) => p.id === activeProviderId) ?? providers[0];
  if (!provider) return <p className="text-sm text-slate-500">Add a provider in the Providers tab first.</p>;

  function patch(change: Partial<ProviderConfig>) {
    onProvidersChange(providers.map((p) => (p.id === provider.id ? { ...p, ...change } : p)));
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">These settings apply to <strong>{provider.name} · {provider.model}</strong>, the active provider.</p>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Fallback chain</h3>
        <FallbackField key={provider.id} provider={provider} onChange={patch} />
        <CrossProviderField provider={provider} providers={providers} onChange={patch} />
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-slate-500">
          Context budget (tokens)
          <input className={field} type="number" min={500} step={500} value={provider.contextBudget ?? DEFAULT_CONTEXT_BUDGET} onChange={(e) => {
            const n = Number(e.target.value);
            patch({ contextBudget: Number.isFinite(n) && n > 0 ? n : undefined });
          }} />
        </label>
        <label className="block text-xs text-slate-500">
          Temperature (0 to 2, blank = default)
          <input className={field} type="number" min={0} max={2} step={0.1} value={provider.temperature ?? ''} onChange={(e) => {
            patch({ temperature: e.target.value === '' ? undefined : clampTemperature(Number(e.target.value)) });
          }} />
        </label>
        <label className="block text-xs text-slate-500">
          Max output tokens (blank = default)
          <input className={field} type="number" min={1} step={64} value={provider.maxTokens ?? ''} onChange={(e) => {
            patch({ maxTokens: e.target.value === '' ? undefined : clampMaxTokens(Number(e.target.value)) });
          }} />
        </label>
      </section>
      <section>
        <label className="block text-xs text-slate-500">
          Default system prompt (sent with every new message)
          <textarea className={`${field} min-h-24 py-2`} value={systemPrompt} onChange={(e) => onSystemPromptChange(e.target.value)} placeholder="e.g. Answer briefly and in plain English." />
        </label>
      </section>
    </div>
  );
}

function AppearanceTab({ theme, onThemeChange, fontSize, onFontSizeChange }: SettingsHubProps) {
  const sizes: FontSize[] = ['small', 'medium', 'large'];
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Theme</h3>
        <div className="flex gap-2" role="radiogroup" aria-label="Theme">
          {(['dark', 'light'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => onThemeChange(t)} className={`${button} ${theme === t ? 'border-indigo-500 bg-indigo-500/10' : ''}`}>
              {t === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Font size</h3>
        <div className="flex gap-2" role="radiogroup" aria-label="Font size">
          {sizes.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={fontSize === s} onClick={() => onFontSizeChange(s)} className={`${button} ${fontSize === s ? 'border-indigo-500 bg-indigo-500/10' : ''}`} style={{ fontSize: FONT_SIZES[s] }}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Sets the base text size across the app ({FONT_SIZES[fontSize]}px).</p>
      </section>
    </div>
  );
}

function DataTab({ getStorage, setStorage, clearStorage }: SettingsHubProps) {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [pending, setPending] = useState<{ backup: BackupFile; fileName: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function exportAll() {
    const backup = buildBackup(getStorage(), { includeApiKeys: includeKeys, exportedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-deck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(includeKeys ? 'Exported with API keys. Keep this file private.' : 'Exported without API keys.');
    setError('');
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setMessage('');
    try {
      const backup = parseBackup(await file.text());
      setPending({ backup, fileName: file.name });
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function confirmImport() {
    if (!pending) return;
    const merged = restoreEntries(pending.backup, getStorage());
    setStorage(merged);
  }

  const summary = pending ? summarizeBackup(pending.backup) : null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Export</h3>
        <p className="text-xs text-slate-500">Downloads every chat, provider, skill, tool and setting saved in this browser as one JSON file.</p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)} className="h-5 w-5" />
          Include API keys (off by default)
        </label>
        <button type="button" onClick={exportAll} className={primary}>Download backup (.json)</button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Import</h3>
        <p className="text-xs text-slate-500">Restores a backup file. Chats and settings in the file replace what is saved here. Keys already on this device are kept when the file has none.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Choose backup file" onChange={(e) => void pickFile(e.target.files?.[0])} className="block min-h-11 w-full py-2 text-sm" />
        {pending && summary && (
          <div className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
            <p>{pending.fileName}: {summary.chats} chats, {summary.providers} providers, keys {summary.keysIncluded ? 'included' : 'not included'}.</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Importing overwrites your current chats and settings, then reloads the app.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={confirmImport} className={primary}>Replace with this backup</button>
              <button type="button" onClick={() => setPending(null)} className={button}>Cancel</button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </section>

      <section className="space-y-3 rounded-md border border-red-400/40 p-3">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Clear all data</h3>
        <p className="text-xs text-slate-500">Deletes every chat, provider, key, skill and setting saved by Agent Deck in this browser.</p>
        {!confirmClear ? (
          <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 rounded-md border border-red-400 px-4 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400">Clear all data…</button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={clearStorage} className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500">Yes, delete everything</button>
            <button type="button" onClick={() => setConfirmClear(false)} className={button}>Cancel</button>
          </div>
        )}
      </section>
      {message && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
    </div>
  );
}

export { DATA_PREFIX };

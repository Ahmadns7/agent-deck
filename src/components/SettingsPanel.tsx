import { useState } from 'react';
import { isValidBaseUrl, PROVIDER_PRESETS } from '../lib/providers';
import { uid } from '../lib/id';
import type { ProviderConfig, ProviderKind } from '../lib/types';

interface SettingsPanelProps {
  providers: ProviderConfig[];
  activeId: string;
  onChange: (next: ProviderConfig[]) => void;
  onActivate: (id: string) => void;
  onClose: () => void;
}

export function SettingsPanel({ providers, activeId, onChange, onActivate, onClose }: SettingsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = providers.find((p) => p.id === editingId);

  function update(id: string, patch: Partial<ProviderConfig>) {
    onChange(providers.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addCustom() {
    const provider: ProviderConfig = {
      id: uid(),
      name: 'Custom endpoint',
      kind: 'openai',
      baseUrl: 'https://example.com/v1',
      model: 'model-name',
      apiKey: '',
    };
    onChange([...providers, provider]);
    setEditingId(provider.id);
  }

  function remove(id: string) {
    onChange(providers.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // Phones: a full-width bottom sheet capped at 92dvh so it never sits under the browser chrome.
  // md and up: the centered modal, unchanged.
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Providers"
    >
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl md:max-h-[90vh] md:max-w-2xl md:rounded-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5 dark:border-slate-800">
          <h2 className="font-semibold">Providers</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-md px-3 text-sm text-slate-500 md:min-h-0 md:min-w-0 md:px-0 hover:text-slate-900 dark:hover:text-slate-100"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[14rem_1fr] md:p-5">
          <div className="min-w-0 space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(p.id)}
                  className={`min-h-11 min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm md:min-h-0 ${
                    editingId === p.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onActivate(p.id)}
                  className={`min-h-11 shrink-0 rounded-md px-3 text-xs md:min-h-0 md:px-2 md:py-1 ${
                    p.id === activeId ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {p.id === activeId ? 'Active' : 'Use'}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addCustom}
              className="min-h-11 w-full rounded-md border border-dashed border-slate-400 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 md:min-h-0 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/70"
            >
              + Custom endpoint
            </button>
            <div className="pt-2 text-xs text-slate-500">Add a preset:</div>
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  const p: ProviderConfig = { ...preset, id: uid(), apiKey: '' };
                  onChange([...providers, p]);
                  setEditingId(p.id);
                }}
                className="min-h-11 w-full truncate rounded-md px-2.5 py-1 text-left text-sm text-slate-600 hover:bg-slate-100 md:min-h-0 md:text-xs dark:text-slate-400 dark:hover:bg-slate-800/70"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {!editing && <p className="text-sm text-slate-500">Select a provider to edit it.</p>}
            {editing && (
              <ProviderForm
                key={editing.id}
                provider={editing}
                onChange={(patch) => update(editing.id, patch)}
                onRemove={() => remove(editing.id)}
              />
            )}
            <p className="mt-6 text-xs text-slate-500">
              API keys are saved only in this browser's localStorage. They are sent only to the base URL of the provider
              they belong to. Nothing is sent to Agent Deck servers, because there are none.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderForm({
  provider,
  onChange,
  onRemove,
}: {
  provider: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
  onRemove: () => void;
}) {
  const urlOk = isValidBaseUrl(provider.baseUrl);
  // 16px below md so iOS Safari does not zoom on focus; 14px from md up as before.
  const input =
    'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base outline-none focus:border-indigo-500 md:min-h-0 md:text-sm dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-500">
        Name
        <input className={input} value={provider.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label className="block text-xs text-slate-500">
        API format
        <select
          className={input}
          value={provider.kind}
          onChange={(e) => onChange({ kind: e.target.value as ProviderKind })}
        >
          <option value="openai">OpenAI-compatible (chat/completions)</option>
          <option value="anthropic">Anthropic (messages)</option>
        </select>
      </label>
      <label className="block text-xs text-slate-500">
        Base URL
        <input
          className={input}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={provider.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
        />
        {!urlOk && <span className="text-red-500">Enter a full http(s) URL.</span>}
      </label>
      <label className="block text-xs text-slate-500">
        Model
        <input
          className={input}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={provider.model}
          onChange={(e) => onChange({ model: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-500">
        API key (stored in this browser only)
        <input
          className={input}
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={provider.apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="min-h-11 px-1 text-xs text-red-500 hover:underline md:min-h-0"
      >
        Remove provider
      </button>
    </div>
  );
}

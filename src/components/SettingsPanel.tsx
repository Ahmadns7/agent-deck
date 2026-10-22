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

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Providers">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="font-semibold">Providers</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[14rem_1fr]">
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(p.id)}
                  className={`min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm ${
                    editingId === p.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onActivate(p.id)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    p.id === activeId ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {p.id === activeId ? 'Active' : 'Use'}
                </button>
              </div>
            ))}
            <button type="button" onClick={addCustom} className="w-full rounded-md border border-dashed border-slate-400 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/70">
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
                className="w-full truncate rounded-md px-2.5 py-1 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div>
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
  const input =
    'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950';

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
        <input className={input} value={provider.baseUrl} onChange={(e) => onChange({ baseUrl: e.target.value })} />
        {!urlOk && <span className="text-red-500">Enter a full http(s) URL.</span>}
      </label>
      <label className="block text-xs text-slate-500">
        Model
        <input className={input} value={provider.model} onChange={(e) => onChange({ model: e.target.value })} />
      </label>
      <label className="block text-xs text-slate-500">
        API key (stored in this browser only)
        <input
          className={input}
          type="password"
          autoComplete="off"
          value={provider.apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
        />
      </label>
      <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:underline">
        Remove provider
      </button>
    </div>
  );
}

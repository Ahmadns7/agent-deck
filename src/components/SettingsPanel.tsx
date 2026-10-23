import { useState } from 'react';
import { isValidBaseUrl, MODEL_PRESETS, PROVIDER_PRESETS } from '../lib/providers';
import { defaultFallbackFor, effectiveFallbacks, parseFallbackModels } from '../lib/fallback';
import { DEFAULT_CONTEXT_BUDGET } from '../lib/context';
import { uid } from '../lib/id';
import type { ModelRef, ProviderConfig, ProviderKind } from '../lib/types';

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
                allProviders={providers}
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

function FallbackField({
  provider,
  onChange,
}: {
  provider: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
}) {
  const shown = effectiveFallbacks(provider);
  const [text, setText] = useState(shown.join(', '));
  const input =
    'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base outline-none focus:border-indigo-500 md:min-h-0 md:text-sm dark:border-slate-700 dark:bg-slate-950';

  return (
    <label className="block text-xs text-slate-500">
      Fallback models (comma-separated, tried in order on 429 / 413 / rate limit)
      <input
        className={input}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange({ fallbackModels: parseFallbackModels(e.target.value) });
        }}
        onBlur={() => setText(parseFallbackModels(text).join(', '))}
      />
      {!provider.fallbackModels && defaultFallbackFor(provider).length > 0 && (
        <span className="text-slate-500">Showing Groq defaults. Edit to save your own list.</span>
      )}
    </label>
  );
}

function CrossProviderField({
  provider,
  providers,
  onChange,
}: {
  provider: ProviderConfig;
  providers: ProviderConfig[];
  onChange: (patch: Partial<ProviderConfig>) => void;
}) {
  const chain = provider.crossProviderFallbacks ?? [];
  const others = providers.filter((p) => p.id !== provider.id);
  const input =
    'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base outline-none focus:border-indigo-500 md:min-h-0 md:text-sm dark:border-slate-700 dark:bg-slate-950';

  function setChain(next: ModelRef[]) {
    onChange({ crossProviderFallbacks: next });
  }
  function patchRow(index: number, patch: Partial<ModelRef>) {
    setChain(chain.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="space-y-2 text-xs text-slate-500">
      <legend className="mb-1">
        Cross-provider fallback: if every model above hits a rate or size limit, try these provider and model pairs in order
      </legend>
      {others.length === 0 && <p>Add another provider to use cross-provider fallback.</p>}
      {chain.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Fallback ${index + 1} provider`}
            className={`${input} sm:w-44`}
            value={row.providerId}
            onChange={(e) => patchRow(index, { providerId: e.target.value })}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            aria-label={`Fallback ${index + 1} model`}
            className={`${input} sm:flex-1`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={row.model}
            onChange={(e) => patchRow(index, { model: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setChain(chain.filter((_, i) => i !== index))}
            className="min-h-11 rounded-md px-2 hover:bg-slate-100 md:min-h-0 dark:hover:bg-slate-800"
          >
            Remove
          </button>
        </div>
      ))}
      {others.length > 0 && (
        <button
          type="button"
          onClick={() => setChain([...chain, { providerId: others[0].id, model: others[0].model }])}
          className="min-h-11 rounded-md border border-slate-300 px-3 md:min-h-0 md:py-1 dark:border-slate-700"
        >
          Add provider + model
        </button>
      )}
    </fieldset>
  );
}

function ProviderForm({
  provider,
  allProviders,
  onChange,
  onRemove,
}: {
  provider: ProviderConfig;
  allProviders: ProviderConfig[];
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
      <div className="flex flex-wrap gap-1">
        {MODEL_PRESETS.map((m) => (
          <button
            key={`${m.provider}-${m.id}`}
            type="button"
            title={`${m.provider} ${m.tier === 'free' ? 'free tier' : 'cloud'} · ${m.source}`}
            onClick={() => onChange({ model: m.id })}
            className={`rounded-full border px-2 py-0.5 text-xs ${provider.model === m.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600'}`}
          >
            {m.provider} · {m.id}
          </button>
        ))}
      </div>
      <FallbackField provider={provider} onChange={onChange} />
      <CrossProviderField provider={provider} providers={allProviders} onChange={onChange} />
      <label className="block text-xs text-slate-500">
        Context budget (estimated tokens sent per request)
        <input
          className={input}
          type="number"
          min={500}
          step={500}
          value={provider.contextBudget ?? DEFAULT_CONTEXT_BUDGET}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ contextBudget: Number.isFinite(n) && n > 0 ? n : undefined });
          }}
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

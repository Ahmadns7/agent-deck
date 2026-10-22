import { useEffect, useRef, useState } from 'react';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { StatsPanel } from './components/StatsPanel';
import { PROVIDER_PRESETS } from './lib/providers';
import { lastStatsMessage, titleFrom, updateConversation, updateMessage } from './lib/conversations';
import { loadJSON, saveJSON, STORAGE_KEYS } from './lib/storage';
import { streamChat } from './lib/stream';
import { uid } from './lib/id';
import type { ChatMessage, Conversation, ProviderConfig, StoredMessage } from './lib/types';

type Theme = 'dark' | 'light';

function makeDefaultProviders(): ProviderConfig[] {
  return PROVIDER_PRESETS.map((p) => ({ ...p, id: uid(), apiKey: '' }));
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => loadJSON<Theme>(STORAGE_KEYS.theme, 'dark'));
  const [providers, setProviders] = useState<ProviderConfig[]>(() => {
    const saved = loadJSON<ProviderConfig[]>(STORAGE_KEYS.providers, []);
    return saved.length > 0 ? saved : makeDefaultProviders();
  });
  const [activeProviderId, setActiveProviderId] = useState<string>(() =>
    loadJSON<string>(STORAGE_KEYS.activeProvider, ''),
  );
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadJSON<Conversation[]>(STORAGE_KEYS.conversations, []),
  );
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeProvider =
    providers.find((p) => p.id === activeProviderId) ?? providers[0];
  const current = conversations.find((c) => c.id === currentId);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveJSON(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => saveJSON(STORAGE_KEYS.providers, providers), [providers]);
  useEffect(() => saveJSON(STORAGE_KEYS.activeProvider, activeProvider?.id ?? ''), [activeProvider]);
  useEffect(() => saveJSON(STORAGE_KEYS.conversations, conversations), [conversations]);

  function newChat() {
    if (streaming) return;
    setCurrentId(null);
    setDraft('');
  }

  function deleteConversation(id: string) {
    if (streaming && id === currentId) return;
    setConversations((list) => list.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function send() {
    const text = draft.trim();
    if (!text || streaming || !activeProvider) return;

    const convId = currentId ?? uid();
    const userMsg: StoredMessage = { id: uid(), role: 'user', content: text };
    const assistantId = uid();
    const assistantMsg: StoredMessage = { id: assistantId, role: 'assistant', content: '' };

    setConversations((list) => {
      const base: Conversation = list.find((c) => c.id === convId) ?? {
        id: convId,
        title: titleFrom(text),
        providerId: activeProvider.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      const next: Conversation = {
        ...base,
        providerId: activeProvider.id,
        updatedAt: Date.now(),
        messages: [...base.messages, userMsg, assistantMsg],
      };
      return list.some((c) => c.id === convId)
        ? updateConversation(list, convId, () => next)
        : [next, ...list];
    });
    setCurrentId(convId);
    setDraft('');
    setStreaming(true);

    // Build history from the stored conversation (excluding the empty assistant placeholder).
    const history: ChatMessage[] = (conversations.find((c) => c.id === convId)?.messages ?? [])
      .filter((m) => m.content.length > 0 && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamChat(activeProvider, history, {
        signal: controller.signal,
        onDelta: (delta) =>
          setConversations((list) =>
            updateMessage(list, convId, assistantId, (m) => ({ ...m, content: m.content + delta })),
          ),
      });
      setConversations((list) =>
        updateMessage(list, convId, assistantId, (m) => ({ ...m, stats: result.stats })),
      );
    } catch (err) {
      const aborted = controller.signal.aborted;
      const message = aborted ? 'Stopped.' : err instanceof Error ? err.message : String(err);
      setConversations((list) =>
        updateMessage(list, convId, assistantId, (m) => ({
          ...m,
          error: message,
        })),
      );
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function saveProviders(next: ProviderConfig[]) {
    setProviders(next);
    if (!next.some((p) => p.id === activeProviderId) && next[0]) {
      setActiveProviderId(next[0].id);
    }
  }

  const stats = lastStatsMessage(current)?.stats;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        disabled={streaming}
        onSelect={(id) => {
          if (!streaming) setCurrentId(id);
        }}
        onNew={newChat}
        onDelete={deleteConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{current?.title ?? 'New chat'}</h1>
            <p className="text-xs text-slate-500">
              {activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : 'No provider'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? 'Light' : 'Dark'} mode
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Providers
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <ChatView
            messages={current?.messages ?? []}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onStop={stop}
            streaming={streaming}
            providerReady={
              Boolean(activeProvider?.apiKey) ||
              (activeProvider?.kind === 'openai' && activeProvider.baseUrl.includes('localhost'))
            }
          />
          <StatsPanel stats={stats} />
        </div>
      </main>

      {showSettings && (
        <SettingsPanel
          providers={providers}
          activeId={activeProvider?.id ?? ''}
          onChange={saveProviders}
          onActivate={setActiveProviderId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

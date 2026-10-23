import { useEffect, useRef, useState } from 'react';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { McpPanel } from './components/McpPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { DEFAULT_MCP_SERVERS, enabledMcpTools } from './lib/mcp';
import { StatsDisclosure, StatsPanel } from './components/StatsPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { FeatureHub } from './components/FeatureHub';
import { DEFAULT_AI_FEATURES } from './lib/features';
import { PROVIDER_PRESETS } from './lib/providers';
import { lastStatsMessage, titleFrom, updateConversation, updateMessage } from './lib/conversations';
import { loadJSON, saveJSON, STORAGE_KEYS } from './lib/storage';
import { streamChat } from './lib/stream';
import { uid } from './lib/id';
import type { AIFeature, AgentSkill, ChatMessage, Conversation, ProviderConfig, StoredMessage, Workspace } from './lib/types';

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
  const [showMcp, setShowMcp] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [skills, setSkills] = useState<AgentSkill[]>(() => loadJSON(STORAGE_KEYS.agentSkills, []));
  const [mcpServers, setMcpServers] = useState(() => loadJSON(STORAGE_KEYS.mcpServers, DEFAULT_MCP_SERVERS));
  const [showHistory, setShowHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [aiFeatures, setAiFeatures] = useState<AIFeature[]>(() => loadJSON(STORAGE_KEYS.aiFeatures, DEFAULT_AI_FEATURES));
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadJSON(STORAGE_KEYS.workspaces, [{ id: 'default', name: 'Personal workspace', projects: [] }]));
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
  useEffect(() => saveJSON(STORAGE_KEYS.mcpServers, mcpServers), [mcpServers]);
  useEffect(() => saveJSON(STORAGE_KEYS.agentSkills, skills), [skills]);
  useEffect(() => saveJSON(STORAGE_KEYS.workspaces, workspaces), [workspaces]);
  useEffect(() => saveJSON(STORAGE_KEYS.aiFeatures, aiFeatures), [aiFeatures]);

  const activeMcpTools = enabledMcpTools(mcpServers);

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
    const enabledFeatures = aiFeatures.filter((feature) => feature.enabled);
    if (skills.length > 0 || enabledFeatures.length > 0) {
      const featureInstructions = enabledFeatures.map((feature) => `- ${feature.name}: ${feature.description}`).join('\n');
      history.unshift({ role: 'system', content: `You are MercuReal assistant. Apply these enabled behaviors when relevant:\n${featureInstructions}\n\nInstalled skills:\n${skills.map((skill) => `## ${skill.name}\n${skill.instructions}`).join('\n\n')}` });
    }
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
      {showHistory && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setShowHistory(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        disabled={streaming}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={(id) => {
          if (!streaming) {
            setCurrentId(id);
            setShowHistory(false);
          }
        }}
        onNew={() => {
          newChat();
          setShowHistory(false);
        }}
        onDelete={deleteConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 md:justify-between md:px-5 md:py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            aria-label="Open history"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 md:hidden dark:border-slate-700"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1 md:flex-initial">
            <h1 className="truncate text-sm font-semibold">{current?.title ?? 'New chat'}</h1>
            <p className="truncate text-xs text-slate-500">
              {activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : 'No provider'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2.5 text-xs hover:bg-slate-100 md:min-h-0 md:min-w-0 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="md:hidden">{theme === 'dark' ? '☀' : '☾'}</span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFeatures(true)}
              className="min-h-11 rounded-md border border-violet-400/30 bg-violet-400/10 px-3 text-xs text-violet-200 hover:bg-violet-400/20 md:min-h-0 md:px-2.5 md:py-1"
            >
              AI features {aiFeatures.filter((feature) => feature.enabled).length}
            </button>
            <button
              type="button"
              onClick={() => setShowDashboard(true)}
              className="min-h-11 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs text-cyan-200 hover:bg-cyan-400/20 md:min-h-0 md:px-2.5 md:py-1"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setShowSkills(true)}
              className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Skills {skills.length > 0 && `(${skills.length})`}
            </button>
            <button
              type="button"
              onClick={() => setShowMcp(true)}
              className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Tools {activeMcpTools.length > 0 && `(${activeMcpTools.length})`}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Providers
            </button>
          </div>
        </header>

        {stats && <StatsDisclosure stats={stats} />}

        <div className="flex min-h-0 flex-1">
          <ChatView
            messages={current?.messages ?? []}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onStop={stop}
            streaming={streaming}
            mcpTools={activeMcpTools.map((tool) => tool.name)}
            providerReady={
              Boolean(activeProvider?.apiKey) ||
              (activeProvider?.kind === 'openai' && activeProvider.baseUrl.includes('localhost'))
            }
          />
          <StatsPanel stats={stats} />
        </div>
      </main>

      {showFeatures && <FeatureHub features={aiFeatures} onChange={setAiFeatures} onClose={() => setShowFeatures(false)} />}
      {showDashboard && <DashboardPanel conversations={conversations} workspaces={workspaces} onWorkspacesChange={setWorkspaces} onClose={() => setShowDashboard(false)} />}
      {showSkills && <SkillsPanel skills={skills} onChange={setSkills} onClose={() => setShowSkills(false)} />}
      {showMcp && <McpPanel servers={mcpServers} onChange={setMcpServers} onClose={() => setShowMcp(false)} />}

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

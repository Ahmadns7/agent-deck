import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { SettingsHub, type HubTab } from './components/SettingsHub';
import { DATA_PREFIX } from './lib/backup';
import { normalizeFontSize, FONT_SIZES } from './lib/chatSettings';
import { McpPanel } from './components/McpPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { BUNDLED_SKILLS, SKILL_ENABLED_KEY, buildSkillPrompt, injectSkillPrompt, loadDisabledSkills, parseInvocations } from './lib/skills';
import { activeConnections, buildToolsNote, callTool, parseMcpCommand, runMcpCommand, type RemoteMcpConnection } from './mcp';
import { StatsDisclosure, StatsPanel } from './components/StatsPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { FeatureHub } from './components/FeatureHub';
import { DEFAULT_AI_FEATURES } from './lib/features';
import { PROVIDER_PRESETS } from './lib/providers';
import { lastStatsMessage, titleFrom, updateConversation, updateMessage } from './lib/conversations';
import { isObjectArray, loadJSON, saveJSON, STORAGE_KEYS } from './lib/storage';
import { streamChat } from './lib/stream';
import { trimToBudget, DEFAULT_CONTEXT_BUDGET } from './lib/context';
import { effectiveFallbacks, modelAttemptOrder, resolveCrossProviderAttempts, runWithFallbackChain } from './lib/fallback';
import { buildUserContent, contentText } from './lib/attachments';
import { uid } from './lib/id';
import { addVariant, switchVariant } from './lib/variants';
import { autoTitle } from './lib/title';
import { searchMessages } from './lib/search';
import { extractVariables, promptCommand, filterPrompts, type PromptTemplate } from './lib/prompts';
import { CommandPalette, Dialog, PromptFillModal, ShortcutHelp, PromptLibrary, ConversationSettings } from './components/Overlays';
import { SnapshotViewer } from './components/SnapshotViewer';
import { snapshotFromHash } from './lib/snapshot';
import { exportMarkdown } from './lib/exportMarkdown';
import { speechSynthesisAvailable } from './lib/voice';
import { cleanStreamText } from './lib/cleanup';
import type { AIFeature, AgentSkill, Attachment, ChatMessage, Conversation, ProviderConfig, StoredMessage, Workspace } from './lib/types';

type Theme = 'dark' | 'light';

const PROMPTS_KEY = 'agent-deck:prompts';

function makeDefaultProviders(): ProviderConfig[] {
  return PROVIDER_PRESETS.map((p) => ({ ...p, id: uid(), apiKey: '' }));
}


export default function App() {
  const [theme, setTheme] = useState<Theme>(() => loadJSON<Theme>(STORAGE_KEYS.theme, 'dark'));
  const [providers, setProviders] = useState<ProviderConfig[]>(() => {
    const saved = loadJSON<ProviderConfig[]>(STORAGE_KEYS.providers, [], isObjectArray<ProviderConfig>);
    return saved.length > 0 ? saved : makeDefaultProviders();
  });
  const [activeProviderId, setActiveProviderId] = useState<string>(() => loadJSON<string>(STORAGE_KEYS.activeProvider, ''));
  const [conversations, setConversations] = useState<Conversation[]>(() => loadJSON<Conversation[]>(STORAGE_KEYS.conversations, [], isObjectArray<Conversation>));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<HubTab>('providers');
  const [systemPrompt, setSystemPrompt] = useState<string>(() => loadJSON<string>(STORAGE_KEYS.systemPrompt, ''));
  const [fontSize, setFontSize] = useState(() => normalizeFontSize(loadJSON(STORAGE_KEYS.fontSize, 'medium')));
  const [showMcp, setShowMcp] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [skills, setSkills] = useState<AgentSkill[]>(() => loadJSON<AgentSkill[]>(STORAGE_KEYS.agentSkills, [], isObjectArray<AgentSkill>));
  const [disabledSkills, setDisabledSkills] = useState<string[]>(() => loadDisabledSkills(localStorage.getItem(SKILL_ENABLED_KEY)));
  const [mcpConnections, setMcpConnections] = useState<RemoteMcpConnection[]>(() => loadJSON<RemoteMcpConnection[]>(STORAGE_KEYS.mcpConnections, [], isObjectArray<RemoteMcpConnection>));
  const [showHistory, setShowHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [aiFeatures, setAiFeatures] = useState<AIFeature[]>(() => loadJSON<AIFeature[]>(STORAGE_KEYS.aiFeatures, DEFAULT_AI_FEATURES, isObjectArray<AIFeature>));
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadJSON<Workspace[]>(STORAGE_KEYS.workspaces, [{ id: 'default', name: 'Personal workspace', projects: [] }], isObjectArray<Workspace>));
  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => loadJSON<PromptTemplate[]>(PROMPTS_KEY, [], isObjectArray<PromptTemplate>));
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showConvSettings, setShowConvSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [fillPrompt, setFillPrompt] = useState<PromptTemplate | null>(null);
  const [speakReplies, setSpeakReplies] = useState(() => loadJSON<boolean>('agent-deck:speak-replies', false));
  const [snapshotHash, setSnapshotHash] = useState<string | null>(() => snapshotFromHash(window.location.hash));
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0];
  const current = conversations.find((c) => c.id === currentId);

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); saveJSON(STORAGE_KEYS.theme, theme); }, [theme]);
  useEffect(() => { document.documentElement.style.fontSize = `${FONT_SIZES[fontSize]}px`; saveJSON(STORAGE_KEYS.fontSize, fontSize); }, [fontSize]);
  useEffect(() => { saveJSON(STORAGE_KEYS.systemPrompt, systemPrompt); }, [systemPrompt]);
  useEffect(() => { saveJSON(STORAGE_KEYS.providers, providers); }, [providers]);
  useEffect(() => { saveJSON(STORAGE_KEYS.activeProvider, activeProvider?.id ?? ''); }, [activeProvider]);
  useEffect(() => { saveJSON(STORAGE_KEYS.conversations, conversations); }, [conversations]);
  useEffect(() => { saveJSON(STORAGE_KEYS.mcpConnections, mcpConnections); }, [mcpConnections]);
  useEffect(() => { saveJSON(STORAGE_KEYS.agentSkills, skills); }, [skills]);
  useEffect(() => { saveJSON(STORAGE_KEYS.workspaces, workspaces); }, [workspaces]);
  useEffect(() => { saveJSON(STORAGE_KEYS.aiFeatures, aiFeatures); }, [aiFeatures]);
  useEffect(() => { saveJSON(PROMPTS_KEY, prompts); }, [prompts]);
  useEffect(() => { saveJSON('agent-deck:speak-replies', speakReplies); }, [speakReplies]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  // Global keyboard shortcuts. Cmd/Ctrl+K palette, Cmd/Ctrl+N new chat, Cmd/Ctrl+/ or ? help.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') { e.preventDefault(); setShowPalette((v) => !v); }
      else if (mod && k === 'n') { e.preventDefault(); newChat(); }
      else if (mod && e.key === '/') { e.preventDefault(); setShowShortcuts(true); }
      else if (e.key === 'Escape') { setShowPalette(false); setShowShortcuts(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Snapshot viewer route: a #snap=... hash opens the read-only viewer.
  useEffect(() => {
    const onHash = () => setSnapshotHash(snapshotFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const activeMcpTools = activeConnections(mcpConnections).flatMap((c) => c.tools.map((t) => t.name));

  function newChat() {
    if (streamingRef.current) return;
    setCurrentId(null);
    setDraft('');
  }

  function exportConversation(conversation: Conversation) {
    const blob = new Blob([exportMarkdown(conversation)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${conversation.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'conversation'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function deleteConversation(id: string) {
    if (streaming && id === currentId) return;
    setConversations((list) => list.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
  }

  function patchConversation(id: string, change: (c: Conversation) => Conversation) {
    setConversations((list) => updateConversation(list, id, change));
  }

  function stop() {
    abortRef.current?.abort();
  }

  // One stream runner for send, edit, regenerate and retry. Writes into assistantId.
  // `history` is the request context (user turns up to the prompt). `primaryOverride` picks a model for retry.
  async function runAssistant(convId: string, assistantId: string, history: ChatMessage[], opts: { providerOverride?: ProviderConfig; trimmedCount?: number } = {}) {
    const conv = conversations.find((c) => c.id === convId);
    const baseProvider = opts.providerOverride ?? (conv && providers.find((p) => p.id === conv.providerId)) ?? activeProvider;
    if (!baseProvider) return;
    const enabledFeatures = aiFeatures.filter((feature) => feature.enabled);
    const withPrompt: ChatMessage[] = [...history];
    if (skills.length > 0 || enabledFeatures.length > 0) {
      const featureInstructions = enabledFeatures.map((feature) => `- ${feature.name}: ${feature.description}`).join('\n');
      withPrompt.unshift({ role: 'system', content: `You are MercuReal assistant. Apply these enabled behaviors when relevant:\n${featureInstructions}\n\nInstalled skills:\n${skills.map((skill) => `## ${skill.name}\n${skill.instructions}`).join('\n\n')}` });
    }
    const sysPrompt = (conv?.systemPrompt ?? systemPrompt).trim();
    if (sysPrompt) withPrompt.unshift({ role: 'system', content: sysPrompt });
    const trim = trimToBudget(withPrompt, baseProvider.contextBudget ?? DEFAULT_CONTEXT_BUDGET);
    const requestMessages = trim.messages;

    const ownAttempts = modelAttemptOrder(baseProvider.model, effectiveFallbacks(baseProvider)).map((model) => ({ provider: baseProvider, model }));
    const crossAttempts = opts.providerOverride ? [] : resolveCrossProviderAttempts(baseProvider.crossProviderFallbacks ?? [], providers, baseProvider.id);
    const attempts = [...ownAttempts, ...crossAttempts];
    const labelOf = (a: { provider: ProviderConfig; model: string }) => (a.provider.id === baseProvider.id ? a.model : `${a.provider.name}: ${a.model}`);
    const overrides = { temperature: conv?.temperature, maxTokens: conv?.maxTokens };

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const outcome = await runWithFallbackChain(
        attempts,
        (a) => {
          setConversations((list) => updateMessage(list, convId, assistantId, (m) => ({ ...m, content: '' })));
          return streamChat(
            { ...a.provider, model: a.model, ...overrides.temperature !== undefined ? { temperature: overrides.temperature } : {}, ...overrides.maxTokens !== undefined ? { maxTokens: overrides.maxTokens } : {} },
            requestMessages,
            {
              signal: controller.signal,
              onDelta: (delta) => setConversations((list) => updateMessage(list, convId, assistantId, (m) => ({ ...m, content: cleanStreamText(m.content + delta) }))),
            },
          );
        },
        () => controller.signal.aborted,
        labelOf,
      );
      if (!outcome.ok) {
        const last = outcome.failures[outcome.failures.length - 1];
        const base = last ? last.message : 'no model could answer';
        const tried = outcome.failures.map((f) => f.label).join(', ');
        throw new Error(attempts.length > 1 ? `${base} (tried: ${tried})` : base);
      }
      const result = outcome.value!;
      const answered = outcome.item!;
      const fellBackFrom = answered.provider.id !== baseProvider.id || answered.model !== baseProvider.model ? baseProvider.model : undefined;
      setConversations((list) => updateMessage(list, convId, assistantId, (m) => ({
        ...m,
        content: cleanStreamText(m.content, true),
        stats: result.stats,
        model: outcome.label,
        fellBackFrom,
        trimmedCount: trim.dropped > 0 ? trim.dropped : undefined,
      })));
      // Auto-title: a new chat gets a title from its first exchange, only if still the default.
      setConversations((list) => updateConversation(list, convId, (c) => {
        if (c.messages.length > 2 || c.title !== 'New chat' && c.title !== titleFrom(contentText(c.messages[0]?.content ?? ''))) return c;
        const t = autoTitle(contentText(c.messages[0]?.content ?? ''));
        return t ? { ...c, title: t } : c;
      }));
      if (speakReplies && speechSynthesisAvailable()) {
        const u = new SpeechSynthesisUtterance(cleanStreamText(result.text ?? '', true));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (err) {
      const aborted = controller.signal.aborted;
      const message = aborted ? 'Stopped.' : err instanceof Error ? err.message : String(err);
      setConversations((list) => updateMessage(list, convId, assistantId, (m) => ({ ...m, error: message, trimmedCount: trim.dropped > 0 ? trim.dropped : undefined })));
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  // Build the chat history for a conversation up to (not including) a given index.
  function historyUpTo(list: StoredMessage[]): ChatMessage[] {
    return list.filter((m) => m.content.length > 0 && !m.error).map((m) => ({ role: m.role, content: m.content }));
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if ((!text && attachments.length === 0) || streaming || !activeProvider) return;

    // /prompt: a saved template. Insert it into the draft, or fill it in first if it has variables.
    const pcmd = attachments.length === 0 ? promptCommand(text) : null;
    if (pcmd) {
      const found = filterPrompts(prompts, pcmd.query, 1)[0];
      if (found) { openPrompt(found); return; }
    }

    // /mcp and @mcp list connections; /mcp call <server> [PROMPT_INJECTION] [json] runs a tool. No model call.
    const mcpCommand = attachments.length === 0 ? parseMcpCommand(text) : null;
    if (mcpCommand) {
      const convId = currentId ?? uid();
      const reply = await runMcpCommand(mcpCommand, mcpConnections, callTool);
      const userMsg: StoredMessage = { id: uid(), role: 'user', content: text };
      const replyMsg: StoredMessage = { id: uid(), role: 'assistant', content: reply };
      setConversations((list) => {
        const base: Conversation = list.find((c) => c.id === convId) ?? { id: convId, title: titleFrom(text), providerId: activeProvider.id, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        const next: Conversation = { ...base, updatedAt: Date.now(), messages: [...base.messages, userMsg, replyMsg] };
        return list.some((c) => c.id === convId) ? updateConversation(list, convId, () => next) : [next, ...list];
      });
      setCurrentId(convId);
      setDraft('');
      return;
    }

    const convId = currentId ?? uid();
    const sent = attachments;
    const userMsg: StoredMessage = {
      id: uid(),
      role: 'user',
      content: text,
      attachments: sent.length > 0 ? sent.map((a) => ({ name: a.name, kind: a.kind, size: a.size })) : undefined,
    };
    const assistantId = uid();
    const assistantMsg: StoredMessage = { id: assistantId, role: 'assistant', content: '' };

    setConversations((list) => {
      const base: Conversation = list.find((c) => c.id === convId) ?? {
        id: convId, title: titleFrom(text || sent[0]?.name || 'Attachment'), providerId: activeProvider.id, createdAt: Date.now(), updatedAt: Date.now(), messages: [],
      };
      const next: Conversation = { ...base, providerId: activeProvider.id, updatedAt: Date.now(), messages: [...base.messages, userMsg, assistantMsg] };
      return list.some((c) => c.id === convId) ? updateConversation(list, convId, () => next) : [next, ...list];
    });
    setCurrentId(convId);
    setDraft('');
    setAttachments([]);

    const history = historyUpTo(conversations.find((c) => c.id === convId)?.messages ?? []);
    // Bundled skills invoked with @slug in this message are stacked into the system message.
    const enabledBundled = BUNDLED_SKILLS.filter((s) => !disabledSkills.includes(s.slug));
    const invoked = parseInvocations(text, enabledBundled);
    const withSkills = injectSkillPrompt(history, buildSkillPrompt(invoked, enabledBundled));
    const withTools = injectSkillPrompt(withSkills, buildToolsNote(mcpConnections));
    withTools.push({ role: 'user', content: buildUserContent(text, sent) });
    await runAssistant(convId, assistantId, withTools);
  }

  // Edit a user message and resend from there. Everything after it is dropped.
  async function editAndResend(messageId: string, newText: string) {
    if (streaming || !current) return;
    const idx = current.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const assistantId = uid();
    const kept = current.messages.slice(0, idx);
    const edited: StoredMessage = { ...current.messages[idx], content: newText };
    const next = [...kept, edited, { id: assistantId, role: 'assistant', content: '' } as StoredMessage];
    setConversations((list) => updateConversation(list, current.id, (c) => ({ ...c, messages: next, updatedAt: Date.now() })));
    const history = historyUpTo(next.slice(0, -1));
    await runAssistant(current.id, assistantId, history);
  }

  // Regenerate an assistant reply. Adds a variant so the older reply can be swiped back to.
  async function regenerate(messageId: string) {
    if (streaming || !current) return;
    const idx = current.messages.findIndex((m) => m.id === messageId);
    if (idx < 1) return;
    const target = current.messages[idx];
    const withVariant = addVariant(target);
    const history = historyUpTo(current.messages.slice(0, idx));
    setConversations((list) => updateConversation(list, current.id, (c) => ({
      ...c,
      messages: c.messages.map((m, i) => (i === idx ? withVariant : m)),
    })));
    await runAssistant(current.id, messageId, history);
  }

  // Retry an error bubble with the next model in the fallback chain, or the next provider.
  async function retryWithDifferent(messageId: string) {
    if (streaming || !current) return;
    const idx = current.messages.findIndex((m) => m.id === messageId);
    if (idx < 1) return;
    const history = historyUpTo(current.messages.slice(0, idx));
    const convProvider = providers.find((p) => p.id === current.providerId);
    const alt = providers.find((p) => p.id !== convProvider?.id && p.apiKey) ?? convProvider;
    setConversations((list) => updateMessage(list, current.id, messageId, (m) => ({ ...m, error: undefined, content: '' })));
    await runAssistant(current.id, messageId, history, { providerOverride: alt });
  }

  function switchTo(messageId: string, index: number) {
    if (!current) return;
    patchConversation(current.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === messageId ? switchVariant(m, index) : m)) }));
  }

  function forkAt(messageId: string) {
    if (streaming || !current) return;
    const idx = current.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const id = uid();
    const copy: Conversation = {
      ...current,
      id,
      title: `${current.title} (fork)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: current.messages.slice(0, idx + 1).map((m) => ({ ...m, id: uid() })),
    };
    setConversations((list) => [copy, ...list]);
    setCurrentId(id);
  }

  function togglePin(messageId: string) {
    if (!current) return;
    patchConversation(current.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m)) }));
  }

  function feedback(messageId: string, value: 'good' | 'bad' | undefined) {
    if (!current) return;
    patchConversation(current.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, feedback: value } : m)) }));
  }

  function runPaletteItem(id: string) {
    const item = paletteItems.find((i) => i.id === id);
    setShowPalette(false);
    item?.run();
  }

  function openPrompt(p: PromptTemplate) {
    if (extractVariables(p.body).length > 0) setFillPrompt(p);
    else { setDraft(p.body); setShowPrompts(false); }
  }

  function saveConvSettings(patch: Partial<Pick<Conversation, 'systemPrompt' | 'temperature' | 'maxTokens'>>) {
    if (!current) return;
    patchConversation(current.id, (c) => ({ ...c, ...patch }));
  }

  function saveProviders(next: ProviderConfig[]) {
    setProviders(next);
    if (!next.some((p) => p.id === activeProviderId) && next[0]) setActiveProviderId(next[0].id);
  }

  const stats = lastStatsMessage(current)?.stats;
  const searchHits = useMemo(() => (showSearch ? searchMessages(conversations, draft.trim()) : []), [showSearch, conversations, draft]);
  const paletteItems = useMemo(() => [
    ...conversations.slice(0, 40).map((c) => ({ id: `chat:${c.id}`, label: c.title, group: 'Chats' as const, run: () => { setCurrentId(c.id); setShowHistory(false); } })),
    ...BUNDLED_SKILLS.slice(0, 80).map((s) => ({ id: `skill:${s.slug}`, label: s.name, group: 'Skills' as const, run: () => { setDraft(`@${s.slug} `); } })),
    ...prompts.map((p) => ({ id: `prompt:${p.id}`, label: p.name, group: 'Prompts' as const, run: () => openPrompt(p) })),
    { id: 'settings:providers', label: 'Settings: Providers', group: 'Settings' as const, run: () => { setSettingsTab('providers'); setShowSettings(true); } },
    { id: 'settings:chat', label: 'Settings: Chat', group: 'Settings' as const, run: () => { setSettingsTab('chat'); setShowSettings(true); } },
    { id: 'settings:appearance', label: 'Settings: Appearance', group: 'Settings' as const, run: () => { setSettingsTab('appearance'); setShowSettings(true); } },
    { id: 'settings:data', label: 'Settings: Data', group: 'Settings' as const, run: () => { setSettingsTab('data'); setShowSettings(true); } },
    { id: 'action:new', label: 'New chat', group: 'Actions' as const, run: newChat },
    { id: 'action:shortcuts', label: 'Keyboard shortcuts', group: 'Actions' as const, run: () => setShowShortcuts(true) },
    { id: 'action:search', label: 'Search all conversations', group: 'Actions' as const, run: () => setShowSearch(true) },
    { id: 'action:prompts', label: 'Prompt library', group: 'Actions' as const, run: () => setShowPrompts(true) },
    { id: 'action:convsettings', label: 'This chat: system prompt, temperature, max tokens', group: 'Actions' as const, run: () => setShowConvSettings(true) },
  ], [conversations, prompts]);

  if (snapshotHash) {
    return <SnapshotViewer encoded={snapshotHash} onExit={() => { window.location.hash = ''; setSnapshotHash(null); }} />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {showHistory && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setShowHistory(false)} aria-hidden="true" />}
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        disabled={streaming}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={(id) => { if (!streaming) { setCurrentId(id); setShowHistory(false); } }}
        onNew={() => { newChat(); setShowHistory(false); }}
        onDelete={deleteConversation}
        onExport={exportConversation}
        onSettings={() => { setShowHistory(false); setShowSettings(true); }}
        onToggleFlag={(id, flag) => patchConversation(id, (c) => ({ ...c, [flag]: !c[flag] }))}
        onSetTags={(id, tags) => patchConversation(id, (c) => ({ ...c, tags }))}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center gap-2 border-b border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl md:justify-between md:px-5 md:py-3 dark:border-white/10 dark:bg-slate-950/70">
          <button type="button" onClick={() => setShowHistory(true)} aria-label="Open history" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 md:hidden dark:border-slate-700">☰</button>
          <div className="min-w-0 flex-1 md:flex-initial">
            <h1 className="truncate text-sm font-semibold">{current?.title ?? 'New chat'}</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400 md:text-[11px] dark:text-cyan-300">MercuReal Assistant</p>
            <p className="truncate text-xs text-slate-500">{activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : 'No provider'}</p>
          </div>
          <div className="flex min-w-0 w-full flex-wrap items-center justify-end gap-1.5 md:w-auto md:gap-2">
            <button type="button" onClick={() => setShowPalette(true)} aria-label="Command palette" title="Command palette (Ctrl/Cmd+K)" className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">⌘K</button>
            <button type="button" onClick={() => setShowSearch(true)} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">Search</button>
            <button type="button" onClick={() => setShowPrompts(true)} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">Prompts</button>
            <button type="button" onClick={() => setShowConvSettings(true)} disabled={!current} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 disabled:opacity-40 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">This chat</button>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="min-h-11 min-w-11 rounded-md border border-slate-300 px-2.5 text-xs hover:bg-slate-100 md:min-h-0 md:min-w-0 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">
              <span className="md:hidden">{theme === 'dark' ? '☀' : '☾'}</span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
            </button>
            <button type="button" onClick={() => setShowFeatures(true)} className="min-h-11 rounded-md border border-violet-400/30 bg-violet-400/10 px-3 text-xs text-violet-200 hover:bg-violet-400/20 md:min-h-0 md:px-2.5 md:py-1">AI features {aiFeatures.filter((feature) => feature.enabled).length}</button>
            <button type="button" onClick={() => setShowDashboard(true)} className="min-h-11 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs text-cyan-200 hover:bg-cyan-400/20 md:min-h-0 md:px-2.5 md:py-1">Dashboard</button>
            <button type="button" onClick={() => setShowSkills(true)} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">Skills {skills.length > 0 && `(${skills.length})`}</button>
            <button type="button" onClick={() => setShowMcp(true)} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">Tools {activeMcpTools.length > 0 && `(${activeMcpTools.length})`}</button>
            <button type="button" onClick={() => { setSettingsTab('providers'); setShowSettings(true); }} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-100 md:min-h-0 md:px-2.5 md:py-1 dark:border-slate-700 dark:hover:bg-slate-800">Providers</button>
          </div>
        </header>

        {stats && <StatsDisclosure stats={stats} />}

        <div className="flex min-h-0 flex-1">
          <ChatView
            messages={current?.messages ?? []}
            draft={draft}
            onDraftChange={setDraft}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onSend={() => void send()}
            onStop={stop}
            onPromptSelect={setDraft}
            skills={BUNDLED_SKILLS.filter((s) => !disabledSkills.includes(s.slug))}
            streaming={streaming}
            mcpTools={activeMcpTools}
            providerReady={Boolean(activeProvider?.apiKey) || (activeProvider?.kind === 'openai' && activeProvider.baseUrl.includes('localhost'))}
            speakReplies={speakReplies}
            onSpeakToggle={() => setSpeakReplies((v) => !v)}
            onEdit={(id, text) => void editAndResend(id, text)}
            onRegenerate={(id) => void regenerate(id)}
            onSwitchVariant={switchTo}
            onFork={forkAt}
            onPin={togglePin}
            onReact={feedback}
            onRetryWith={(id) => void retryWithDifferent(id)}
          />
          <StatsPanel stats={stats} />
        </div>
      </main>

      {showPalette && <CommandPalette items={paletteItems} onRun={runPaletteItem} onClose={() => setShowPalette(false)} />}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
      {showPrompts && <PromptLibrary prompts={prompts} onChange={setPrompts} onUse={openPrompt} onClose={() => setShowPrompts(false)} />}
      {fillPrompt && <PromptFillModal prompt={fillPrompt} onClose={() => setFillPrompt(null)} onDone={(text) => { setDraft(text); setFillPrompt(null); setShowPrompts(false); }} />}
      {showConvSettings && current && (
        <ConversationSettings
          conversation={current}
          globalSystemPrompt={systemPrompt}
          onSave={saveConvSettings}
          onClose={() => setShowConvSettings(false)}
        />
      )}
      {showSearch && (
        <Dialog title="Search all conversations" onClose={() => setShowSearch(false)} wide>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search messages" aria-label="Search messages" className="mb-3 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900 md:text-sm" />
          <ul className="space-y-2">
            {searchHits.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setCurrentId(h.convId); setShowSearch(false); }} className="w-full rounded-md border border-slate-200 p-2 text-left text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <span className="font-medium">{h.title}</span> · {h.role}
                  <span className="block truncate text-slate-500">{h.snippet}</span>
                </button>
              </li>
            ))}
            {draft.trim() && searchHits.length === 0 && <li className="text-xs text-slate-500">No matches.</li>}
          </ul>
        </Dialog>
      )}

      {showFeatures && <FeatureHub features={aiFeatures} onChange={setAiFeatures} onClose={() => setShowFeatures(false)} />}
      {showDashboard && <DashboardPanel conversations={conversations} workspaces={workspaces} onWorkspacesChange={setWorkspaces} onClose={() => setShowDashboard(false)} />}
      {showSkills && <SkillsPanel skills={skills} onChange={setSkills} bundled={BUNDLED_SKILLS} disabled={disabledSkills} onDisabledChange={(next) => { setDisabledSkills(next); localStorage.setItem(SKILL_ENABLED_KEY, JSON.stringify(next)); }} onClose={() => setShowSkills(false)} />}
      {showMcp && <McpPanel connections={mcpConnections} onChange={setMcpConnections} onClose={() => setShowMcp(false)} />}

      {showSettings && (
        <SettingsHub
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={() => setShowSettings(false)}
          providers={providers}
          activeProviderId={activeProvider?.id ?? ''}
          onProvidersChange={saveProviders}
          onActivate={setActiveProviderId}
          skills={skills}
          onSkillsChange={setSkills}
          bundledSkills={BUNDLED_SKILLS}
          disabledSkills={disabledSkills}
          onDisabledSkillsChange={(next) => { setDisabledSkills(next); localStorage.setItem(SKILL_ENABLED_KEY, JSON.stringify(next)); }}
          mcpContent={<McpPanel embedded connections={mcpConnections} onChange={setMcpConnections} onClose={() => setShowSettings(false)} />}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          theme={theme}
          onThemeChange={setTheme}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          getStorage={() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? '']))}
          setStorage={(entries) => {
            for (const k of Object.keys(localStorage)) if (k.startsWith(DATA_PREFIX)) localStorage.removeItem(k);
            for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
            window.location.reload();
          }}
          clearStorage={() => {
            for (const k of Object.keys(localStorage)) if (k.startsWith(DATA_PREFIX)) localStorage.removeItem(k);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}


import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { Attachment, StoredMessage } from '../lib/types';
import { readAttachment, contentText } from '../lib/attachments';
import { activeMention, filterSkills, type BundledSkill } from '../lib/skills';
import { estimateTokens } from '../lib/stats';
import { activeIndex, variantCount } from '../lib/variants';

type Reaction = 'good' | 'bad' | undefined;
import { getSpeechRecognitionCtor, finalTranscript, type SpeechRecognitionLike } from '../lib/voice';
import { Markdown } from './Markdown';

export interface BubbleActions {
  onEdit: (id: string, text: string) => void;
  onRegenerate: (id: string) => void;
  onSwitchVariant: (id: string, index: number) => void;
  onFork: (id: string) => void;
  onPin: (id: string) => void;
  onReact: (id: string, reaction: Reaction) => void;
  onRetryWith: (id: string) => void;
}

interface ChatViewProps extends BubbleActions {
  messages: StoredMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  onSend: () => void;
  onStop: () => void;
  onPromptSelect?: (prompt: string) => void;
  streaming: boolean;
  mcpTools: string[];
  providerReady: boolean;
  skills?: BundledSkill[];
  speakReplies: boolean;
  onSpeakToggle: () => void;
}

export function ChatView(props: ChatViewProps) {
  const {
    messages, draft, onDraftChange, attachments, onAttachmentsChange, onSend, onStop, onPromptSelect,
    streaming, mcpTools, providerReady, skills = [], speakReplies, onSpeakToggle,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(-1);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechCtor = getSpeechRecognitionCtor();
  // @mention autocomplete: shows matching bundled skills while the caret sits inside an @token.
  const mention = caret >= 0 ? activeMention(draft, caret) : null;
  const suggestions = mention ? filterSkills(skills, mention.query) : [];

  function pickSkill(skill: BundledSkill | undefined) {
    if (!skill || !mention) return;
    const after = draft.slice(mention.start + 1 + mention.query.length);
    onDraftChange(`${draft.slice(0, mention.start)}@${skill.slug} ${after.replace(/^\s+/, '')}`);
    setCaret(-1);
  }

  async function addFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      next.push(await readAttachment(file, `${file.name}-${file.size}-${Date.now()}-${Math.random()}`));
    }
    onAttachmentsChange([...attachments, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Image paste: an image on the clipboard becomes an attachment. Text paste is left alone.
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    e.preventDefault();
    void addFiles(images);
  }

  function toggleVoice() {
    if (!speechCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError(null);
    const rec = new speechCtor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const said = finalTranscript(event);
      if (said) onDraftChange(draft.trim() ? `${draft.trim()} ${said}` : said);
    };
    rec.onerror = (event) => setVoiceError(event.error === 'not-allowed' ? 'microphone blocked' : `voice error: ${event.error}`);
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  useEffect(() => () => recognitionRef.current?.stop(), []);

  // Scroll only the chat container (not the page) so fixed chrome never shifts; re-runs on every streamed chunk.
  const last = messages[messages.length - 1];
  const lastLength = last ? last.content.length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastLength, streaming]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (!streaming) onSend();
    }
  }

  const draftTokens = estimateTokens(draft);
  const pinned = messages.filter((m) => m.pinned);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      {pinned.length > 0 && (
        <div className="border-b border-amber-300/40 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-900 md:px-6 dark:bg-amber-900/20 dark:text-amber-200" aria-label="Pinned messages">
          📌 {pinned.length} pinned: {pinned.map((m) => contentText(m.content).slice(0, 40)).join(' · ')}
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 md:space-y-4 md:px-6 md:py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-md px-2 text-center text-sm text-slate-500 md:mt-16 md:px-0">
            <p className="font-medium text-slate-700 dark:text-slate-300">Start a conversation</p>
            <p className="mt-1">
              Add an API key under Providers, then send a message. Responses stream in token by token.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {['Summarize this topic clearly', 'Help me plan a project', 'Review this code for risks'].map((prompt) => (
                <button key={prompt} type="button" onClick={() => onPromptSelect?.(prompt)} className="rounded-full border border-slate-300 px-3 py-2 text-xs hover:border-indigo-500 hover:text-indigo-500 dark:border-slate-700">{prompt}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={m.id}
            message={m}
            index={i}
            isLast={i === messages.length - 1}
            streaming={streaming}
            actions={props}
          />
        ))}
      </div>

      <form
        className="relative border-t border-white/60 bg-white/70 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-4 dark:border-white/10 dark:bg-slate-950/70"
        onSubmit={(e) => {
          e.preventDefault();
          if (streaming) onStop();
          else onSend();
        }}
      >
        {suggestions.length > 0 && (
          <ul role="listbox" aria-label="Skills" className="absolute bottom-full left-3 right-3 mb-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg md:left-4 md:right-4 dark:border-slate-700 dark:bg-slate-900">
            {suggestions.map((skill, i) => (
              <li key={skill.slug} role="option" aria-selected={i === suggestIdx}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pickSkill(skill); }} className={`flex w-full flex-col px-3 py-2 text-left text-sm ${i === suggestIdx ? 'bg-indigo-50 dark:bg-slate-800' : ''}`}>
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">@{skill.slug}</span>
                  <span className="truncate text-xs text-slate-500">{skill.name} · {skill.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {mcpTools.length > 0 && <p className="mb-2 text-xs text-slate-500">MCP tools enabled: {mcpTools.join(', ')}</p>}
        {!providerReady && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
            This provider has no API key yet. Open Providers to add one.
          </p>
        )}
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Attachments">
            {attachments.map((a) => (
              <li key={a.id} className="flex max-w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                {a.kind === 'image' && a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span aria-hidden="true">{a.kind === 'text' ? '📄' : '📎'}</span>
                )}
                <span className="max-w-[10rem] truncate">{a.name}</span>
                {a.reason && <span className="text-red-500">{a.reason}</span>}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))}
                  className="min-h-8 px-1 text-slate-500 hover:text-red-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,text/*,.md,.csv,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.sql,.log"
            className="hidden"
            aria-label="Attach files"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
            className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 text-base hover:bg-slate-100 md:min-h-[2.5rem] md:text-sm dark:border-slate-700 dark:hover:bg-slate-800"
          >
            📎
          </button>
          {speechCtor && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={listening}
              title="Voice input"
              className={`min-h-11 shrink-0 rounded-md border px-3 text-base md:min-h-[2.5rem] md:text-sm ${listening ? 'border-red-400 bg-red-500/10 text-red-500' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'}`}
            >
              🎤
            </button>
          )}
          <textarea
            value={draft}
            onChange={(e) => { onDraftChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (mention && suggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIdx((i) => (i + 1) % suggestions.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickSkill(suggestions[suggestIdx]); return; }
                if (e.key === 'Escape') { e.preventDefault(); setCaret(-1); return; }
              }
              onKeyDown(e);
            }}
            rows={2}
            placeholder="Message (Enter to send, Shift+Enter for newline)"
            aria-label="Message"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-300/80 bg-white/80 px-3 py-2 text-base shadow-inner outline-none transition-colors duration-200 focus:border-indigo-500 md:min-h-[2.5rem] md:text-sm dark:border-white/10 dark:bg-slate-900/70"
          />
          <button
            type="submit"
            disabled={!streaming && draft.trim().length === 0 && attachments.length === 0}
            className="min-h-11 shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white md:min-h-0 hover:bg-indigo-500 disabled:opacity-50"
          >
            {streaming ? 'Stop' : 'Send'}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span>{voiceError ?? (listening ? 'listening…' : '')}</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={onSpeakToggle} aria-pressed={speakReplies} className="min-h-8 rounded px-1 hover:text-indigo-500">
              {speakReplies ? '🔊 speaker on' : '🔈 speaker off'}
            </button>
            <span aria-live="polite">~{draftTokens} tokens</span>
          </span>
        </div>
      </form>
    </section>
  );
}

function Bubble({ message, index, isLast, streaming, actions }: {
  message: StoredMessage; index: number; isLast: boolean; streaming: boolean; actions: BubbleActions;
}) {
  const isUser = message.role === 'user';
  const pending = !isUser && streaming && !message.stats && !message.error && message.content === '';
  const live = !isUser && streaming && !message.stats && !message.error;
  const plain = contentText(message.content);
  const variants = variantCount(message);
  const shown = activeIndex(message);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(plain);
  const busy = streaming;

  return (
    <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`} data-index={index}>
      <div
        className={`max-w-[88%] break-words rounded-lg px-3.5 py-2.5 text-sm leading-relaxed md:max-w-[75%] md:px-4 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border border-white/70 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70'
        } ${live ? 'caret' : ''} ${message.pinned ? 'ring-1 ring-amber-400' : ''}`}
      >
        {message.attachments && message.attachments.length > 0 && (
          <p className="mb-1 text-xs opacity-80">
            Attached: {message.attachments.map((a) => `${a.name}${a.kind === 'unsupported' ? ' (unsupported)' : ''}`).join(', ')}
          </p>
        )}
        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); setEditing(false); actions.onEdit(message.id, editText); }}
            className="space-y-2"
          >
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              aria-label="Edit message"
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-base text-slate-900 md:text-sm"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button type="button" onClick={() => setEditing(false)} className="min-h-9 rounded px-2">Cancel</button>
              <button type="submit" className="min-h-9 rounded bg-indigo-600 px-3 text-white">Save and resend</button>
            </div>
          </form>
        ) : pending ? (
          <span className="text-slate-500">Thinking…</span>
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{plain}</span>
        ) : (
          <Markdown source={plain} />
        )}
        {!isUser && message.trimmedCount !== undefined && (
          <p className="mt-2 text-xs text-slate-500">older messages trimmed for context limit ({message.trimmedCount} dropped)</p>
        )}
        {!isUser && message.model && message.stats && (
          <p className="mt-2 text-xs text-slate-500">
            answered by {message.model}
            {message.fellBackFrom ? ` (fell back from ${message.fellBackFrom} after a rate or size limit)` : ''}
          </p>
        )}
        {message.error && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-red-500" role="alert">Error: {message.error}</p>
            {!busy && (
              <button type="button" onClick={() => actions.onRetryWith(message.id)} className="min-h-9 rounded-md border border-red-400/50 px-3 text-xs text-red-500 hover:bg-red-500/10">
                Retry with a different model
              </button>
            )}
          </div>
        )}
        {!pending && !live && !editing && (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-1 text-xs text-slate-500">
            {!isUser && variants > 1 && (
              <span className="flex items-center gap-1" aria-label="Reply variants">
                <button type="button" disabled={busy || shown === 0} onClick={() => actions.onSwitchVariant(message.id, shown - 1)} aria-label="Previous reply" className="min-h-8 min-w-8 rounded disabled:opacity-40">‹</button>
                <span>{shown + 1}/{variants}</span>
                <button type="button" disabled={busy || shown >= variants - 1} onClick={() => actions.onSwitchVariant(message.id, shown + 1)} aria-label="Next reply" className="min-h-8 min-w-8 rounded disabled:opacity-40">›</button>
              </span>
            )}
            {!isUser && plain.length > 0 && <CopyButton text={plain} />}
            {isUser && !busy && <button type="button" onClick={() => { setEditText(plain); setEditing(true); }} className="min-h-8 rounded px-2 hover:bg-slate-100 dark:hover:bg-slate-800">Edit</button>}
            {!isUser && isLast && !busy && <button type="button" onClick={() => actions.onRegenerate(message.id)} className="min-h-8 rounded px-2 hover:bg-slate-100 dark:hover:bg-slate-800">Regenerate</button>}
            <button type="button" onClick={() => actions.onFork(message.id)} disabled={busy} className="min-h-8 rounded px-2 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">Fork</button>
            <button type="button" onClick={() => actions.onPin(message.id)} aria-pressed={!!message.pinned} className="min-h-8 rounded px-2 hover:bg-slate-100 dark:hover:bg-slate-800">{message.pinned ? 'Unpin' : 'Pin'}</button>
            {!isUser && (
              <>
                <button type="button" onClick={() => actions.onReact(message.id, message.feedback === 'good' ? undefined : 'good')} aria-pressed={message.feedback === 'good'} aria-label="Good response" className={`min-h-8 min-w-8 rounded ${message.feedback === 'good' ? 'text-emerald-500' : ''}`}>👍</button>
                <button type="button" onClick={() => actions.onReact(message.id, message.feedback === 'bad' ? undefined : 'bad')} aria-pressed={message.feedback === 'bad'} aria-label="Bad response" className={`min-h-8 min-w-8 rounded ${message.feedback === 'bad' ? 'text-red-500' : ''}`}>👎</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied reply' : 'Copy reply as text'}
      className="min-h-8 rounded px-2 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

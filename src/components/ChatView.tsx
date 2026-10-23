import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Attachment, StoredMessage } from '../lib/types';
import { readAttachment } from '../lib/attachments';
import { activeMention, filterSkills, type BundledSkill } from '../lib/skills';
import { contentText } from '../lib/attachments';

interface ChatViewProps {
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
}

export function ChatView({
  messages,
  draft,
  onDraftChange,
  attachments,
  onAttachmentsChange,
  onSend,
  onStop,
  onPromptSelect,
  streaming,
  mcpTools,
  providerReady,
  skills = [],
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(-1);
  const [suggestIdx, setSuggestIdx] = useState(0);
  // @mention autocomplete: shows matching bundled skills while the caret sits inside an @token.
  const mention = caret >= 0 ? activeMention(draft, caret) : null;
  const suggestions = mention ? filterSkills(skills, mention.query) : [];

  function pickSkill(skill: BundledSkill | undefined) {
    if (!skill || !mention) return;
    const after = draft.slice(mention.start + 1 + mention.query.length);
    onDraftChange(`${draft.slice(0, mention.start)}@${skill.slug} ${after.replace(/^\s+/, '')}`);
    setCaret(-1);
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      next.push(await readAttachment(file, `${file.name}-${file.size}-${Date.now()}-${Math.random()}`));
    }
    onAttachmentsChange([...attachments, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  }

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

  return (
    <section className="flex min-w-0 flex-1 flex-col">
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
        {messages.map((m) => (
          <Bubble key={m.id} message={m} streaming={streaming} />
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
          <textarea
            value={draft}
            onChange={(e) => { onDraftChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
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
            // 16px on phones stops iOS Safari from zooming into the field; 14px from md up as before.
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
      </form>
    </section>
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
      className="min-h-11 rounded-md px-2 text-xs text-slate-500 hover:bg-slate-100 md:min-h-0 md:py-0.5 dark:hover:bg-slate-800"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

function Bubble({ message, streaming }: { message: StoredMessage; streaming: boolean }) {
  const isUser = message.role === 'user';
  const pending = !isUser && streaming && !message.stats && !message.error && message.content === '';
  const live = !isUser && streaming && !message.stats && !message.error;
  const plain = contentText(message.content);
  const canCopy = !isUser && !pending && plain.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] break-words whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed md:max-w-[75%] md:px-4 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border border-white/70 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70'
        } ${live ? 'caret' : ''}`}
      >
        {message.attachments && message.attachments.length > 0 && (
          <p className="mb-1 text-xs opacity-80">
            Attached: {message.attachments.map((a) => `${a.name}${a.kind === 'unsupported' ? ' (unsupported)' : ''}`).join(', ')}
          </p>
        )}
        {pending ? <span className="text-slate-500">Thinking…</span> : plain}
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
          <p className="mt-2 text-xs text-red-500" role="alert">
            Error: {message.error}
          </p>
        )}
        {canCopy && !live && (
          <div className="mt-1 flex justify-end">
            <CopyButton text={plain} />
          </div>
        )}
      </div>
    </div>
  );
}

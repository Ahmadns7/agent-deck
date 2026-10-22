import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { StoredMessage } from '../lib/types';

interface ChatViewProps {
  messages: StoredMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  providerReady: boolean;
}

export function ChatView({
  messages,
  draft,
  onDraftChange,
  onSend,
  onStop,
  streaming,
  providerReady,
}: ChatViewProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) onSend();
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700 dark:text-slate-300">Start a conversation</p>
            <p className="mt-1">
              Add an API key under Providers, then send a message. Responses stream in token by token.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} streaming={streaming} />
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (streaming) onStop();
          else onSend();
        }}
      >
        {!providerReady && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
            This provider has no API key yet. Open Providers to add one.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Message (Enter to send, Shift+Enter for newline)"
            aria-label="Message"
            className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!streaming && draft.trim().length === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {streaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}

function Bubble({ message, streaming }: { message: StoredMessage; streaming: boolean }) {
  const isUser = message.role === 'user';
  const pending = !isUser && streaming && !message.stats && !message.error && message.content === '';
  const live = !isUser && streaming && !message.stats && !message.error;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        } ${live ? 'caret' : ''}`}
      >
        {pending ? <span className="text-slate-500">Thinking…</span> : message.content}
        {message.error && (
          <p className="mt-2 text-xs text-red-500" role="alert">
            Error: {message.error}
          </p>
        )}
      </div>
    </div>
  );
}

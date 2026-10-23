import { useMemo, useState } from 'react';
import type { Conversation } from '../lib/types';

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  disabled: boolean;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (conversation: Conversation) => void;
}

// Below md the sidebar is an off-canvas drawer toggled from the header.
// From md up it is a static column, exactly as before.
export function Sidebar({ conversations, currentId, disabled, open, onClose, onSelect, onNew, onDelete, onExport }: SidebarProps) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => [...conversations]
    .filter((conversation) => conversation.title.toLowerCase().includes(query.toLowerCase()) || conversation.messages.some((message) => message.content.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => b.updatedAt - a.updatedAt), [conversations, query]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="min-h-11 flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 md:min-h-0"
        >
          New chat
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-lg dark:border-slate-700 md:hidden"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center justify-between px-3 pb-1">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">History</div>
        <span className="text-[11px] text-slate-400">{conversations.length}</span>
      </div>
      <div className="px-3 pb-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" className="min-h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700" />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {sorted.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">No conversations yet.</p>}
        <ul className="space-y-1">
          {sorted.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                disabled={disabled && c.id !== currentId}
                aria-current={c.id === currentId ? 'true' : undefined}
                className={`min-h-11 min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm md:min-h-0 ${
                  c.id === currentId
                    ? 'bg-slate-200 font-medium dark:bg-slate-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                {c.title}
              </button>
              <button type="button" onClick={() => onExport(c)} aria-label={`Export ${c.title}`} className="hidden px-1 text-xs text-slate-500 hover:text-indigo-500 md:group-hover:block">↗</button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                disabled={disabled && c.id === currentId}
                aria-label={`Delete ${c.title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-xs text-slate-500 hover:text-red-500 md:invisible md:h-auto md:w-auto md:px-1.5 md:py-0 md:group-hover:visible"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

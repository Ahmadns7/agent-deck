import type { Conversation } from '../lib/types';

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, currentId, disabled, onSelect, onNew, onDelete }: SidebarProps) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          New chat
        </button>
      </div>
      <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-500">History</div>
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
                className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  c.id === currentId
                    ? 'bg-slate-200 font-medium dark:bg-slate-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                {c.title}
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                disabled={disabled && c.id === currentId}
                aria-label={`Delete ${c.title}`}
                className="invisible rounded px-1.5 text-xs text-slate-500 hover:text-red-500 group-hover:visible"
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

import { useState } from 'react';
import { uid } from '../lib/id';
import { MCP_CATALOG, MCP_CATEGORIES, discoverTools, isHttpsOrLocal, type RemoteMcpConnection } from '../mcp';

interface McpPanelProps {
  connections: RemoteMcpConnection[];
  onChange: (connections: RemoteMcpConnection[]) => void;
  onClose: () => void;
  // Render inside the Settings hub without its own overlay or header.
  embedded?: boolean;
}

const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950';

export function McpPanel({ connections, onChange, onClose, embedded }: McpPanelProps) {
  const [tab, setTab] = useState<'catalog' | 'connections'>('catalog');
  const [category, setCategory] = useState<string>('all');
  const [draft, setDraft] = useState({ name: '', url: '', authHeader: '' });
  const [formError, setFormError] = useState('');

  const rows = category === 'all' ? MCP_CATALOG : MCP_CATALOG.filter((e) => e.category === category);

  function patch(id: string, change: Partial<RemoteMcpConnection>) {
    onChange(connections.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }

  function addConnection() {
    if (!draft.name.trim() || !draft.url.trim()) return setFormError('Name and URL are required.');
    if (!isHttpsOrLocal(draft.url.trim())) return setFormError('URL must be https (http only for localhost).');
    setFormError('');
    onChange([
      ...connections,
      { id: uid(), name: draft.name.trim(), url: draft.url.trim(), authHeader: draft.authHeader.trim(), enabled: true, tools: [], status: 'idle' },
    ]);
    setDraft({ name: '', url: '', authHeader: '' });
  }

  async function connect(conn: RemoteMcpConnection) {
    patch(conn.id, { status: 'idle', error: undefined });
    try {
      const { tools, sessionId } = await discoverTools(conn);
      patch(conn.id, { tools, sessionId, status: 'connected', error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      patch(conn.id, { status: 'error', error: message, tools: [] });
    }
  }

  const panel = (
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl md:max-w-4xl md:rounded-lg dark:border-slate-800 dark:bg-slate-900">
        {!embedded && (
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div><h2 className="font-semibold">MCP</h2><p className="text-xs text-slate-500">Browse 50 web-dev MCP servers, or connect a remote one.</p></div>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-slate-500">Close</button>
        </div>
        )}
        <div className="flex gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'catalog'} onClick={() => setTab('catalog')} className={`min-h-11 rounded-md px-3 text-sm ${tab === 'catalog' ? 'bg-slate-200 dark:bg-slate-800' : ''}`}>Catalog ({MCP_CATALOG.length})</button>
          <button type="button" role="tab" aria-selected={tab === 'connections'} onClick={() => setTab('connections')} className={`min-h-11 rounded-md px-3 text-sm ${tab === 'connections' ? 'bg-slate-200 dark:bg-slate-800' : ''}`}>Connections ({connections.length})</button>
        </div>

        {tab === 'catalog' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <label className="mb-3 block text-xs text-slate-500">Category
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {MCP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <p className="mb-2 text-xs text-slate-500">Local (stdio) servers run on your machine with npx or uvx. This browser app cannot launch them. Copy the config snippet into your client. Hosted entries can be added under Connections if CORS allows.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-2">Name</th><th className="pr-2">Category</th><th className="pr-2">Transport</th><th className="pr-2">Description</th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                      <td className="py-2 pr-2 font-medium">{e.name}</td>
                      <td className="pr-2">{e.category}</td>
                      <td className="pr-2">{e.transport}{e.remoteUrl ? ' (hosted)' : ''}</td>
                      <td className="pr-2 text-slate-600 dark:text-slate-300">
                        {e.description}
                        <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">config</summary><pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 dark:bg-slate-950">{JSON.stringify(e.config, null, 2)}</pre></details>
                        {e.remoteUrl && <button type="button" onClick={() => { setDraft({ name: e.name, url: e.remoteUrl ?? '', authHeader: '' }); setTab('connections'); }} className="mt-1 block text-xs text-cyan-600">Use as remote connection</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'connections' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <p className="text-xs text-slate-500">Only remote servers that speak streamable HTTP work here. Each must allow CORS from this origin. Auth headers are stored in this browser only.</p>
            {connections.length === 0 && <p className="text-sm text-slate-500">No remote connections yet.</p>}
            {connections.map((c) => (
              <div key={c.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="font-medium">{c.name}</p><p className="truncate text-xs text-slate-500">{c.url}</p></div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.enabled} onChange={() => patch(c.id, { enabled: !c.enabled })} />{c.enabled ? 'Enabled' : 'Disabled'}</label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button type="button" onClick={() => connect(c)} className="min-h-11 rounded-md border border-slate-300 px-3 md:min-h-0 md:py-1 dark:border-slate-700">{c.status === 'connected' ? 'Reconnect' : 'Connect'}</button>
                  <span className="text-slate-500">{c.status === 'connected' ? `${c.tools.length} tools` : c.status === 'error' ? `Error: ${c.error}` : 'Not connected'}</span>
                  <button type="button" onClick={() => onChange(connections.filter((x) => x.id !== c.id))} className="ml-auto text-red-500">Remove</button>
                </div>
                {c.tools.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 dark:text-slate-300">{c.tools.map((t) => <li key={t.name}><span className="font-medium">{t.name}</span>{t.description ? `: ${t.description}` : ''}</li>)}</ul>}
              </div>
            ))}
            <div className="space-y-2 rounded-md border border-dashed border-slate-400 p-3 dark:border-slate-600">
              <p className="text-sm font-medium">Add remote server</p>
              <label className="block text-xs text-slate-500">Name<input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label className="block text-xs text-slate-500">MCP endpoint URL<input className={inputClass} placeholder="https://mcp.example.com/mcp" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></label>
              <label className="block text-xs text-slate-500">Auth header (optional)<input className={inputClass} placeholder="Authorization: Bearer <token>" value={draft.authHeader} onChange={(e) => setDraft({ ...draft, authHeader: e.target.value })} /></label>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <button type="button" onClick={addConnection} className="min-h-11 rounded-md bg-slate-900 px-4 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Add connection</button>
            </div>
          </div>
        )}
      </div>
  );
  if (embedded) return panel;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="MCP">
      {panel}
    </div>
  );
}

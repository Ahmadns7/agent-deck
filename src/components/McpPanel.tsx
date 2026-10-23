import { useState } from 'react';
import { uid } from '../lib/id';
import type { McpServer } from '../lib/types';

interface McpPanelProps {
  servers: McpServer[];
  onChange: (servers: McpServer[]) => void;
  onClose: () => void;
}

export function McpPanel({ servers, onChange, onClose }: McpPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(servers[0]?.id ?? null);
  const editing = servers.find((server) => server.id === editingId);

  function updateServer(id: string, patch: Partial<McpServer>) {
    onChange(servers.map((server) => (server.id === id ? { ...server, ...patch } : server)));
  }

  function toggleTool(serverId: string, toolId: string) {
    onChange(servers.map((server) => server.id !== serverId ? server : {
      ...server,
      tools: server.tools.map((tool) => tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool),
    }));
  }

  function addServer() {
    const server: McpServer = { id: uid(), name: 'New MCP server', url: 'http://localhost:3000/mcp', status: 'offline', tools: [] };
    onChange([...servers, server]);
    setEditingId(server.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="MCP tools">
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl md:max-w-2xl md:rounded-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div><h2 className="font-semibold">MCP tools</h2><p className="text-xs text-slate-500">Choose tools available to your conversations.</p></div>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-slate-500">Close</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[14rem_1fr] md:p-5">
          <div className="space-y-2">
            {servers.map((server) => <button key={server.id} type="button" onClick={() => setEditingId(server.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${editingId === server.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}><span className="block truncate">{server.name}</span><span className="text-xs text-slate-500">{server.tools.filter((tool) => tool.enabled).length} enabled</span></button>)}
            <button type="button" onClick={addServer} className="w-full rounded-md border border-dashed border-slate-400 px-3 py-2 text-left text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300">+ Add server</button>
          </div>
          <div className="min-w-0">
            {!editing && <p className="text-sm text-slate-500">Add an MCP server to get started.</p>}
            {editing && <div className="space-y-4">
              <label className="block text-xs text-slate-500">Server name<input className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950" value={editing.name} onChange={(e) => updateServer(editing.id, { name: e.target.value })} /></label>
              <label className="block text-xs text-slate-500">MCP endpoint<input className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950" value={editing.url} onChange={(e) => updateServer(editing.id, { url: e.target.value })} /></label>
              <div><div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Available tools</div>{editing.tools.length === 0 ? <p className="text-sm text-slate-500">Connect this server to discover tools.</p> : <div className="space-y-2">{editing.tools.map((tool) => <label key={tool.id} className="flex cursor-pointer gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"><input type="checkbox" checked={tool.enabled} onChange={() => toggleTool(editing.id, tool.id)} /><span><span className="block text-sm font-medium">{tool.name}</span><span className="text-xs text-slate-500">{tool.description}</span></span></label>)}</div>}</div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { Conversation, Workspace } from '../lib/types';
import { uid } from '../lib/id';
import { useModal } from '../lib/useModal';

interface DashboardPanelProps {
  conversations: Conversation[];
  workspaces: Workspace[];
  onWorkspacesChange: (workspaces: Workspace[]) => void;
  onClose: () => void;
}

export function DashboardPanel({ conversations, workspaces, onWorkspacesChange, onClose }: DashboardPanelProps) {
  const dialogRef = useModal(onClose);
  const [name, setName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const usage = useMemo(() => {
    const stats = conversations.flatMap((c) => c.messages).map((m) => m.stats).filter(Boolean);
    return {
      chats: conversations.length,
      responses: stats.length,
      tokens: stats.reduce((sum, stat) => sum + (stat?.totalTokens ?? 0), 0),
      latency: stats.length ? Math.round(stats.reduce((sum, stat) => sum + (stat?.totalMs ?? 0), 0) / stats.length) : 0,
    };
  }, [conversations]);

  function addWorkspace() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...workspaces, { id: uid(), name: trimmed, projects: [] }];
    onWorkspacesChange(next);
    setActiveWorkspaceId(next[next.length - 1]?.id ?? '');
    setName('');
  }

  function addProject() {
    const trimmed = projectName.trim();
    if (!trimmed || !activeWorkspaceId) return;
    onWorkspacesChange(workspaces.map((workspace) => workspace.id === activeWorkspaceId
      ? { ...workspace, projects: [...workspace.projects, { id: uid(), name: trimmed, description: 'New assistant workspace project', updatedAt: Date.now() }] }
      : workspace));
    setProjectName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm md:items-center">
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" className="w-full max-w-5xl rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-slate-100 shadow-2xl md:p-7" aria-label="Dashboard">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">MercuReal assistant</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Command dashboard</h2><p className="mt-1 text-sm text-slate-400">Monitor usage and shape your workspaces without leaving the conversation.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">Close</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[['Chats', usage.chats], ['Responses', usage.responses], ['Tokens', usage.tokens.toLocaleString()], ['Avg latency', usage.latency ? `${usage.latency}ms` : '—']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between"><h3 className="font-medium">Workspaces</h3><span className="text-xs text-slate-500">{workspaces.length} total</span></div><div className="mt-3 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"/><button type="button" onClick={addWorkspace} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950">Add</button></div><div className="mt-3 space-y-2">{workspaces.map((workspace) => <button key={workspace.id} type="button" onClick={() => setActiveWorkspaceId(workspace.id)} className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${workspace.id === activeWorkspaceId ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 hover:bg-white/5'}`}><span className="font-medium">{workspace.name}</span><span className="ml-2 text-xs text-slate-500">{workspace.projects.length} projects</span></button>)}</div></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between"><h3 className="font-medium">Projects</h3><span className="text-xs text-slate-500">{workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? 'Select a workspace'}</span></div><div className="mt-3 flex gap-2"><input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"/><button type="button" onClick={addProject} disabled={!activeWorkspaceId} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">Create</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{(workspaces.find((w) => w.id === activeWorkspaceId)?.projects ?? []).map((project) => <div key={project.id} className="rounded-lg border border-white/10 p-3"><p className="font-medium">{project.name}</p><p className="mt-1 text-xs text-slate-500">{project.description}</p></div>)}{!activeWorkspaceId && <p className="text-sm text-slate-500">Create or select a workspace to start a project.</p>}</div></div>
        </div>
      </section>
    </div>
  );
}

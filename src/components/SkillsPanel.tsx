import { useState } from 'react';
import { uid } from '../lib/id';
import type { AgentSkill } from '../lib/types';
import type { BundledSkill } from '../lib/skills';

interface SkillsPanelProps {
  skills: AgentSkill[];
  onChange: (skills: AgentSkill[]) => void;
  bundled: BundledSkill[];
  disabled: string[];
  onDisabledChange: (next: string[]) => void;
  onClose: () => void;
}

function rawCandidates(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return [];
  const [owner, repo, ...rest] = parts;
  const branch = rest[0] === 'tree' || rest[0] === 'blob' ? rest[1] : 'main';
  const suffix = rest[0] === 'tree' || rest[0] === 'blob' ? rest.slice(2).join('/') : '';
  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${suffix ? `${suffix}/` : ''}SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${suffix ? `${suffix}/` : ''}README.md`,
  ];
}

export function SkillsPanel({ skills, onChange, bundled, disabled, onDisabledChange, onClose }: SkillsPanelProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function install() {
    setError('');
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
      if (parsed.hostname !== 'github.com') throw new Error('Paste a github.com repository or file link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enter a valid GitHub link.');
      return;
    }
    setBusy(true);
    try {
      let instructions = '';
      for (const candidate of rawCandidates(parsed)) {
        const response = await fetch(candidate);
        if (response.ok) { instructions = await response.text(); break; }
      }
      if (!instructions) throw new Error('No SKILL.md or README.md was found at that link.');
      const firstHeading = instructions.match(/^#\\s+(.+)$/m)?.[1] ?? parsed.pathname.split('/').filter(Boolean)[1];
      const skill: AgentSkill = {
        id: uid(), name: firstHeading, sourceUrl: url.trim(),
        description: `Installed from GitHub · ${instructions.length.toLocaleString()} characters`,
        instructions: instructions.slice(0, 12000), installedAt: Date.now(),
      };
      onChange([skill, ...skills.filter((item) => item.sourceUrl !== skill.sourceUrl)]);
      setUrl('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not install this skill.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="Agent skills">
    <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-white/60 bg-white/85 shadow-2xl backdrop-blur-xl md:max-h-[88vh] md:rounded-2xl dark:border-white/10 dark:bg-slate-900/85">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10"><div><h2 className="font-semibold">Agent skills</h2><p className="text-xs text-slate-500">Install real skill instructions from GitHub.</p></div><button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-slate-500">Close</button></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Bundled web-dev skills ({bundled.length})</h3>
          <p className="mb-2 text-xs text-slate-500">Invoke in chat with @slug, for example @react-hooks. Toggle to disable.</p>
          <div className="max-h-[40vh] overflow-auto overscroll-contain rounded-xl border border-slate-200/70 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900"><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">Category</th><th className="px-2 py-1">Description</th><th className="px-2 py-1">On</th></tr></thead>
              <tbody>{bundled.map((skill) => {
                const on = !disabled.includes(skill.slug);
                return <tr key={skill.slug} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="px-2 py-1 font-mono">@{skill.slug}</td>
                  <td className="px-2 py-1">{skill.category}</td>
                  <td className="px-2 py-1 text-slate-500">{skill.description}</td>
                  <td className="px-1 py-1"><label className="flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-indigo-600" aria-label={`Enable ${skill.name}`} checked={on} onChange={() => onDisabledChange(on ? [...disabled, skill.slug] : disabled.filter((x) => x !== skill.slug))} /></label></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
        <h3 className="text-sm font-semibold">Installed from GitHub</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
<input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void install(); }} placeholder="https://github.com/owner/repo" aria-label="GitHub skill URL" className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={() => void install()} disabled={busy || !url.trim()} className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Installing…' : 'Install skill'}</button></div>
        {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
        <div className="space-y-2">{skills.length === 0 ? <p className="text-sm text-slate-500">No skills installed yet.</p> : skills.map((skill) => <div key={skill.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"><div className="min-w-0"><p className="font-medium">{skill.name}</p><p className="truncate text-xs text-slate-500">{skill.description}</p></div><button type="button" onClick={() => onChange(skills.filter((item) => item.id !== skill.id))} className="text-xs text-red-500">Remove</button></div>)}</div>
      </div>
    </div>
  </div>;
}

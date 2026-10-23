import type { ChatMessage } from './types';

/** A bundled skill: a markdown prompt shipped in src/skills/. */
export interface BundledSkill {
  slug: string;
  name: string;
  category: string;
  description: string;
  body: string;
}

const MD_FILES = import.meta.glob('../skills/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

/** Parse the minimal frontmatter (name, slug, category, description) plus the body. Returns null when required fields are missing. */
export function parseSkillFile(raw: string): BundledSkill | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const { slug, name, category, description } = fields;
  if (!slug || !name || !category || !description) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  return { slug, name, category, description, body: match[2].trim() };
}

export function loadBundledSkills(files: Record<string, string> = MD_FILES): BundledSkill[] {
  const skills: BundledSkill[] = [];
  for (const raw of Object.values(files)) {
    const skill = parseSkillFile(raw);
    if (skill) skills.push(skill);
  }
  return skills.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug));
}

export const BUNDLED_SKILLS: BundledSkill[] = loadBundledSkills();

export const SKILL_ENABLED_KEY = 'agent-deck:bundled-skills-disabled';

/**
 * Find invocations in a message. A skill is invoked by "@slug" at the start of the
 * message or after whitespace. Unknown or disabled slugs are ignored (so emails
 * like a@b.com never match). Repeats collapse; order of first appearance is kept.
 */
export function parseInvocations(text: string, skills: BundledSkill[]): string[] {
  const known = new Set(skills.map((s) => s.slug));
  const found: string[] = [];
  const re = /(^|\s)@([a-z0-9][a-z0-9-]*)(?=$|[\s.,;:!?)])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const slug = m[2];
    if (known.has(slug) && !found.includes(slug)) found.push(slug);
  }
  return found;
}

/** The @token the caret is currently inside, for autocomplete. Null when not typing a mention. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|\s)@([a-z0-9-]*)$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

export function filterSkills(skills: BundledSkill[], query: string, limit = 8): BundledSkill[] {
  const q = query.toLowerCase();
  const scored = skills
    .map((s) => {
      if (s.slug.startsWith(q)) return { s, rank: 0 };
      if (s.slug.includes(q) || s.name.toLowerCase().includes(q)) return { s, rank: 1 };
      return null;
    })
    .filter((x): x is { s: BundledSkill; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank || a.s.slug.localeCompare(b.s.slug));
  return scored.slice(0, limit).map((x) => x.s);
}

/** The system-prompt block for invoked skills, or '' when none. */
export function buildSkillPrompt(slugs: string[], skills: BundledSkill[]): string {
  const byslug = new Map(skills.map((s) => [s.slug, s]));
  const chosen = slugs.map((slug) => byslug.get(slug)).filter((s): s is BundledSkill => Boolean(s));
  if (chosen.length === 0) return '';
  return (
    'The user invoked the following skills for this conversation. Follow them where relevant:\n\n' +
    chosen.map((s) => `## Skill: ${s.name} (@${s.slug})\n${s.body}`).join('\n\n')
  );
}

/** Adds the skill block to the system message (creating one if needed). Returns a new array. */
export function injectSkillPrompt(history: ChatMessage[], skillPrompt: string): ChatMessage[] {
  if (!skillPrompt) return history;
  const [first, ...rest] = history;
  if (first && first.role === 'system') {
    return [{ ...first, content: `${first.content}\n\n${skillPrompt}` }, ...rest];
  }
  return [{ role: 'system', content: skillPrompt }, ...history];
}

export function loadDisabledSkills(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

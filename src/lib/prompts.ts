import { fuzzyScore } from './palette';

export interface PromptTemplate {
  id: string;
  name: string;
  body: string;
}

const VARIABLE = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;

/** Variable names in order of first appearance, e.g. "{{name}} and {{ topic }}" gives ['name', 'topic']. */
export function extractVariables(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(VARIABLE)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/** Replaces each {{name}} with its value. Variables without a value are left as written. */
export function fillVariables(text: string, values: Record<string, string>): string {
  return text.replace(VARIABLE, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole,
  );
}

/**
 * Recognises the /prompt command. Returns the text typed after it (possibly empty),
 * or null when the draft is not a /prompt command.
 */
export function promptCommand(draft: string): { query: string } | null {
  const m = /^\/prompt(?:\s+([\s\S]*))?$/i.exec(draft.trimStart());
  if (!m) return null;
  return { query: (m[1] ?? '').trim() };
}

/** Prompts matching the query by name or body, best first. */
export function filterPrompts(prompts: PromptTemplate[], query: string, limit = 8): PromptTemplate[] {
  const q = query.trim();
  if (q.length === 0) return prompts.slice(0, limit);
  return prompts
    .map((p) => ({ p, score: Math.max(fuzzyScore(q, p.name), fuzzyScore(q, p.body) - 20) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.p);
}

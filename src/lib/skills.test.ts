import { describe, expect, it } from 'vitest';
import {
  BUNDLED_SKILLS,
  activeMention,
  buildSkillPrompt,
  filterSkills,
  injectSkillPrompt,
  loadBundledSkills,
  loadDisabledSkills,
  parseInvocations,
  parseSkillFile,
  type BundledSkill,
} from './skills';

const sample: BundledSkill[] = [
  { slug: 'react-hooks', name: 'React hooks', category: 'react', description: 'd', body: 'HOOKS RULE' },
  { slug: 'sec-xss', name: 'Preventing XSS', category: 'security', description: 'd', body: 'XSS RULE' },
  { slug: 'tailwind-utilities', name: 'Tailwind', category: 'css', description: 'd', body: 'TW RULE' },
];

describe('parseSkillFile', () => {
  it('parses frontmatter and body', () => {
    const raw = '---\nname: X\nslug: x-one\ncategory: react\ndescription: does x: well\n---\n\nbody here\n';
    expect(parseSkillFile(raw)).toEqual({ slug: 'x-one', name: 'X', category: 'react', description: 'does x: well', body: 'body here' });
  });
  it('rejects missing fields, bad slugs, and no frontmatter', () => {
    expect(parseSkillFile('---\nname: X\nslug: x\n---\nb')).toBeNull();
    expect(parseSkillFile('---\nname: X\nslug: Bad Slug\ncategory: a\ndescription: d\n---\nb')).toBeNull();
    expect(parseSkillFile('just text')).toBeNull();
  });
  it('skips invalid files when loading', () => {
    const skills = loadBundledSkills({
      a: '---\nname: A\nslug: a\ncategory: c\ndescription: d\n---\nbody',
      b: 'nope',
    });
    expect(skills.map((s) => s.slug)).toEqual(['a']);
  });
});

describe('bundled catalog', () => {
  it('ships 50 unique, valid skills across the required categories', () => {
    expect(BUNDLED_SKILLS).toHaveLength(50);
    expect(new Set(BUNDLED_SKILLS.map((s) => s.slug)).size).toBe(50);
    const cats = new Set(BUNDLED_SKILLS.map((s) => s.category));
    for (const c of ['react', 'typescript', 'css', 'performance', 'accessibility', 'testing', 'security', 'node', 'devops', 'architecture']) {
      expect(cats.has(c)).toBe(true);
    }
    for (const s of BUNDLED_SKILLS) expect(s.body.length).toBeGreaterThan(20);
  });
});

describe('parseInvocations', () => {
  it('finds @slug at start or after whitespace, in order, deduped', () => {
    expect(parseInvocations('@react-hooks and @sec-xss, then @react-hooks!', sample)).toEqual(['react-hooks', 'sec-xss']);
    expect(parseInvocations('fix this\n@tailwind-utilities', sample)).toEqual(['tailwind-utilities']);
  });
  it('ignores unknown slugs and emails', () => {
    expect(parseInvocations('@nope and mail a@react-hooks.com', sample)).toEqual([]);
  });
});

describe('activeMention and filterSkills', () => {
  it('detects an open @token at the caret', () => {
    expect(activeMention('hi @re', 6)).toEqual({ start: 3, query: 're' });
    expect(activeMention('hi @', 4)).toEqual({ start: 3, query: '' });
    expect(activeMention('mail a@b', 8)).toBeNull();
    expect(activeMention('done ', 5)).toBeNull();
  });
  it('ranks prefix matches first', () => {
    expect(filterSkills(sample, 'sec').map((s) => s.slug)).toEqual(['sec-xss']);
    expect(filterSkills(sample, 't').map((s) => s.slug)[0]).toBe('tailwind-utilities');
  });
});

describe('injection', () => {
  it('stacks multiple skills into one block', () => {
    const block = buildSkillPrompt(['react-hooks', 'sec-xss'], sample);
    expect(block).toContain('HOOKS RULE');
    expect(block).toContain('XSS RULE');
    expect(block.indexOf('HOOKS')).toBeLessThan(block.indexOf('XSS'));
    expect(buildSkillPrompt([], sample)).toBe('');
  });
  it('appends to an existing system message', () => {
    const out = injectSkillPrompt([{ role: 'system', content: 'base' }, { role: 'user', content: 'hi' }], 'SKILL');
    expect(out[0]).toEqual({ role: 'system', content: 'base\n\nSKILL' });
    expect(out).toHaveLength(2);
  });
  it('creates a system message when none exists, and is a no-op with no skill', () => {
    const out = injectSkillPrompt([{ role: 'user', content: 'hi' }], 'SKILL');
    expect(out[0]).toEqual({ role: 'system', content: 'SKILL' });
    const same = [{ role: 'user' as const, content: 'hi' }];
    expect(injectSkillPrompt(same, '')).toBe(same);
  });
});

describe('loadDisabledSkills', () => {
  it('tolerates bad storage', () => {
    expect(loadDisabledSkills(null)).toEqual([]);
    expect(loadDisabledSkills('{bad')).toEqual([]);
    expect(loadDisabledSkills('["a",1]')).toEqual(['a']);
  });
});

import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, buildBackup, parseBackup, restoreEntries, summarizeBackup } from './backup';

const providers = JSON.stringify([
  { id: 'p1', name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'm', apiKey: 'gsk_secret' },
  { id: 'p2', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'c', apiKey: 'sk-ant-secret' },
]);
const snapshot: Record<string, string> = {
  'agent-deck:providers': providers,
  'agent-deck:conversations': JSON.stringify([{ id: 'c1', title: 'Hi', messages: [] }]),
  'agent-deck:theme': JSON.stringify('light'),
  'agent-deck:font-size': JSON.stringify('large'),
  'unrelated:other-app': 'keep out',
};
const at = '2026-10-23T00:00:00.000Z';

describe('buildBackup', () => {
  it('includes only agent-deck keys and blanks API keys by default', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: false, exportedAt: at });
    expect(Object.keys(backup.entries)).toEqual([
      'agent-deck:conversations',
      'agent-deck:font-size',
      'agent-deck:providers',
      'agent-deck:theme',
    ]);
    expect(JSON.stringify(backup)).not.toContain('gsk_secret');
    expect(JSON.stringify(backup)).not.toContain('sk-ant-secret');
    expect(backup.includesApiKeys).toBe(false);
    expect(backup.format).toBe(BACKUP_FORMAT);
  });

  it('keeps API keys when explicitly asked', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: true, exportedAt: at });
    expect(backup.entries['agent-deck:providers']).toBe(providers);
    expect(backup.includesApiKeys).toBe(true);
  });

  it('never leaks a key when the provider data cannot be parsed', () => {
    const broken = { 'agent-deck:providers': '{"apiKey":"gsk_leak"' };
    const backup = buildBackup(broken, { includeApiKeys: false, exportedAt: at });
    expect(backup.entries['agent-deck:providers']).toBe('[]');
  });
});

describe('parseBackup', () => {
  it('round-trips an exported backup through JSON text', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: true, exportedAt: at });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual(backup);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
  });

  it('rejects other JSON files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('not an Agent Deck backup');
  });

  it('rejects an unknown version', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 99, entries: { 'agent-deck:theme': '"dark"' } });
    expect(() => parseBackup(text)).toThrow('Unsupported backup version');
  });

  it('rejects keys outside the agent-deck namespace', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries: { 'other:key': '"x"' } });
    expect(() => parseBackup(text)).toThrow('Unexpected key');
  });

  it('rejects entries that are not valid JSON text', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries: { 'agent-deck:theme': 'dark' } });
    expect(() => parseBackup(text)).toThrow('not valid JSON');
  });

  it('rejects a backup with no data', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries: {} });
    expect(() => parseBackup(text)).toThrow('contains no data');
  });
});

describe('restoreEntries', () => {
  it('keeps the existing API key for a provider when the backup has none', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: false, exportedAt: at });
    const current = { 'agent-deck:providers': providers };
    const restored = JSON.parse(restoreEntries(backup, current)['agent-deck:providers']) as { id: string; apiKey: string }[];
    expect(restored.map((p) => [p.id, p.apiKey])).toEqual([
      ['p1', 'gsk_secret'],
      ['p2', 'sk-ant-secret'],
    ]);
  });

  it('gives an empty key to a provider that was not on this device', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: false, exportedAt: at });
    const restored = JSON.parse(restoreEntries(backup, {})['agent-deck:providers']) as { apiKey: string }[];
    expect(restored.every((p) => p.apiKey === '')).toBe(true);
  });

  it('takes keys from the file when it includes them', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: true, exportedAt: at });
    expect(restoreEntries(backup, {})['agent-deck:providers']).toBe(providers);
  });
});

describe('summarizeBackup', () => {
  it('counts chats and providers', () => {
    const backup = buildBackup(snapshot, { includeApiKeys: false, exportedAt: at });
    expect(summarizeBackup(backup)).toEqual({ chats: 1, providers: 2, keysIncluded: false });
  });
});

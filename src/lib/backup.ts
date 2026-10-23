/**
 * Backup export and import for everything Agent Deck keeps in localStorage.
 * Entries are kept as their raw JSON text, so a restore writes back exactly what was exported.
 */
export const BACKUP_FORMAT = 'agent-deck-backup';
export const BACKUP_VERSION = 1;
/** Every key the app writes starts with this prefix (see lib/storage.ts). */
export const DATA_PREFIX = 'agent-deck:';
const PROVIDERS_KEY = 'agent-deck:providers';
const CONVERSATIONS_KEY = 'agent-deck:conversations';
const MAX_BACKUP_CHARS = 25_000_000;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  includesApiKeys: boolean;
  entries: Record<string, string>;
}

export interface BackupSummary {
  chats: number;
  providers: number;
  keysIncluded: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseList(raw: string | undefined): Record<string, unknown>[] {
  if (raw === undefined) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** Blanks every provider API key. Unparseable provider data is dropped so no key text can leak. */
function stripApiKeys(raw: string): string {
  return JSON.stringify(parseList(raw).map((provider) => ({ ...provider, apiKey: '' })));
}

/** Builds the backup from a snapshot of localStorage. Only Agent Deck keys are included. */
export function buildBackup(
  all: Record<string, string>,
  opts: { includeApiKeys: boolean; exportedAt: string },
): BackupFile {
  const entries: Record<string, string> = {};
  for (const key of Object.keys(all).sort()) {
    if (!key.startsWith(DATA_PREFIX)) continue;
    const value = all[key];
    entries[key] = key === PROVIDERS_KEY && !opts.includeApiKeys ? stripApiKeys(value) : value;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: opts.exportedAt,
    includesApiKeys: opts.includeApiKeys,
    entries,
  };
}

/** Validates backup text and returns it typed. Throws an Error with a user-facing message when it is not a usable backup. */
export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_CHARS) throw new Error('This file is too large to be an Agent Deck backup.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) throw new Error('This is not an Agent Deck backup file.');
  if (data.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${String(data.version)}.`);
  if (!isRecord(data.entries)) throw new Error('The backup has no data section.');

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.entries)) {
    if (!key.startsWith(DATA_PREFIX)) throw new Error(`Unexpected key in backup: ${key}`);
    if (typeof value !== 'string') throw new Error(`Entry ${key} is not text.`);
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Entry ${key} is not valid JSON.`);
    }
    entries[key] = value;
  }
  if (Object.keys(entries).length === 0) throw new Error('The backup contains no data.');

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    includesApiKeys: data.includesApiKeys === true,
    entries,
  };
}

/**
 * The entries to write on import. A backup exported without keys keeps the keys already saved
 * on this device for providers with the same id, so importing never wipes them.
 */
export function restoreEntries(backup: BackupFile, current: Record<string, string>): Record<string, string> {
  const out = { ...backup.entries };
  const incoming = out[PROVIDERS_KEY];
  if (!backup.includesApiKeys && incoming !== undefined) {
    const keyById = new Map(parseList(current[PROVIDERS_KEY]).map((p) => [String(p.id), String(p.apiKey ?? '')]));
    out[PROVIDERS_KEY] = JSON.stringify(
      parseList(incoming).map((p) => ({ ...p, apiKey: keyById.get(String(p.id)) ?? '' })),
    );
  }
  return out;
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    chats: parseList(backup.entries[CONVERSATIONS_KEY]).length,
    providers: parseList(backup.entries[PROVIDERS_KEY]).length,
    keysIncluded: backup.includesApiKeys,
  };
}

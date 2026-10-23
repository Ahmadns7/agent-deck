// All persistence is localStorage on this device. API keys live inside the
// provider list and never leave the browser except in requests to that provider.
export const STORAGE_KEYS = {
  mcpConnections: 'agent-deck:mcp-connections',
  agentSkills: 'agent-deck:agent-skills',
  workspaces: 'agent-deck:workspaces',
  aiFeatures: 'agent-deck:ai-features',
  providers: 'agent-deck:providers',
  activeProvider: 'agent-deck:active-provider',
  conversations: 'agent-deck:conversations',
  theme: 'agent-deck:theme',
  systemPrompt: 'agent-deck:system-prompt',
  fontSize: 'agent-deck:font-size',
} as const;

/**
 * Reads and validates a stored JSON value. Anything unreadable (storage blocked, invalid JSON,
 * or a value of the wrong shape left behind by an older build) returns the fallback instead of
 * throwing, so a corrupt entry can never white-screen the app.
 */
export function loadJSON<T>(key: string, fallback: T, isValid?: (value: unknown) => value is T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback; // storage blocked (privacy mode, disabled cookies)
  }
  if (raw === null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback; // corrupt JSON
  }
  if (isValid && !isValid(parsed)) return fallback;
  return parsed as T;
}

/** Returns true when the save landed. False when storage is full, blocked, or unavailable. */
export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceededError or storage disabled: state stays in memory for this session
    return false;
  }
}

export const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

/** Array whose items are all plain objects (not null, not arrays). Typed by the caller. */
export function isObjectArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
}

/**
 * All persistence is localStorage on this device. API keys live inside the
 * provider list and never leave the browser except in requests to that provider.
 */
export const STORAGE_KEYS = {
  mcpServers: 'agent-deck:mcp-servers',
  agentSkills: 'agent-deck:agent-skills',
  providers: 'agent-deck:providers',
  activeProvider: 'agent-deck:active-provider',
  conversations: 'agent-deck:conversations',
  theme: 'agent-deck:theme',
} as const;

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable (private mode); state stays in memory
  }
}

export type Role = 'system' | 'user' | 'assistant';

/** A message as sent to a provider. */
export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ResponseStats {
  promptTokens?: number;
  completionTokens: number;
  totalTokens?: number;
  /** Time from request start to first streamed text, in ms. */
  ttftMs?: number;
  /** Total request duration, in ms. */
  totalMs: number;
  tokensPerSecond?: number;
  /** True when token counts were estimated because the provider did not report usage. */
  estimated: boolean;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  stats?: ResponseStats;
  error?: string;
  /** Model that actually produced this reply (set when a reply finishes). */
  model?: string;
  /** Primary model that was rate-limited or rejected, when a fallback answered. */
  fellBackFrom?: string;
  /** Number of older messages dropped from the request sent to the provider. */
  trimmedCount?: number;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export type ProviderKind = 'openai' | 'anthropic';

export interface AgentSkill {
  id: string;
  name: string;
  sourceUrl: string;
  description: string;
  instructions: string;
  installedAt: number;
}

export interface McpTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  status: 'available' | 'offline';
  tools: McpTool[];
}

export interface AIFeature {
  id: string;
  name: string;
  description: string;
  category: 'Core' | 'Productivity' | 'Safety' | 'Power user';
  enabled: boolean;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  projects: WorkspaceProject[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  kind: ProviderKind;
  /** OpenAI-compatible base URL (ends in /v1) or Anthropic origin. */
  baseUrl: string;
  model: string;
  /** Stored only in localStorage on this device. */
  apiKey: string;
  /** Models tried in order when the primary returns 429/413. Undefined means the built-in defaults. */
  fallbackModels?: string[];
  /** Max estimated tokens sent per request. Undefined means the default budget. */
  contextBudget?: number;
}

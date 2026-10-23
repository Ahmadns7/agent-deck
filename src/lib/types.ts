export type Role = 'system' | 'user' | 'assistant';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image_url';
  image_url: { url: string };
}

/** OpenAI-compatible content part. Images are sent as data URLs. */
export type ContentPart = TextPart | ImagePart;

/** A message as sent to a provider. Plain string, or parts when it carries images. */
export interface ChatMessage {
  role: Role;
  content: string | ContentPart[];
}

/** A file attached in the composer. Images and text files carry content; others are unsupported. */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: 'image' | 'text' | 'unsupported';
  mime: string;
  /** data: URL for images. */
  dataUrl?: string;
  /** File text for text-ish files. */
  text?: string;
  /** Why the file was not attached, when kind is unsupported or it was too large. */
  reason?: string;
}

/** Metadata kept on the stored message (no file bytes, so localStorage stays small). */
export interface AttachmentMeta {
  name: string;
  kind: Attachment['kind'];
  size: number;
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
  /** Files attached to a user message (metadata only). */
  attachments?: AttachmentMeta[];
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
  /** Other configured providers + models tried, in order, after this provider's own models all hit a limit. */
  crossProviderFallbacks?: ModelRef[];
  /** Sampling temperature. Undefined means the provider default (not sent). */
  temperature?: number;
  /** Max output tokens. Undefined means the provider default (Anthropic 1024, others not sent). */
  maxTokens?: number;
}

/** A provider the user configured, plus one of its models. */
export interface ModelRef {
  providerId: string;
  model: string;
}

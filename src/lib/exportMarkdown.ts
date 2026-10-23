import type { Conversation, StoredMessage } from './types';

/** Turns the active reply of each message into one markdown document. Hidden messages (errors, empties) are skipped. */
export function exportMarkdown(conv: Conversation, now: Date = new Date()): string {
  const lines: string[] = [`# ${conv.title || 'Conversation'}`, '', `Exported ${now.toISOString()}`, ''];
  for (const msg of conv.messages as StoredMessage[]) {
    if (msg.error || msg.content.trim().length === 0) continue;
    const who = msg.role === 'user' ? 'You' : msg.model ? `Assistant (${msg.model})` : 'Assistant';
    lines.push(`## ${who}`, '', msg.content.trim(), '');
  }
  return lines.join('\n');
}

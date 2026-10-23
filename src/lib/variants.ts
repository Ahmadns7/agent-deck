import type { ReplyVariant, StoredMessage } from './types';

/** The reply fields of a message, captured as one variant. */
export function snapshotVariant(msg: StoredMessage): ReplyVariant {
  return {
    content: msg.content,
    model: msg.model,
    stats: msg.stats,
    error: msg.error,
    fellBackFrom: msg.fellBackFrom,
    trimmedCount: msg.trimmedCount,
  };
}

/** Writes a variant's reply fields to the message top level (the one that is shown). */
function applyVariant(msg: StoredMessage, v: ReplyVariant): StoredMessage {
  return {
    ...msg,
    content: v.content,
    model: v.model,
    stats: v.stats,
    error: v.error,
    fellBackFrom: v.fellBackFrom,
    trimmedCount: v.trimmedCount,
  };
}

/** How many replies this message holds (1 when it has never been regenerated). */
export function variantCount(msg: StoredMessage): number {
  return msg.variants && msg.variants.length > 0 ? msg.variants.length : 1;
}

/** Zero-based index of the reply currently shown. */
export function activeIndex(msg: StoredMessage): number {
  const count = variantCount(msg);
  const idx = msg.activeVariant ?? 0;
  return idx >= 0 && idx < count ? idx : 0;
}

/**
 * Adds an empty reply slot and makes it the shown one. The previous reply is kept as a
 * variant, so nothing is lost. The caller streams into the new (empty) slot.
 */
export function addVariant(msg: StoredMessage): StoredMessage {
  const variants: ReplyVariant[] = msg.variants && msg.variants.length > 0 ? [...msg.variants] : [snapshotVariant(msg)];
  variants[activeIndex(msg)] = snapshotVariant(msg);
  variants.push({ content: '' });
  const next: StoredMessage = { ...msg, variants, activeVariant: variants.length - 1 };
  return applyVariant(next, { content: '' });
}

/** Shows another reply (A/B swipe). Saves the one on screen first so edits are kept. */
export function switchVariant(msg: StoredMessage, index: number): StoredMessage {
  if (index < 0 || index >= variantCount(msg) || index === activeIndex(msg)) return msg;
  const variants: ReplyVariant[] = msg.variants && msg.variants.length > 0 ? [...msg.variants] : [snapshotVariant(msg)];
  variants[activeIndex(msg)] = snapshotVariant(msg);
  const next: StoredMessage = { ...msg, variants, activeVariant: index };
  return applyVariant(next, variants[index]);
}

import type { Conversation } from './types';
import { contentText } from './attachments';

/** Only the text and roles travel in a snapshot: no keys, providers, stats or file bytes. */
export interface SnapshotMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface SnapshotPayload {
  v: 1;
  title: string;
  messages: SnapshotMessage[];
}

export function toSnapshot(conv: Conversation): SnapshotPayload {
  return {
    v: 1,
    title: conv.title,
    messages: conv.messages
      .filter((m) => m.content && !m.error)
      .map((m) => ({ role: m.role, text: contentText(m.content) })),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4 || 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: 'deflate-raw' | 'inflate-raw'): Promise<Uint8Array> {
  const Ctor = (globalThis as unknown as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  const DecCtor = (globalThis as unknown as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!Ctor || !DecCtor) throw new Error('This browser cannot compress snapshots.');
  const transform = stream === 'deflate-raw' ? new Ctor('deflate-raw') : new DecCtor('deflate-raw');
  const writer = transform.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource);
  void writer.close();
  const buf = await new Response(transform.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/** Compresses a conversation into a URL-safe string for the #snap= hash. */
export async function encodeSnapshot(conv: Conversation): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toSnapshot(conv)));
  return toBase64Url(await pipe(json, 'deflate-raw'));
}

/** Reverses encodeSnapshot. Throws on anything that is not a valid snapshot. */
export async function decodeSnapshot(encoded: string): Promise<SnapshotPayload> {
  const bytes = await pipe(fromBase64Url(encoded), 'inflate-raw');
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SnapshotPayload>;
  if (parsed.v !== 1 || typeof parsed.title !== 'string' || !Array.isArray(parsed.messages)) {
    throw new Error('Not a valid snapshot.');
  }
  const messages = parsed.messages.filter(
    (m): m is SnapshotMessage => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string',
  );
  return { v: 1, title: parsed.title, messages };
}

/** Pulls the encoded payload out of a location hash like "#snap=abc". */
export function snapshotFromHash(hash: string): string | null {
  const m = /^#snap=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? m[1] : null;
}

export function snapshotUrl(encoded: string, origin: string, path: string): string {
  return `${origin}${path}#snap=${encoded}`;
}

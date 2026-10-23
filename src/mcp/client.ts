import type { RemoteMcpConnection, RemoteMcpTool } from './types';

/** JSON-RPC 2.0 request builder for MCP methods. */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export function buildRequest(id: number, method: string, params?: Record<string, unknown>): JsonRpcRequest {
  const req: JsonRpcRequest = { jsonrpc: '2.0', id, method };
  if (params !== undefined) req.params = params;
  return req;
}

export function buildInitialize(id: number): JsonRpcRequest {
  return buildRequest(id, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'agent-deck', version: '0.1.0' },
  });
}

export function buildToolsList(id: number): JsonRpcRequest {
  return buildRequest(id, 'tools/list', {});
}

export function buildToolsCall(id: number, name: string, args: Record<string, unknown>): JsonRpcRequest {
  return buildRequest(id, 'tools/call', { name, arguments: args });
}

/** Parse a raw JSON-RPC body (application/json) or an SSE stream (text/event-stream). */
export function parseJsonRpcBody(body: string, contentType: string): JsonRpcResponse[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (contentType.includes('text/event-stream')) {
    const messages: JsonRpcResponse[] = [];
    for (const event of trimmed.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) messages.push(parseOne(data));
    }
    return messages;
  }
  const parsed = JSON.parse(trimmed) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((item) => toResponse(item));
}

function parseOne(data: string): JsonRpcResponse {
  return toResponse(JSON.parse(data) as unknown);
}

function toResponse(value: unknown): JsonRpcResponse {
  if (!value || typeof value !== 'object' || (value as { jsonrpc?: unknown }).jsonrpc !== '2.0') {
    throw new Error('Server reply is not a JSON-RPC 2.0 message.');
  }
  return value as JsonRpcResponse;
}

/** Pick the response matching a request id and turn JSON-RPC errors into thrown errors. */
export function resultFor(messages: JsonRpcResponse[], id: number): unknown {
  const match = messages.find((m) => m.id === id);
  if (!match) throw new Error(`No reply for request ${id}.`);
  if (match.error) throw new Error(`MCP error ${match.error.code}: ${match.error.message}`);
  return match.result;
}

export function normalizeTools(result: unknown): RemoteMcpTool[] {
  const tools = (result as { tools?: unknown })?.tools;
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((t): t is { name: string; description?: unknown } => Boolean(t) && typeof (t as { name?: unknown }).name === 'string')
    .map((t) => ({ name: t.name, description: typeof t.description === 'string' ? t.description : '' }));
}

export function isHttpsOrLocal(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export interface McpPostResult {
  messages: JsonRpcResponse[];
  sessionId: string | null;
}

/** POST one JSON-RPC message to a streamable HTTP MCP endpoint from the browser. */
export async function postMcp(
  conn: Pick<RemoteMcpConnection, 'url' | 'authHeader' | 'sessionId'>,
  message: JsonRpcRequest | { jsonrpc: '2.0'; method: string; params?: Record<string, unknown> },
  fetchImpl: typeof fetch = fetch,
): Promise<McpPostResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
  };
  if (conn.sessionId) headers['Mcp-Session-Id'] = conn.sessionId;
  if (conn.authHeader) {
    const sep = conn.authHeader.indexOf(':');
    if (sep > 0) headers[conn.authHeader.slice(0, sep).trim()] = conn.authHeader.slice(sep + 1).trim();
  }
  let res: Response;
  try {
    res = await fetchImpl(conn.url, { method: 'POST', headers, body: JSON.stringify(message) });
  } catch {
    throw new Error(
      `Browser blocked the request to ${conn.url} (likely CORS: the server does not allow this origin, or it is unreachable). Remote MCP servers must send CORS headers for this app.`,
    );
  }
  if (res.status === 401 || res.status === 403) throw new Error(`${conn.url} rejected the auth header (HTTP ${res.status}).`);
  if (!res.ok) throw new Error(`${conn.url} returned HTTP ${res.status}.`);
  const sessionId = res.headers.get('Mcp-Session-Id') ?? conn.sessionId ?? null;
  const text = res.status === 202 ? '' : await res.text();
  const messages = parseJsonRpcBody(text, res.headers.get('content-type') ?? 'application/json');
  return { messages, sessionId };
}

/** Initialize, then list tools. Returns the discovered tools and the session id. */
export async function discoverTools(
  conn: Pick<RemoteMcpConnection, 'url' | 'authHeader'>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ tools: RemoteMcpTool[]; sessionId: string | null }> {
  if (!isHttpsOrLocal(conn.url)) throw new Error('Remote MCP URL must be https (or http on localhost).');
  const init = await postMcp(conn, buildInitialize(1), fetchImpl);
  resultFor(init.messages, 1);
  const sessionId = init.sessionId;
  await postMcp({ ...conn, sessionId }, { jsonrpc: '2.0', method: 'notifications/initialized' }, fetchImpl);
  const list = await postMcp({ ...conn, sessionId }, buildToolsList(2), fetchImpl);
  return { tools: normalizeTools(resultFor(list.messages, 2)), sessionId };
}

/** Call one tool on a connected server and return its text content. */
export async function callTool(
  conn: Pick<RemoteMcpConnection, 'url' | 'authHeader' | 'sessionId'>,
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await postMcp(conn, buildToolsCall(3, name, args), fetchImpl);
  const result = resultFor(res.messages, 3) as { content?: { type?: string; text?: string }[]; isError?: boolean };
  const text = (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
  if (result.isError) throw new Error(text || `${name} failed.`);
  return text;
}

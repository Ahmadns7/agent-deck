import type { RemoteMcpConnection } from './types';

export { MCP_CATALOG, MCP_CATEGORIES, type McpCatalogEntry, type McpCategory } from './catalog';
export * from './client';
export type { RemoteMcpConnection, RemoteMcpTool } from './types';

/** Connections that are switched on and have discovered tools. */
export function activeConnections(conns: RemoteMcpConnection[]): RemoteMcpConnection[] {
  return conns.filter((c) => c.enabled && c.tools.length > 0);
}

/** System-note text that tells the model which remote tools exist. Empty when none are enabled. */
export function buildToolsNote(conns: RemoteMcpConnection[]): string {
  const active = activeConnections(conns);
  if (active.length === 0) return '';
  const lines = active.map(
    (c) => `- ${c.name} (${c.url}): ${c.tools.map((t) => (t.description ? `${t.name} (${t.description})` : t.name)).join('; ')}`,
  );
  return `Tools available via remote MCP servers (the app runs them on the user's behalf when you request a call; you cannot call them directly here):\n${lines.join('\n')}`;
}

export type McpCommand = { kind: 'list' } | { kind: 'call'; tool: string; args: Record<string, unknown> } | { kind: 'error'; message: string };

/** Parses /mcp, @mcp, "/mcp call <tool> {json}" or "@mcp call ...". Returns null for normal messages. */
export function parseMcpCommand(text: string): McpCommand | null {
  const m = /^\s*[/@]mcp(?:\s+(.*))?$/is.exec(text);
  if (!m) return null;
  const rest = (m[1] ?? '').trim();
  if (!rest) return { kind: 'list' };
  const call = /^call\s+(\S+)\s*(.*)$/is.exec(rest);
  if (!call) return { kind: 'list' };
  const raw = call[2].trim();
  if (!raw) return { kind: 'call', tool: call[1], args: {} };
  try {
    const args = JSON.parse(raw) as unknown;
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('not an object');
    return { kind: 'call', tool: call[1], args: args as Record<string, unknown> };
  } catch {
    return { kind: 'error', message: 'Tool arguments must be a JSON object, e.g. /mcp call search {"query":"react"}.' };
  }
}

type CallTool = (conn: RemoteMcpConnection, name: string, args: Record<string, unknown>) => Promise<string>;

/** Runs a parsed /mcp command and returns the text to show in chat. */
export async function runMcpCommand(cmd: McpCommand, conns: RemoteMcpConnection[], call: CallTool): Promise<string> {
  if (cmd.kind === 'list') return describeConnections(conns);
  if (cmd.kind === 'error') return cmd.message;
  const owner = activeConnections(conns).find((c) => c.tools.some((t) => t.name === cmd.tool));
  if (!owner) return `No enabled connected server exposes a tool named ${cmd.tool}. Check /mcp.`;
  try {
    const text = await call(owner, cmd.tool, cmd.args);
    return `${owner.name} · ${cmd.tool}\n${text || '(empty result)'}`;
  } catch (err) {
    return `${owner.name} · ${cmd.tool} failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Plain-text summary shown in chat for /mcp. */
export function describeConnections(conns: RemoteMcpConnection[]): string {
  if (conns.length === 0) return 'No remote MCP servers connected. Add one in Tools, then Connect.';
  return conns
    .map((c) => {
      const state = !c.enabled ? 'disabled' : c.status === 'connected' ? 'connected' : c.status === 'error' ? `error: ${c.error ?? 'unknown'}` : 'not connected yet';
      const tools = c.tools.length > 0 ? c.tools.map((t) => t.name).join(', ') : 'no tools discovered';
      return `${c.name} (${state}): ${tools}`;
    })
    .join('\n');
}

import { describe, expect, it } from 'vitest';
import { MCP_CATALOG, MCP_CATEGORIES } from './catalog';
import { buildInitialize, buildRequest, buildToolsCall, buildToolsList, callTool, discoverTools, normalizeTools, parseJsonRpcBody, postMcp, resultFor } from './client';
import { buildToolsNote, describeConnections, parseMcpCommand, runMcpCommand } from './index';
import type { RemoteMcpConnection } from './types';

const conn = (over: Partial<RemoteMcpConnection> = {}): RemoteMcpConnection => ({
  id: 'c1', name: 'Demo', url: 'https://mcp.example.com/mcp', authHeader: '', enabled: true, tools: [], status: 'idle', ...over,
});

describe('MCP_CATALOG', () => {
  it('has exactly 50 unique entries with required fields', () => {
    expect(MCP_CATALOG).toHaveLength(50);
    expect(new Set(MCP_CATALOG.map((e) => e.id)).size).toBe(50);
    for (const e of MCP_CATALOG) {
      expect(e.name).toBeTruthy();
      expect(e.description.length).toBeGreaterThan(10);
      expect(['stdio', 'http']).toContain(e.transport);
      expect(typeof e.config).toBe('object');
    }
  });
  it('marks http transport only for hosted entries with a remote URL', () => {
    for (const e of MCP_CATALOG) {
      if (e.transport === 'http') expect(e.remoteUrl).toMatch(/^https:\/\//);
      else expect(e.remoteUrl).toBeUndefined();
    }
  });
  it('covers the core web-dev categories', () => {
    for (const c of ['browser', 'git', 'database', 'backend', 'hosting', 'design', 'monitoring', 'search']) {
      expect(MCP_CATEGORIES).toContain(c);
    }
  });
});

describe('json-rpc build', () => {
  it('builds a request with id and method', () => {
    expect(buildRequest(7, 'ping')).toEqual({ jsonrpc: '2.0', id: 7, method: 'ping' });
  });
  it('builds initialize, tools/list and tools/call', () => {
    expect(buildInitialize(1).params).toMatchObject({ clientInfo: { name: 'agent-deck' } });
    expect(buildToolsList(2)).toEqual({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(buildToolsCall(3, 'search', { q: 'x' })).toEqual({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search', arguments: { q: 'x' } },
    });
  });
});

describe('json-rpc parse', () => {
  it('parses a plain JSON body', () => {
    const out = parseJsonRpcBody('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}', 'application/json');
    expect(resultFor(out, 1)).toEqual({ ok: true });
  });
  it('parses an SSE stream and picks the matching id', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","id":5,"result":{"tools":[]}}\n\n';
    expect(resultFor(parseJsonRpcBody(body, 'text/event-stream; charset=utf-8'), 5)).toEqual({ tools: [] });
  });
  it('throws on JSON-RPC errors and missing ids', () => {
    const out = parseJsonRpcBody('{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"nope"}}', 'application/json');
    expect(() => resultFor(out, 1)).toThrow('MCP error -32601: nope');
    expect(() => resultFor(out, 9)).toThrow('No reply for request 9');
  });
  it('rejects non-JSON-RPC bodies', () => {
    expect(() => parseJsonRpcBody('<html>', 'text/html')).toThrow();
    expect(parseJsonRpcBody('  ', 'application/json')).toEqual([]);
  });
  it('normalizes tool lists', () => {
    expect(normalizeTools({ tools: [{ name: 'a', description: 'd' }, { name: 'b' }, { nope: 1 }] })).toEqual([
      { name: 'a', description: 'd' }, { name: 'b', description: '' },
    ]);
    expect(normalizeTools(undefined)).toEqual([]);
  });
});

describe('postMcp / discoverTools / callTool with a fake fetch', () => {
  it('sends auth header and parses a JSON reply', async () => {
    let seen: { headers: Record<string, string>; body: string } | undefined;
    const fake = (async (_url: string, init: RequestInit) => {
      seen = { headers: init.headers as Record<string, string>, body: String(init.body) };
      return new Response('{"jsonrpc":"2.0","id":1,"result":{}}', { headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 's1' } });
    }) as typeof fetch;
    const res = await postMcp({ url: 'https://x.test/mcp', authHeader: 'Authorization: Bearer t', sessionId: null }, buildInitialize(1), fake);
    expect(seen?.headers.Authorization).toBe('Bearer t');
    expect(JSON.parse(seen!.body).method).toBe('initialize');
    expect(res.sessionId).toBe('s1');
  });
  it('explains CORS failures', async () => {
    const fake = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    await expect(postMcp({ url: 'https://x.test/mcp', authHeader: '', sessionId: null }, buildToolsList(2), fake)).rejects.toThrow(/CORS/);
  });
  it('discovers tools over initialize then tools/list', async () => {
    const fake = (async (_u: string, init: RequestInit) => {
      const msg = JSON.parse(String(init.body));
      if (msg.method === 'initialize') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'abc' } });
      if (msg.method === 'notifications/initialized') return new Response('', { status: 202 });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'search', description: 'finds' }] } }), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const out = await discoverTools({ url: 'https://x.test/mcp', authHeader: '' }, fake);
    expect(out.tools).toEqual([{ name: 'search', description: 'finds' }]);
    expect(out.sessionId).toBe('abc');
  });
  it('refuses plain http to non-localhost hosts', async () => {
    await expect(discoverTools({ url: 'http://evil.test/mcp', authHeader: '' })).rejects.toThrow(/https/);
  });
  it('returns tool text content and surfaces isError', async () => {
    const ok = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'hi' }] } }), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
    expect(await callTool({ url: 'https://x.test/mcp', authHeader: '', sessionId: null }, 't', {}, ok)).toBe('hi');
    const bad = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { isError: true, content: [{ type: 'text', text: 'boom' }] } }), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
    await expect(callTool({ url: 'https://x.test/mcp', authHeader: '', sessionId: null }, 't', {}, bad)).rejects.toThrow('boom');
  });
});

describe('chat integration helpers', () => {
  it('parses /mcp and @mcp commands', () => {
    expect(parseMcpCommand('/mcp')).toEqual({ kind: 'list' });
    expect(parseMcpCommand('  @MCP ')).toEqual({ kind: 'list' });
    expect(parseMcpCommand('hello')).toBeNull();
    expect(parseMcpCommand('/mcp call search {"q":"react"}')).toEqual({ kind: 'call', tool: 'search', args: { q: 'react' } });
    expect(parseMcpCommand('/mcp call ping')).toEqual({ kind: 'call', tool: 'ping', args: {} });
    expect(parseMcpCommand('/mcp call ping [1,2]')).toMatchObject({ kind: 'error' });
  });
  it('builds the tools note only from enabled connected tools', () => {
    expect(buildToolsNote([conn()])).toBe('');
    const note = buildToolsNote([conn({ tools: [{ name: 'search', description: 'finds' }] }), conn({ id: 'x', enabled: false, tools: [{ name: 'hidden', description: '' }] })]);
    expect(note).toContain('search (finds)');
    expect(note).not.toContain('hidden');
  });
  it('describes connections for /mcp', () => {
    expect(describeConnections([])).toMatch(/No remote MCP servers/);
    expect(describeConnections([conn({ status: 'error', error: 'CORS' })])).toContain('error: CORS');
  });
  it('runs a tool call through the injected caller and reports unknown tools', async () => {
    const c = conn({ status: 'connected', tools: [{ name: 'search', description: '' }] });
    const reply = await runMcpCommand({ kind: 'call', tool: 'search', args: { q: 1 } }, [c], async (_conn, name, args) => `${name}:${JSON.stringify(args)}`);
    expect(reply).toContain('search:{"q":1}');
    expect(await runMcpCommand({ kind: 'call', tool: 'nope', args: {} }, [c], async () => '')).toMatch(/No enabled connected server/);
  });
});

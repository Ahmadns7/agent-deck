export interface RemoteMcpTool {
  name: string;
  description: string;
}

/** A user-added remote (streamable HTTP) MCP server. Browser-only: no stdio. */
export interface RemoteMcpConnection {
  id: string;
  name: string;
  url: string;
  /** Optional raw header line, e.g. "Authorization: Bearer abc". Stored locally only. */
  authHeader: string;
  enabled: boolean;
  sessionId?: string | null;
  tools: RemoteMcpTool[];
  status: 'idle' | 'connected' | 'error';
  error?: string;
}

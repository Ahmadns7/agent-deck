import type { McpServer, McpTool } from './types';

export const DEFAULT_MCP_SERVERS: McpServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    url: 'http://localhost:3001/mcp',
    status: 'available',
    tools: [
      { id: 'read-file', name: 'read_file', description: 'Read a file from an allowed workspace', enabled: true },
      { id: 'list-directory', name: 'list_directory', description: 'List files in a directory', enabled: false },
    ],
  },
  {
    id: 'web',
    name: 'Web research',
    url: 'http://localhost:3002/mcp',
    status: 'available',
    tools: [
      { id: 'search', name: 'search', description: 'Search the web for current information', enabled: true },
      { id: 'fetch', name: 'fetch', description: 'Fetch and extract a web page', enabled: false },
    ],
  },
];

export function enabledMcpTools(servers: McpServer[]): McpTool[] {
  return servers.flatMap((server) => server.tools.filter((tool) => tool.enabled));
}

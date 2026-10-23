/**
 * Bundled catalog of web-development MCP servers. Browser-only app: stdio
 * servers run on your own machine (npx / uvx) and cannot be reached from the
 * browser. Only http (streamable HTTP) entries with a remoteUrl can be
 * connected from Agent Deck, subject to CORS.
 */
export type McpCategory =
  | 'reference'
  | 'git'
  | 'database'
  | 'backend'
  | 'hosting'
  | 'browser'
  | 'design'
  | 'ui'
  | 'quality'
  | 'testing'
  | 'security'
  | 'monitoring'
  | 'project'
  | 'docs'
  | 'search'
  | 'web'
  | 'api'
  | 'payments'
  | 'email'
  | 'comms'
  | 'vector'
  | 'diagram'
  | 'sandbox'
  | 'cloud'
  | 'utility';

export interface McpCatalogEntry {
  id: string;
  name: string;
  category: McpCategory;
  transport: 'stdio' | 'http';
  description: string;
  /** The mcpServers entry a client config would hold. */
  config: Record<string, unknown>;
  /** Hosted streamable HTTP endpoint, when the vendor runs one. */
  remoteUrl?: string;
}

const npx = (pkg: string, ...args: string[]) => ({ command: 'npx', args: ['-y', pkg, ...args] });
const uvx = (pkg: string, ...args: string[]) => ({ command: 'uvx', args: [pkg, ...args] });
const remote = (url: string) => ({ type: 'http', url });
const withEnv = (base: Record<string, unknown>, env: Record<string, string>) => ({ ...base, env });

function entry(
  id: string,
  name: string,
  category: McpCategory,
  description: string,
  config: Record<string, unknown>,
): McpCatalogEntry {
  const url = typeof config.url === 'string' ? config.url : undefined;
  return {
    id,
    name,
    category,
    transport: config.type === 'http' ? 'http' : 'stdio',
    description,
    config,
    ...(url ? { remoteUrl: url } : {}),
  };
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  entry('filesystem', 'Filesystem', 'reference', 'Read, write and search files inside directories you allow.', npx('@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir')),
  entry('fetch', 'Fetch', 'web', 'Fetch any URL and convert the page to markdown for the model.', uvx('mcp-server-fetch')),
  entry('memory', 'Memory', 'reference', 'Persistent knowledge-graph memory across sessions.', npx('@modelcontextprotocol/server-memory')),
  entry('sequential-thinking', 'Sequential thinking', 'reference', 'Structured step-by-step reasoning scaffold for hard problems.', npx('@modelcontextprotocol/server-sequential-thinking')),
  entry('time', 'Time', 'utility', 'Current time and timezone conversion.', uvx('mcp-server-time')),
  entry('git', 'Git', 'git', 'Read, search, diff and commit in a local git repository.', uvx('mcp-server-git', '--repository', '/path/to/repo')),
  entry('github', 'GitHub', 'git', 'Repos, issues, pull requests, Actions and code search (hosted by GitHub).', remote('https://api.githubcopilot.com/mcp/')),
  entry('gitlab', 'GitLab', 'git', 'GitLab projects, merge requests, issues and pipelines.', withEnv(npx('@modelcontextprotocol/server-gitlab'), { GITLAB_PERSONAL_ACCESS_TOKEN: '<token>', GITLAB_API_URL: 'https://gitlab.com/api/v4' })),
  entry('postgres', 'PostgreSQL', 'database', 'Read-only SQL queries and schema inspection on PostgreSQL.', npx('@modelcontextprotocol/server-postgres', 'postgresql://user:pass@localhost:5432/db')),
  entry('sqlite', 'SQLite', 'database', 'Query and inspect a local SQLite database file.', uvx('mcp-server-sqlite', '--db-path', '/path/to/app.db')),
  entry('mysql', 'MySQL', 'database', 'Run queries and inspect tables on a MySQL database.', withEnv(npx('@benborla29/mcp-server-mysql'), { MYSQL_HOST: 'localhost', MYSQL_PORT: '3306', MYSQL_USER: '<user>', MYSQL_PASS: '<password>', MYSQL_DB: '<database>' })),
  entry('mongodb', 'MongoDB', 'database', 'Query collections and manage indexes on MongoDB.', npx('mongodb-mcp-server', '--connectionString', 'mongodb://localhost:27017')),
  entry('neon', 'Neon', 'database', 'Manage Neon Postgres projects, branches and SQL.', npx('@neondatabase/mcp-server-neon', 'start', '<NEON_API_KEY>')),
  entry('prisma', 'Prisma', 'database', 'Prisma schema, migrations and Prisma Postgres management.', npx('prisma', 'mcp')),
  entry('airtable', 'Airtable', 'database', 'Read and write Airtable bases, tables and records.', withEnv(npx('airtable-mcp-server'), { AIRTABLE_API_KEY: '<token>' })),
  entry('supabase', 'Supabase', 'backend', 'Supabase projects: tables, SQL, edge functions, logs and advisors (hosted).', remote('https://mcp.supabase.com/mcp')),
  entry('vercel', 'Vercel', 'hosting', 'Vercel projects, deployments, logs and docs search (hosted, OAuth).', remote('https://mcp.vercel.com')),
  entry('netlify', 'Netlify', 'hosting', 'Netlify sites, deploys and functions via the Netlify MCP.', npx('@netlify/mcp')),
  entry('playwright', 'Playwright', 'browser', 'Drive a real browser with accessibility snapshots for end-to-end checks.', npx('@playwright/mcp@latest')),
  entry('puppeteer', 'Puppeteer', 'browser', 'Chrome automation: navigate, click, fill forms and take screenshots.', npx('@modelcontextprotocol/server-puppeteer')),
  entry('chrome-devtools', 'Chrome DevTools', 'browser', 'DevTools access: performance traces, network and console for debugging pages.', npx('chrome-devtools-mcp@latest')),
  entry('figma', 'Figma', 'design', 'Read Figma files, frames and design tokens into code (hosted, OAuth).', remote('https://mcp.figma.com/mcp')),
  entry('figma-framelink', 'Figma (Framelink)', 'design', 'Community Figma server: layout and styling data from Figma files.', npx('figma-developer-mcp', '--figma-api-key=<key>', '--stdio')),
  entry('shadcn', 'shadcn/ui', 'ui', 'Browse, search and install shadcn/ui components into your project.', npx('shadcn@latest', 'mcp')),
  entry('eslint', 'ESLint', 'quality', 'Lint files and apply ESLint fixes from the model.', npx('@eslint/mcp@latest')),
  entry('sentry', 'Sentry', 'monitoring', 'Search errors, analyze issues and read performance data (hosted, OAuth).', remote('https://mcp.sentry.dev/mcp')),
  entry('jira', 'Jira', 'project', 'Atlassian Jira issues, boards and sprints.', withEnv(uvx('mcp-atlassian'), { JIRA_URL: 'https://<you>.atlassian.net', JIRA_USERNAME: '<email>', JIRA_API_TOKEN: '<token>' })),
  entry('notion', 'Notion', 'docs', 'Search and edit Notion pages and databases.', withEnv(npx('@notionhq/notion-mcp-server'), { OPENAPI_MCP_HEADERS: '{"Authorization":"Bearer <token>","Notion-Version":"2022-06-28"}' })),
  entry('context7', 'Context7', 'docs', 'Up-to-date library documentation and code examples pulled into context.', npx('@upstash/context7-mcp')),
  entry('markitdown', 'MarkItDown', 'docs', 'Convert PDFs, Office files and HTML into markdown.', uvx('markitdown-mcp')),
  entry('aws-docs', 'AWS documentation', 'cloud', 'Search and read official AWS documentation.', uvx('awslabs.aws-documentation-mcp-server@latest')),
  entry('brave-search', 'Brave Search', 'search', 'Web and local search through the Brave Search API.', withEnv(npx('@modelcontextprotocol/server-brave-search'), { BRAVE_API_KEY: '<key>' })),
  entry('exa', 'Exa', 'search', 'Semantic web search and page contents via Exa.', withEnv(npx('exa-mcp-server'), { EXA_API_KEY: '<key>' })),
  entry('tavily', 'Tavily', 'search', 'Search and extract web content for research tasks.', withEnv(npx('tavily-mcp'), { TAVILY_API_KEY: '<key>' })),
  entry('perplexity', 'Perplexity', 'search', 'Sourced answers and web search through Perplexity.', withEnv(npx('@perplexity-ai/mcp-server'), { PERPLEXITY_API_KEY: '<key>' })),
  entry('firecrawl', 'Firecrawl', 'web', 'Scrape, crawl and map websites into clean markdown.', withEnv(npx('firecrawl-mcp'), { FIRECRAWL_API_KEY: '<key>' })),
  entry('google-maps', 'Google Maps', 'search', 'Geocoding, places and directions.', withEnv(npx('@modelcontextprotocol/server-google-maps'), { GOOGLE_MAPS_API_KEY: '<key>' })),
  entry('openapi', 'OpenAPI', 'api', 'Turn any OpenAPI spec into callable tools for an API.', npx('@ivotoby/openapi-mcp-server', '--api-base-url', 'https://api.example.com', '--openapi-spec', './openapi.yaml')),
  entry('postman', 'Postman', 'api', 'Postman collections, environments and API requests.', withEnv(npx('@postman/postman-mcp-server'), { POSTMAN_API_KEY: '<key>' })),
  entry('stripe', 'Stripe', 'payments', 'Stripe customers, payments, products and docs.', npx('@stripe/mcp', '--tools=all', '--api-key=<key>')),
  entry('resend', 'Resend', 'email', 'Send transactional email and manage domains with Resend.', withEnv(npx('resend-mcp'), { RESEND_API_KEY: '<key>' })),
  entry('slack', 'Slack', 'comms', 'Read channels and post messages in Slack.', withEnv(npx('@modelcontextprotocol/server-slack'), { SLACK_BOT_TOKEN: '<xoxb-token>', SLACK_TEAM_ID: '<team-id>' })),
  entry('semgrep', 'Semgrep', 'security', 'Static analysis and security scans with Semgrep rules.', withEnv(uvx('semgrep-mcp'), { SEMGREP_APP_TOKEN: '<token>' })),
  entry('snyk', 'Snyk', 'security', 'Dependency and code vulnerability scans through Snyk.', withEnv(npx('snyk@latest', 'mcp', '-t', 'stdio'), { SNYK_TOKEN: '<token>' })),
  entry('mermaid', 'Mermaid', 'diagram', 'Render Mermaid diagrams (flowcharts, sequence diagrams) to images.', npx('@peng-shawn/mermaid-mcp-server')),
  entry('chroma', 'Chroma', 'vector', 'Store and query embeddings in a Chroma vector database.', uvx('chroma-mcp')),
  entry('qdrant', 'Qdrant', 'vector', 'Semantic search and storage on a Qdrant vector database.', withEnv(uvx('mcp-server-qdrant'), { QDRANT_URL: 'http://localhost:6333' })),
  entry('e2b', 'E2B sandbox', 'sandbox', 'Run code and dev servers in isolated E2B cloud sandboxes.', withEnv(npx('@e2b/mcp-server'), { E2B_API_KEY: '<key>' })),
  entry('mdn', 'MDN Web Docs', 'docs', 'Search and read MDN Web Docs for HTML, CSS and JavaScript references.', npx('mdn-mcp-server')),
  entry('everything', 'Everything (reference test server)', 'testing', 'Reference server that exercises every MCP feature, useful to test a client.', npx('@modelcontextprotocol/server-everything')),
];

export const MCP_CATEGORIES: McpCategory[] = Array.from(new Set(MCP_CATALOG.map((e) => e.category)));

import type { AIFeature } from './types';

export const DEFAULT_AI_FEATURES: AIFeature[] = [
  { id: 'memory', name: 'Conversation memory', description: 'Use recent conversation context to keep answers coherent.', category: 'Core', enabled: true },
  { id: 'citations', name: 'Source citations', description: 'Ask for links and supporting evidence when making factual claims.', category: 'Core', enabled: true },
  { id: 'structured', name: 'Structured outputs', description: 'Prefer clear tables, checklists, JSON, and predictable formats.', category: 'Core', enabled: true },
  { id: 'followups', name: 'Smart follow-ups', description: 'Suggest the next useful question or action after an answer.', category: 'Core', enabled: false },
  { id: 'summaries', name: 'Auto summaries', description: 'Keep long threads focused with compact running summaries.', category: 'Productivity', enabled: true },
  { id: 'tasks', name: 'Task extraction', description: 'Detect action items, owners, and due dates in conversations.', category: 'Productivity', enabled: false },
  { id: 'rewrite', name: 'Writing copilot', description: 'Improve clarity, tone, grammar, and audience fit on request.', category: 'Productivity', enabled: true },
  { id: 'translate', name: 'Translation', description: 'Detect languages and preserve meaning across translations.', category: 'Productivity', enabled: false },
  { id: 'code', name: 'Code reviewer', description: 'Look for bugs, security issues, and maintainability risks in code.', category: 'Power user', enabled: false },
  { id: 'debug', name: 'Debugging mode', description: 'Reason from symptoms to reproducible causes and fixes.', category: 'Power user', enabled: false },
  { id: 'planning', name: 'Project planner', description: 'Turn goals into milestones, dependencies, and acceptance criteria.', category: 'Productivity', enabled: false },
  { id: 'research', name: 'Research brief', description: 'Organize complex questions into assumptions, findings, and gaps.', category: 'Power user', enabled: false },
  { id: 'privacy', name: 'Privacy guard', description: 'Flag secrets, personal data, and risky content before sending.', category: 'Safety', enabled: true },
  { id: 'safe-code', name: 'Secure coding checks', description: 'Prefer secure defaults and call out common vulnerabilities.', category: 'Safety', enabled: true },
  { id: 'factcheck', name: 'Uncertainty checks', description: 'Separate known facts, assumptions, and confidence levels.', category: 'Safety', enabled: true },
  { id: 'concise', name: 'Concise answers', description: 'Default to direct answers with minimal unnecessary filler.', category: 'Core', enabled: true },
  { id: 'personality', name: 'Adaptive tone', description: 'Match the tone and level of detail to the user and task.', category: 'Productivity', enabled: true },
  { id: 'accessibility', name: 'Accessible content', description: 'Use plain language, headings, and screen-reader-friendly structure.', category: 'Safety', enabled: true },
  { id: 'decision', name: 'Decision support', description: 'Compare options with tradeoffs, risks, and a recommendation.', category: 'Power user', enabled: false },
  { id: 'recovery', name: 'Error recovery', description: 'Explain failures clearly and propose a safe next attempt.', category: 'Safety', enabled: true },
];

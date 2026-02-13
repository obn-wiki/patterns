/**
 * ChatContext.ts
 *
 * Client-side pattern retrieval for the AI chat sidebar.
 * Loads the pattern index (built at compile time) and matches
 * user queries to relevant patterns using keyword matching.
 */

export interface PatternEntry {
  title: string;
  category: string;
  categoryLabel: string;
  slug: string;
  status: string;
  openclawVersion: string;
  description: string;
  problemStatement: string;
  url: string;
}

let patternIndex: PatternEntry[] | null = null;

export async function loadPatternIndex(): Promise<PatternEntry[]> {
  if (patternIndex) return patternIndex;

  const response = await fetch('/pattern-index.json');
  patternIndex = await response.json();
  return patternIndex!;
}

/**
 * Find the most relevant patterns for a user query.
 * Simple keyword matching — no vector DB needed for 33 docs.
 */
export function findRelevantPatterns(query: string, patterns: PatternEntry[], topK = 5): PatternEntry[] {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !['the', 'and', 'for', 'how', 'what', 'why', 'can', 'does', 'with', 'this', 'that', 'from'].includes(t));

  const scored = patterns.map(pattern => {
    const searchText = `${pattern.title} ${pattern.category} ${pattern.categoryLabel} ${pattern.description} ${pattern.problemStatement}`.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      // Exact word match in title = high score
      if (pattern.title.toLowerCase().includes(term)) score += 10;
      // Category match
      if (pattern.category.toLowerCase() === term || pattern.categoryLabel.toLowerCase() === term) score += 8;
      // Match in description
      if (pattern.description.toLowerCase().includes(term)) score += 5;
      // Match in problem statement
      if (pattern.problemStatement.toLowerCase().includes(term)) score += 3;
      // Partial match anywhere
      if (searchText.includes(term)) score += 1;
    }

    return { pattern, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.pattern);
}

/**
 * Fetch the full markdown content of a pattern page.
 * Used to inject into the LLM prompt for grounded answers.
 */
export async function fetchPatternContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();

    // Extract the main content text (strip HTML tags)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const mainContent = doc.querySelector('.sl-markdown-content');
    return mainContent?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Build the LLM system prompt with relevant pattern context.
 */
export function buildSystemPrompt(relevantPatterns: PatternEntry[], patternContents: string[]): string {
  const patternContext = relevantPatterns
    .map((p, i) => {
      const content = patternContents[i] || p.problemStatement;
      return `### ${p.title} (${p.categoryLabel})\nURL: ${p.url}\nVersion: ${p.openclawVersion}\n\n${content.slice(0, 2000)}`;
    })
    .join('\n\n---\n\n');

  return `You are the OBN (OpenClaw Builder Network) assistant. You help operators run OpenClaw agents in production.

RULES:
- Answer questions using ONLY the pattern content provided below
- Be concise: 2-4 sentences for simple questions, up to a paragraph for complex ones
- Always reference specific patterns by name and include their URL path (e.g., "see [Pattern Name](/patterns/category/slug/)")
- If the patterns don't cover the question, say so honestly
- Never make up configuration values — only reference what's in the patterns
- Format responses in markdown

RELEVANT PATTERNS:

${patternContext}`;
}

/**
 * Call OpenRouter's streaming API.
 */
export async function* streamChat(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): AsyncGenerator<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://obn.wiki',
      'X-Title': 'OBN Wiki',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

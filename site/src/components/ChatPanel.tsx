/**
 * ChatPanel.tsx
 *
 * React island for the OBN AI chat sidebar.
 * BYOK (Bring Your Own Key) — uses the operator's OpenRouter API key.
 */

import { useState, useRef, useEffect, type FormEvent } from 'react';
import {
  loadPatternIndex,
  findRelevantPatterns,
  fetchPatternContent,
  buildSystemPrompt,
  streamChat,
} from './ChatContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('obn-openrouter-key');
    if (stored) {
      setApiKey(stored);
      setHasKey(true);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && hasKey) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasKey]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('obn-openrouter-key', apiKey.trim());
      setHasKey(true);
      setError('');
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('obn-openrouter-key');
    setApiKey('');
    setHasKey(false);
    setMessages([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Find relevant patterns
      const patterns = await loadPatternIndex();
      const relevant = findRelevantPatterns(userMessage, patterns);

      // Fetch full content of top 3 patterns
      const contents = await Promise.all(
        relevant.slice(0, 3).map(p => fetchPatternContent(p.url)),
      );

      // Build system prompt with pattern context
      const systemPrompt = buildSystemPrompt(relevant, contents);

      // Stream the response
      let assistantContent = '';
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      for await (const chunk of streamChat(apiKey, systemPrompt, newMessages)) {
        assistantContent += chunk;
        setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
      }

      if (!assistantContent) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: "I couldn't find relevant patterns for that question. Try asking about security, memory, cost optimization, or other OpenClaw operational topics." },
        ]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        setError('Invalid API key. Please check your OpenRouter key.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render markdown links in messages
  const renderContent = (content: string) => {
    // Convert markdown links [text](url) to clickable HTML
    const withLinks = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color: var(--sl-color-accent-high); text-decoration: underline;">$1</a>',
    );

    // Convert **bold** to <strong>
    const withBold = withLinks.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert `code` to <code>
    const withCode = withBold.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.1); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.85em;">$1</code>');

    return <span dangerouslySetInnerHTML={{ __html: withCode }} />;
  };

  return (
    <>
      {/* Toggle button */}
      <button
        className="obn-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open AI chat'}
        title="Ask about OpenClaw patterns"
      >
        {isOpen ? '\u2715' : '\uD83D\uDCAC'}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="obn-chat-panel">
          <div className="obn-chat-header">
            <h3>OBN Assistant</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {hasKey && (
                <button
                  onClick={clearApiKey}
                  style={{
                    fontSize: '0.75rem',
                    background: 'none',
                    border: '1px solid var(--sl-color-gray-5)',
                    borderRadius: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    cursor: 'pointer',
                    color: 'var(--sl-color-text)',
                  }}
                >
                  Change Key
                </button>
              )}
              <button className="obn-chat-close" onClick={() => setIsOpen(false)}>
                {'\u2715'}
              </button>
            </div>
          </div>

          {!hasKey ? (
            <div className="obn-api-key-setup">
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <strong>Enter your OpenRouter API key</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--sl-color-gray-3)', marginBottom: '1rem' }}>
                Your key stays in your browser (localStorage). It&apos;s never sent to our servers.
                {' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sl-color-accent-high)' }}>
                  Get a key
                </a>
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-or-..."
                onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              />
              <button onClick={saveApiKey}>Save Key</button>
            </div>
          ) : (
            <>
              <div className="obn-chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--sl-color-gray-3)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
                    <p style={{ marginBottom: '1rem' }}>Ask me about running OpenClaw in production.</p>
                    <p style={{ fontSize: '0.8rem' }}>Try:</p>
                    <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.8rem' }}>
                      <li style={{ margin: '0.3rem 0' }}>&ldquo;How do I prevent prompt injection?&rdquo;</li>
                      <li style={{ margin: '0.3rem 0' }}>&ldquo;My agent loses context after compaction&rdquo;</li>
                      <li style={{ margin: '0.3rem 0' }}>&ldquo;How can I reduce my API costs?&rdquo;</li>
                    </ul>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`obn-chat-message ${msg.role}`}>
                    {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="obn-chat-message assistant" style={{ opacity: 0.6 }}>
                    Searching patterns...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                  {error}
                </div>
              )}

              <form className="obn-chat-input-area" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  className="obn-chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about OpenClaw patterns..."
                  disabled={isLoading}
                />
                <button className="obn-chat-send" type="submit" disabled={isLoading || !input.trim()}>
                  {isLoading ? '...' : 'Send'}
                </button>
              </form>

              <div style={{ padding: '0.25rem 1rem 0.5rem', fontSize: '0.7rem', color: 'var(--sl-color-gray-3)', textAlign: 'center' }}>
                Powered by OpenRouter &middot; Answers grounded in OBN patterns
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

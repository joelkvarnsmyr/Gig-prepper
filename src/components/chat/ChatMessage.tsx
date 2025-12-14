'use client';

import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  toolsUsed?: string[];
  attachments?: Array<{
    type: 'image' | 'pdf';
    filename: string;
  }>;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  toolsUsed,
  attachments,
}: ChatMessageProps) {
  const [expanded, setExpanded] = useState(false);

  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  // Format content with basic markdown-like rendering
  const formatContent = (text: string) => {
    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        // Code block
        const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return (
          <pre
            key={i}
            className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm my-2 font-mono"
          >
            {code}
          </pre>
        );
      }

      // Regular text with bold and inline code
      return (
        <span key={i}>
          {part.split('\n').map((line, j) => (
            <span key={j}>
              {line.split(/(\*\*.*?\*\*|`.*?`)/g).map((segment, k) => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                  return (
                    <strong key={k}>{segment.slice(2, -2)}</strong>
                  );
                }
                if (segment.startsWith('`') && segment.endsWith('`')) {
                  return (
                    <code
                      key={k}
                      className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-emerald-400"
                    >
                      {segment.slice(1, -1)}
                    </code>
                  );
                }
                return segment;
              })}
              {j < part.split('\n').length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-emerald-600 text-white'
            : isAssistant
            ? 'bg-gray-800 text-gray-100'
            : 'bg-gray-700 text-gray-300'
        }`}
      >
        {/* Role indicator */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-medium ${
              isUser ? 'text-emerald-200' : 'text-gray-400'
            }`}
          >
            {isUser ? 'Du' : 'Gig-Prepper AI'}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500">
              {timestamp.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                  isUser ? 'bg-emerald-700' : 'bg-gray-700'
                }`}
              >
                <span>{att.type === 'pdf' ? '📄' : '🖼️'}</span>
                <span>{att.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {formatContent(content)}
        </div>

        {/* Tools used */}
        {toolsUsed && toolsUsed.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
            >
              <span>🔧 Verktyg använda: {toolsUsed.length}</span>
              <span>{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
              <div className="mt-1 flex flex-wrap gap-1">
                {toolsUsed.map((tool, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-gray-700 rounded text-emerald-400"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

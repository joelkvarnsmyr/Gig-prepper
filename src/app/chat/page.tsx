'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  attachments?: Array<{ type: 'image' | 'pdf'; filename: string }>;
}

interface Attachment {
  type: 'image' | 'pdf';
  filename: string;
  mimeType: string;
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMix, setHasCurrentMix] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hej! Jag är Gig-Prepper AI, din ljudtekniker-assistent. 🎛️

Jag kan hjälpa dig med:
• **Analysera riders** - skicka en PDF eller skärmdump
• **Bygga mixkonfigurationer** - beskriv din setup
• **Generera konsolfiler** - Yamaha CSV för import
• **Ge ljudtekniska råd** - EQ, dynamik, effekter

**Börja gärna med att berätta:**
1. Vilken konsol har du? (t.ex. QL1, CL5, TF3)
2. Använder du stagebox? (t.ex. Tio1608)
3. Vad är det för typ av spelning/genre?

Eller ladda upp en rider så analyserar jag den! 📄`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length]);

  const handleSend = useCallback(
    async (message: string, attachments?: Attachment[]) => {
      setError(null);

      // Add user message to UI
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        attachments: attachments?.map((a) => ({
          type: a.type,
          filename: a.filename,
        })),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            sessionId,
            attachments: attachments?.map((a) => ({
              type: a.type,
              filename: a.filename,
              mimeType: a.mimeType,
              content: a.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();

        // Update session ID
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Update mix status
        if (data.hasCurrentMix !== undefined) {
          setHasCurrentMix(data.hasCurrentMix);
        }

        // Add assistant response
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          toolsUsed: data.toolsUsed,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');

        // Add error message
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `⚠️ Fel: ${err instanceof Error ? err.message : 'Något gick fel'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  const handleDownload = async () => {
    if (!sessionId || !hasCurrentMix) return;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          format: 'yamaha-csv',
          includeDocumentation: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate files');
      }

      const data = await response.json();

      // Convert base64 to blob and download
      const binaryString = atob(data.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/zip' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success message
      const successMessage: Message = {
        id: `download-${Date.now()}`,
        role: 'assistant',
        content: `✅ **Filer genererade!**

Nedladdningen har startat. ZIP-filen innehåller:
• ${data.csvCount} CSV-filer för import
• ${data.docCount} dokumentationsfiler

Följ instruktionerna i README.txt för import till konsolen.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download');
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setHasCurrentMix(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-lg">🎛️</span>
            </div>
            <span className="font-semibold text-white">Gig-Prepper AI</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Download button */}
            {hasCurrentMix && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Ladda ner filer
              </button>
            )}

            {/* New session button */}
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Ny session
            </button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-red-200 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              toolsUsed={msg.toolsUsed}
              attachments={msg.attachments}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                  <span className="text-gray-400 text-sm">Tänker...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder={
          isLoading
            ? 'Väntar på svar...'
            : 'Beskriv din spelning eller ladda upp en rider...'
        }
      />
    </div>
  );
}

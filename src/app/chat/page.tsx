'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { useStreamingChat, StreamingMessage } from '@/hooks/useStreamingChat';

interface Attachment {
  type: 'image' | 'pdf';
  filename: string;
  mimeType: string;
  content: string;
}

type ExportFormat = 'yamaha-csv' | 'x32-scene';

const TOOL_NAMES: Record<string, string> = {
  parse_rider: 'Analyserar rider',
  build_mix: 'Bygger mix',
  generate_files: 'Genererar filer',
  get_console_info: 'Hämtar konsolinfo',
  get_mic_recommendation: 'Rekommenderar mikrofoner',
};

export default function ChatPage() {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sessionId,
    hasCurrentMix,
    currentTool,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useStreamingChat();

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('yamaha-csv');
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Add initial greeting message if no messages
  const displayMessages: StreamingMessage[] = messages.length === 0
    ? [{
        id: 'welcome',
        role: 'assistant',
        content: `Hej! Jag är Gig-Prepper AI, din ljudtekniker-assistent.

Jag kan hjälpa dig med:
• **Analysera riders** - skicka en PDF eller skärmdump
• **Bygga mixkonfigurationer** - beskriv din setup
• **Generera konsolfiler** - Yamaha CSV eller X32/M32 scenes
• **Ge ljudtekniska råd** - EQ, dynamik, effekter

**Börja gärna med att berätta:**
1. Vilken konsol har du? (t.ex. QL1, CL5, X32, M32)
2. Använder du stagebox? (t.ex. Tio1608)
3. Vad är det för typ av spelning/genre?

Eller ladda upp en rider så analyserar jag den!`,
        timestamp: new Date(),
      }]
    : messages;

  const handleSend = useCallback(
    async (message: string, attachments?: Attachment[]) => {
      setDownloadError(null);
      await sendMessage(message, { attachments });
    },
    [sendMessage]
  );

  const handleDownload = async () => {
    if (!sessionId || !hasCurrentMix) return;

    try {
      setDownloadError(null);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          format: selectedFormat,
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

      // Download started - the browser handles the rest
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Failed to download');
    }
  };

  const handleNewSession = () => {
    clearChat();
    setDownloadError(null);
    setShowFormatMenu(false);
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
            {/* Download button with format selector */}
            {hasCurrentMix && (
              <div className="relative">
                <div className="flex items-center">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-l-lg hover:bg-emerald-500 transition-colors"
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
                    {selectedFormat === 'x32-scene' ? 'X32/M32' : 'Yamaha CSV'}
                  </button>
                  <button
                    onClick={() => setShowFormatMenu(!showFormatMenu)}
                    className="px-2 py-1.5 bg-emerald-700 text-white text-sm rounded-r-lg hover:bg-emerald-600 transition-colors border-l border-emerald-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Format dropdown */}
                {showFormatMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        setSelectedFormat('yamaha-csv');
                        setShowFormatMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 rounded-t-lg ${
                        selectedFormat === 'yamaha-csv' ? 'text-emerald-400' : 'text-gray-300'
                      }`}
                    >
                      <div className="font-medium">Yamaha CL/QL/TF</div>
                      <div className="text-xs text-gray-500">CSV-filer för USB-import</div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFormat('x32-scene');
                        setShowFormatMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 rounded-b-lg ${
                        selectedFormat === 'x32-scene' ? 'text-emerald-400' : 'text-gray-300'
                      }`}
                    >
                      <div className="font-medium">Behringer X32 / Midas M32</div>
                      <div className="text-xs text-gray-500">Scene-fil med komplett setup</div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stop streaming button */}
            {isStreaming && (
              <button
                onClick={stopStreaming}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stoppa
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
      {(error || downloadError) && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-red-200 text-sm">{error || downloadError}</span>
            <button
              onClick={() => setDownloadError(null)}
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
          {displayMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              toolsUsed={msg.toolsUsed}
              isStreaming={msg.isStreaming}
            />
          ))}

          {/* Tool execution indicator */}
          {currentTool && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-emerald-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-emerald-400 text-sm font-medium">
                    {TOOL_NAMES[currentTool] || currentTool}...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator (only when not streaming and no tool running) */}
          {isLoading && !isStreaming && !currentTool && (
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
        disabled={isLoading || isStreaming}
        placeholder={
          isStreaming
            ? 'AI:n svarar...'
            : isLoading
            ? 'Väntar på svar...'
            : 'Beskriv din spelning eller ladda upp en rider...'
        }
      />
    </div>
  );
}

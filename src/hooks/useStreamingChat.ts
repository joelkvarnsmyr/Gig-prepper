/**
 * useStreamingChat Hook
 * Handles streaming chat with the AI assistant using Server-Sent Events
 */

'use client';

import { useState, useCallback, useRef } from 'react';

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolsUsed?: string[];
}

export interface StreamingChatState {
  messages: StreamingMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  provider: string | null;
  hasCurrentMix: boolean;
  currentTool: string | null;
}

interface ToolEvent {
  name: string;
  status: 'running' | 'complete' | 'error';
  preview?: string;
  error?: string;
}

interface StreamEvent {
  type?: string;
  content?: string;
  status?: string;
  tools?: string[];
  sessionId?: string;
  toolsUsed?: string[];
  provider?: string;
  hasCurrentMix?: boolean;
  error?: string;
}

export function useStreamingChat() {
  const [state, setState] = useState<StreamingChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    sessionId: null,
    provider: null,
    hasCurrentMix: false,
    currentTool: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(
    async (
      message: string,
      options?: {
        attachments?: Array<{
          type: 'image' | 'pdf';
          filename: string;
          mimeType: string;
          content: string;
        }>;
      }
    ) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessageId = `user-${Date.now()}`;
      const userMessage: StreamingMessage = {
        id: userMessageId,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      // Add placeholder for assistant message
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: StreamingMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        isLoading: true,
        isStreaming: true,
        error: null,
        currentTool: null,
      }));

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            sessionId: state.sessionId,
            attachments: options?.attachments,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let toolsUsed: string[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          let eventType = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);

              try {
                const parsed = JSON.parse(data) as StreamEvent;

                switch (eventType || parsed.type) {
                  case 'text':
                    // Append text to the assistant message
                    setState((prev) => ({
                      ...prev,
                      messages: prev.messages.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: msg.content + (parsed.content || '') }
                          : msg
                      ),
                    }));
                    break;

                  case 'status':
                    // Update status (thinking, processing, summarizing)
                    // Could be used to show loading states
                    break;

                  case 'tool':
                    // Tool execution event
                    const toolEvent = parsed as unknown as ToolEvent;
                    if (toolEvent.status === 'running') {
                      setState((prev) => ({
                        ...prev,
                        currentTool: toolEvent.name,
                      }));
                    } else if (toolEvent.status === 'complete') {
                      toolsUsed.push(toolEvent.name);
                      setState((prev) => ({
                        ...prev,
                        currentTool: null,
                      }));
                    }
                    break;

                  case 'tools':
                    // Multiple tools being executed
                    break;

                  case 'session':
                    // Session info
                    if (parsed.provider) {
                      setState((prev) => ({
                        ...prev,
                        provider: parsed.provider || null,
                      }));
                    }
                    break;

                  case 'done':
                    // Stream complete
                    setState((prev) => ({
                      ...prev,
                      messages: prev.messages.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              isStreaming: false,
                              toolsUsed: parsed.toolsUsed || toolsUsed,
                            }
                          : msg
                      ),
                      isLoading: false,
                      isStreaming: false,
                      sessionId: parsed.sessionId || prev.sessionId,
                      provider: parsed.provider || prev.provider,
                      hasCurrentMix: parsed.hasCurrentMix || false,
                      currentTool: null,
                    }));
                    break;

                  case 'error':
                    throw new Error(parsed.error || 'Unknown streaming error');
                }

                eventType = ''; // Reset event type
              } catch (parseError) {
                // Non-JSON data, might be plain text
                if (data && !data.startsWith('{')) {
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + data }
                        : msg
                    ),
                  }));
                }
              }
            }
          }
        }

        // Ensure streaming is marked as complete
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, toolsUsed: toolsUsed.length > 0 ? toolsUsed : msg.toolsUsed }
              : msg
          ),
        }));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted, don't update error state
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          error: errorMessage,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || `Fel: ${errorMessage}`,
                  isStreaming: false,
                }
              : msg
          ),
          currentTool: null,
        }));
      }
    },
    [state.sessionId]
  );

  /**
   * Stop the current stream
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isStreaming: false,
      messages: prev.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      ),
      currentTool: null,
    }));
  }, []);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      sessionId: null,
      provider: null,
      hasCurrentMix: false,
      currentTool: null,
    });
  }, []);

  /**
   * Set session ID (for resuming sessions)
   */
  const setSessionId = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      sessionId: id,
    }));
  }, []);

  return {
    ...state,
    sendMessage,
    stopStreaming,
    clearChat,
    setSessionId,
  };
}

export default useStreamingChat;

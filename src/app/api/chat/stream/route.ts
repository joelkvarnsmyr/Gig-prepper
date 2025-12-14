/**
 * Streaming Chat API Endpoint
 * Handles streaming conversation with the Gig-Prepper AI agent using SSE
 */

import { NextRequest } from 'next/server';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableSequence } from '@langchain/core/runnables';

import { createProviderWithEnv, createHumanMessageWithAttachments } from '@/lib/ai/providers';
import { getAllTools, initializeTools } from '@/lib/ai/tools';
import { getSystemPrompt } from '@/lib/ai/prompts/system';
import {
  sessionManager,
  extractPreferencesFromMessage,
  buildContextSummary,
} from '@/lib/ai/memory';
import { getAvailableProvider, isProviderAvailable } from '@/lib/ai/config';
import { ProviderType, ChatRequest, MessageAttachment, ChatMessage } from '@/lib/ai/types';

// Initialize flag
let toolsInitialized = false;

/**
 * Ensure tools are initialized
 */
async function ensureToolsInitialized(): Promise<void> {
  if (!toolsInitialized) {
    await initializeTools();
    toolsInitialized = true;
  }
}

/**
 * Convert ChatMessage format to LangChain messages
 */
function chatMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'system':
        return new SystemMessage(msg.content);
      case 'user':
        return createHumanMessageWithAttachments(msg.content, msg.attachments);
      case 'assistant':
        return new AIMessage(msg.content);
      default:
        return new HumanMessage(msg.content);
    }
  });
}

/**
 * Create an SSE encoder
 */
function createSSEStream() {
  const encoder = new TextEncoder();

  return {
    encode(event: string, data: unknown): Uint8Array {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      return encoder.encode(payload);
    },
    encodeText(text: string): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    },
    encodeDone(data: unknown): Uint8Array {
      return encoder.encode(`event: done\ndata: ${JSON.stringify(data)}\n\n`);
    },
    encodeError(error: string): Uint8Array {
      return encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    },
  };
}

export async function POST(request: NextRequest) {
  const sse = createSSEStream();

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = (await request.json()) as ChatRequest;
        const { message, sessionId, provider: requestedProvider, attachments } = body;

        if (!message && (!attachments || attachments.length === 0)) {
          controller.enqueue(sse.encodeError('Message or attachments required'));
          controller.close();
          return;
        }

        // Determine provider
        let provider: ProviderType;
        if (requestedProvider && isProviderAvailable(requestedProvider)) {
          provider = requestedProvider;
        } else {
          provider = getAvailableProvider();
        }

        // Send session info
        controller.enqueue(
          sse.encode('session', { provider, status: 'starting' })
        );

        // Get or create session
        let session = sessionId ? sessionManager.get(sessionId) : null;

        if (!session) {
          const isSwedish = /[åäöÅÄÖ]|(?:jag|vill|ska|har|och|med|för)/i.test(message || '');
          session = sessionManager.create(provider, isSwedish ? 'sv' : 'en');
        }

        // Extract and update preferences from message
        if (message) {
          const prefUpdates = extractPreferencesFromMessage(message, session.preferences);
          if (Object.keys(prefUpdates).length > 0) {
            sessionManager.updatePreferences(session.id, prefUpdates);
          }
        }

        // Add user message to history
        sessionManager.addMessage(session.id, 'user', message || '[Bifogad fil]', { attachments });

        // Build context-aware input
        const contextSummary = buildContextSummary(session);
        let enhancedInput = message || '';

        if (contextSummary) {
          enhancedInput = `${contextSummary}\n\n${enhancedInput}`;
        }

        // Get chat history
        const chatHistory = sessionManager.getHistory(session.id, 20);

        // Ensure tools are initialized
        await ensureToolsInitialized();

        const { language = 'sv' } = session.preferences;

        // Create the LLM
        const llm = createProviderWithEnv(provider, { temperature: 0.7 });
        const tools = getAllTools();

        // Bind tools to the model (if supported)
        const modelWithTools = llm.bindTools ? llm.bindTools(tools) : llm;

        // Create the prompt template
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', getSystemPrompt(language)],
          new MessagesPlaceholder('chat_history'),
          ['human', '{input}'],
        ]);

        // Convert chat history to LangChain format
        const langChainHistory = chatMessagesToLangChain(chatHistory.slice(0, -1));

        // Build the chain
        const chain = RunnableSequence.from([
          {
            input: (params: { input: string }) => params.input,
            chat_history: () => langChainHistory,
          },
          prompt,
          modelWithTools,
        ]);

        // Track tool calls and results
        const toolsUsed: string[] = [];
        interface IntermediateStep {
          action: { tool: string; args: Record<string, unknown> };
          observation: string;
        }
        const intermediateSteps: IntermediateStep[] = [];

        // Stream the initial response
        controller.enqueue(sse.encode('status', { status: 'thinking' }));

        let fullResponse = '';

        // Try streaming if supported, fallback to invoke
        try {
          const streamResponse = await chain.stream({ input: enhancedInput });

          for await (const chunk of streamResponse) {
            // Handle different chunk types
            if (typeof chunk.content === 'string' && chunk.content) {
              fullResponse += chunk.content;
              controller.enqueue(sse.encodeText(chunk.content));
            }

            // Check for tool calls
            interface ToolCall {
              name: string;
              args: Record<string, unknown>;
            }
            const toolCalls: ToolCall[] = (chunk.tool_calls as ToolCall[]) || [];

            if (toolCalls.length > 0) {
              controller.enqueue(
                sse.encode('tools', {
                  status: 'executing',
                  tools: toolCalls.map((tc) => tc.name),
                })
              );

              // Execute tool calls
              const toolResults: string[] = [];

              for (const toolCall of toolCalls) {
                const tool = tools.find((t) => t.name === toolCall.name);
                if (tool) {
                  try {
                    controller.enqueue(
                      sse.encode('tool', { name: toolCall.name, status: 'running' })
                    );

                    const result = await tool.invoke(toolCall.args);
                    toolResults.push(`Tool ${toolCall.name}: ${result}`);
                    toolsUsed.push(toolCall.name);
                    intermediateSteps.push({
                      action: { tool: toolCall.name, args: toolCall.args },
                      observation: result,
                    });

                    controller.enqueue(
                      sse.encode('tool', {
                        name: toolCall.name,
                        status: 'complete',
                        preview: result.substring(0, 200),
                      })
                    );
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    toolResults.push(`Tool ${toolCall.name} failed: ${errorMsg}`);
                    controller.enqueue(
                      sse.encode('tool', {
                        name: toolCall.name,
                        status: 'error',
                        error: errorMsg,
                      })
                    );
                  }
                }
              }

              // Get final response with tool results
              if (toolResults.length > 0) {
                controller.enqueue(sse.encode('status', { status: 'summarizing' }));

                const followUpMessages = [
                  new SystemMessage(getSystemPrompt(language)),
                  ...langChainHistory,
                  new HumanMessage(enhancedInput),
                  new AIMessage({
                    content: '',
                    tool_calls: toolCalls.map((tc) => ({
                      id: tc.name,
                      name: tc.name,
                      args: tc.args,
                    })),
                  }),
                  new HumanMessage(
                    `Verktygsresultat:\n${toolResults.join('\n\n')}\n\nSammanfatta resultatet för användaren på ett hjälpsamt sätt.`
                  ),
                ];

                // Stream the final response
                const finalStream = await llm.stream(followUpMessages);
                fullResponse = ''; // Reset for final response

                for await (const finalChunk of finalStream) {
                  if (typeof finalChunk.content === 'string' && finalChunk.content) {
                    fullResponse += finalChunk.content;
                    controller.enqueue(sse.encodeText(finalChunk.content));
                  }
                }
              }
            }
          }
        } catch {
          // Fallback to non-streaming if streaming not supported
          controller.enqueue(sse.encode('status', { status: 'processing' }));

          const response = await chain.invoke({ input: enhancedInput });

          interface ToolCall {
            name: string;
            args: Record<string, unknown>;
          }
          const toolCalls: ToolCall[] = (response.tool_calls as ToolCall[]) || [];

          if (toolCalls.length > 0) {
            const toolResults: string[] = [];

            for (const toolCall of toolCalls) {
              const tool = tools.find((t) => t.name === toolCall.name);
              if (tool) {
                try {
                  const result = await tool.invoke(toolCall.args);
                  toolResults.push(`Tool ${toolCall.name}: ${result}`);
                  toolsUsed.push(toolCall.name);
                  intermediateSteps.push({
                    action: { tool: toolCall.name, args: toolCall.args },
                    observation: result,
                  });
                } catch (error) {
                  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                  toolResults.push(`Tool ${toolCall.name} failed: ${errorMsg}`);
                }
              }
            }

            // Get final response with tool results
            const followUpMessages = [
              new SystemMessage(getSystemPrompt(language)),
              ...langChainHistory,
              new HumanMessage(enhancedInput),
              new AIMessage({
                content: '',
                tool_calls: toolCalls.map((tc) => ({
                  id: tc.name,
                  name: tc.name,
                  args: tc.args,
                })),
              }),
              new HumanMessage(
                `Verktygsresultat:\n${toolResults.join('\n\n')}\n\nSammanfatta resultatet för användaren på ett hjälpsamt sätt.`
              ),
            ];

            const finalResponse = await llm.invoke(followUpMessages);
            fullResponse =
              typeof finalResponse.content === 'string'
                ? finalResponse.content
                : JSON.stringify(finalResponse.content);
          } else {
            fullResponse =
              typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);
          }

          // Send the full response at once
          controller.enqueue(sse.encodeText(fullResponse));
        }

        // Add assistant response to history
        sessionManager.addMessage(session.id, 'assistant', fullResponse, {
          toolCalls: toolsUsed.map((tool) => ({
            toolName: tool,
            input: {},
            output: '',
            duration: 0,
          })),
        });

        // Check if mix was generated and store it
        const mixGenerated = intermediateSteps.some((step) => step.action?.tool === 'build_mix');
        if (mixGenerated) {
          for (const step of intermediateSteps) {
            if (step.action?.tool === 'build_mix' && step.observation) {
              try {
                const parsed = JSON.parse(step.observation);
                if (parsed.success && parsed.mix) {
                  sessionManager.setCurrentMix(session.id, parsed.mix);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        // Send completion event
        controller.enqueue(
          sse.encodeDone({
            sessionId: session.id,
            toolsUsed: [...new Set(toolsUsed)],
            provider,
            hasCurrentMix: sessionManager.getCurrentMix(session.id) !== null,
          })
        );

        controller.close();
      } catch (error) {
        console.error('Streaming chat error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(sse.encodeError(errorMessage));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

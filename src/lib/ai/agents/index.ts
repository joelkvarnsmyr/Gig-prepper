/**
 * Gig-Prepper Agent System
 * Main orchestrator for AI-powered sound engineering assistant
 *
 * Uses direct tool calling instead of AgentExecutor for better compatibility
 */

import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableSequence } from '@langchain/core/runnables';

import { createProviderWithEnv, createHumanMessageWithAttachments } from '../providers';
import { getAllTools, initializeTools } from '../tools';
import { getSystemPrompt, RIDER_VISION_PROMPT } from '../prompts/system';
import { ProviderType, MessageAttachment, ChatMessage } from '../types';

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
 * Convert our ChatMessage format to LangChain messages
 */
export function chatMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
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
 * Run the agent with a message using tool calling
 */
export async function runAgent(
  provider: ProviderType,
  input: string,
  chatHistory: ChatMessage[] = [],
  attachments?: MessageAttachment[],
  options?: { language?: 'sv' | 'en' }
): Promise<{
  output: string;
  toolsUsed: string[];
  intermediateSteps: unknown[];
}> {
  await ensureToolsInitialized();

  const { language = 'sv' } = options || {};

  // Create the LLM with tools bound
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
  const langChainHistory = chatMessagesToLangChain(chatHistory);

  // Build the chain
  const chain = RunnableSequence.from([
    {
      input: (params: { input: string }) => params.input,
      chat_history: () => langChainHistory,
    },
    prompt,
    modelWithTools,
  ]);

  // Run the chain
  const response = await chain.invoke({ input });

  // Track tool calls and results
  const toolsUsed: string[] = [];
  const intermediateSteps: unknown[] = [];
  let finalOutput = '';

  // Check if there are tool calls
  interface ToolCall {
    name: string;
    args: Record<string, unknown>;
  }
  const toolCalls: ToolCall[] = (response.tool_calls as ToolCall[]) || [];

  if (toolCalls.length > 0) {
    // Execute tool calls
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
      new HumanMessage(input),
      new AIMessage({
        content: '',
        tool_calls: toolCalls.map((tc) => ({
          id: tc.name,
          name: tc.name,
          args: tc.args,
        })),
      }),
      new HumanMessage(`Verktygsresultat:\n${toolResults.join('\n\n')}\n\nSammanfatta resultatet för användaren på ett hjälpsamt sätt.`),
    ];

    const finalResponse = await llm.invoke(followUpMessages);
    finalOutput = typeof finalResponse.content === 'string'
      ? finalResponse.content
      : JSON.stringify(finalResponse.content);
  } else {
    // No tool calls, just return the response
    finalOutput = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  return {
    output: finalOutput,
    toolsUsed: [...new Set(toolsUsed)],
    intermediateSteps,
  };
}

/**
 * Analyze an image using vision (for riders)
 */
export async function analyzeRiderImage(
  provider: ProviderType,
  imageBase64: string,
  mimeType: string
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const llm = createProviderWithEnv(provider, { temperature: 0.3 });

    // Create message with image
    const message = createHumanMessageWithAttachments(
      RIDER_VISION_PROMPT,
      [{ type: 'image', filename: 'rider', mimeType, content: imageBase64 }]
    );

    const response = await llm.invoke([message]);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Try to parse as JSON
    try {
      // Find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return { success: true, data };
      }
    } catch {
      // Return raw response if not valid JSON
    }

    return {
      success: true,
      data: { rawResponse: content },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Simple chat without tools (for quick questions)
 */
export async function simpleChat(
  provider: ProviderType,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const llm = createProviderWithEnv(provider, options);

  const langChainMessages = chatMessagesToLangChain(messages);
  const response = await llm.invoke(langChainMessages);

  return typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);
}

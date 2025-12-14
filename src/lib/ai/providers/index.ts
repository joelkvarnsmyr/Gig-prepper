/**
 * AI Provider Abstraction Layer
 * Supports: Gemini, Grok (via OpenAI-compatible API), Claude
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

import { ProviderType, ProviderConfig, ProviderError, MessageAttachment } from '../types';
import { PROVIDER_MODELS, getApiKey, PROVIDER_CAPABILITIES } from '../config';

/**
 * Create a chat model instance for the specified provider
 */
export function createProvider(config: ProviderConfig): BaseChatModel {
  const { provider, apiKey, temperature = 0.7, maxTokens = 4096 } = config;

  switch (provider) {
    case 'gemini':
    case 'gemini-flash':
      return new ChatGoogleGenerativeAI({
        model: PROVIDER_MODELS[provider],
        apiKey,
        temperature,
        maxOutputTokens: maxTokens,
      });

    case 'grok':
      // Grok uses OpenAI-compatible API
      return new ChatOpenAI({
        model: PROVIDER_MODELS.grok,
        apiKey,
        temperature,
        maxTokens,
        configuration: {
          baseURL: 'https://api.x.ai/v1',
        },
      });

    case 'claude':
      return new ChatAnthropic({
        model: PROVIDER_MODELS.claude,
        apiKey,
        temperature,
        maxTokens,
      });

    default:
      throw new ProviderError(provider, `Unknown provider: ${provider}`);
  }
}

/**
 * Create a provider with automatic API key lookup
 */
export function createProviderWithEnv(
  provider: ProviderType,
  options?: { temperature?: number; maxTokens?: number }
): BaseChatModel {
  const apiKey = getApiKey(provider);
  return createProvider({
    provider,
    apiKey,
    ...options,
  });
}

/**
 * Create a message with optional image attachments (for vision)
 */
export function createHumanMessageWithAttachments(
  text: string,
  attachments?: MessageAttachment[]
): HumanMessage {
  if (!attachments || attachments.length === 0) {
    return new HumanMessage(text);
  }

  // Build multimodal content array
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Add text first
  if (text) {
    content.push({ type: 'text', text });
  }

  // Add images
  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${attachment.mimeType};base64,${attachment.content}`,
        },
      });
    }
  }

  return new HumanMessage({ content });
}

/**
 * Convert chat history to LangChain messages
 */
export function convertToLangChainMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; attachments?: MessageAttachment[] }>
): BaseMessage[] {
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
 * Test provider connection with a simple request
 */
export async function testProviderConnection(provider: ProviderType): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const model = createProviderWithEnv(provider, {
      temperature: 0,
      maxTokens: 10,
    });

    await model.invoke([new HumanMessage('Say "ok"')]);

    return {
      success: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get provider info
 */
export function getProviderInfo(provider: ProviderType) {
  return {
    provider,
    model: PROVIDER_MODELS[provider],
    capabilities: PROVIDER_CAPABILITIES[provider],
  };
}

// Re-export types
export type { ProviderType, ProviderConfig };

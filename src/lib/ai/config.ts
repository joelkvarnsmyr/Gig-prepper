/**
 * AI System Configuration
 * Gig-Prepper AI Sound Engineer
 */

import { ProviderType, ProviderCapabilities } from './types';

// Provider capabilities reference
export const PROVIDER_CAPABILITIES: Record<ProviderType, ProviderCapabilities> = {
  gemini: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 2097152, // 2M tokens
    costPer1MTokens: 3.5,
  },
  'gemini-flash': {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 1048576, // 1M tokens
    costPer1MTokens: 0.35,
  },
  grok: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 131072, // 128K tokens
    costPer1MTokens: 5.0,
  },
  claude: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 200000,
    costPer1MTokens: 3.0,
  },
};

// Model IDs for each provider
export const PROVIDER_MODELS: Record<ProviderType, string> = {
  gemini: 'gemini-1.5-pro',
  'gemini-flash': 'gemini-1.5-flash',
  grok: 'grok-2-vision-1212', // Latest Grok with vision
  claude: 'claude-sonnet-4-20250514',
};

// Default configuration
export interface AIConfig {
  defaultProvider: ProviderType;
  enableStreaming: boolean;
  maxIterations: number;
  timeout: number;
  fallbackChain: ProviderType[];
}

export const DEFAULT_CONFIG: AIConfig = {
  defaultProvider: 'gemini-flash', // Cost-effective default
  enableStreaming: true,
  maxIterations: 10,
  timeout: 60000, // 60 seconds
  fallbackChain: ['gemini-flash', 'gemini', 'claude'],
};

// Get config from environment
export function getConfig(): AIConfig {
  return {
    ...DEFAULT_CONFIG,
    defaultProvider: (process.env.DEFAULT_PROVIDER as ProviderType) || DEFAULT_CONFIG.defaultProvider,
    enableStreaming: process.env.ENABLE_STREAMING !== 'false',
  };
}

// Get API key for provider
export function getApiKey(provider: ProviderType): string {
  const keys: Record<ProviderType, string | undefined> = {
    gemini: process.env.GOOGLE_API_KEY,
    'gemini-flash': process.env.GOOGLE_API_KEY,
    grok: process.env.XAI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
  };

  const key = keys[provider];
  if (!key) {
    throw new Error(`API key not configured for provider: ${provider}. Set the appropriate environment variable.`);
  }
  return key;
}

// Check if provider is available (has API key)
export function isProviderAvailable(provider: ProviderType): boolean {
  try {
    getApiKey(provider);
    return true;
  } catch {
    return false;
  }
}

// Get first available provider from fallback chain
export function getAvailableProvider(): ProviderType {
  const config = getConfig();

  for (const provider of config.fallbackChain) {
    if (isProviderAvailable(provider)) {
      return provider;
    }
  }

  throw new Error('No AI provider configured. Please set GOOGLE_API_KEY, XAI_API_KEY, or ANTHROPIC_API_KEY.');
}

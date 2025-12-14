/**
 * AI System Type Definitions
 * Gig-Prepper AI Sound Engineer
 */

// Provider types
export type ProviderType = 'gemini' | 'gemini-flash' | 'grok' | 'claude';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderCapabilities {
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  contextWindow: number;
  costPer1MTokens: number; // USD
}

// Session types
export interface GigPrepperSession {
  id: string;
  createdAt: Date;
  provider: ProviderType;

  // Current work state
  currentMix: unknown | null; // UniversalMix
  uploadedFiles: UploadedFile[];

  // Conversation history
  messages: ChatMessage[];

  // User preferences learned during conversation
  preferences: UserPreferences;
}

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  content: string; // Base64 encoded
  parsed: boolean;
  uploadedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  // For assistant messages
  toolCalls?: ToolCall[];

  // For user messages with attachments
  attachments?: MessageAttachment[];
}

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  duration: number; // ms
}

export interface MessageAttachment {
  type: 'image' | 'pdf';
  filename: string;
  mimeType: string;
  content: string; // Base64
}

export interface UserPreferences {
  console?: {
    manufacturer: string;
    model: string;
  };
  stagebox?: {
    model: string;
    slot: number;
  };
  defaultGenre?: string;
  language: 'sv' | 'en';
}

// API types
export interface ChatRequest {
  message: string;
  sessionId?: string;
  provider?: ProviderType;
  attachments?: MessageAttachment[];
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  toolsUsed?: string[];
  generatedFiles?: GeneratedFile[];
}

export interface GeneratedFile {
  name: string;
  type: 'csv' | 'md' | 'json';
  content: string;
  size: number;
}

// Error types
export class GigPrepperError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'GigPrepperError';
  }
}

export class ProviderError extends GigPrepperError {
  constructor(
    provider: string,
    message: string,
    public statusCode?: number
  ) {
    super(
      `${provider} error: ${message}`,
      'PROVIDER_ERROR',
      statusCode !== 401 && statusCode !== 403
    );
  }
}

export class RiderParseError extends GigPrepperError {
  constructor(message: string) {
    super(message, 'RIDER_PARSE_ERROR', true);
  }
}

export class ValidationError extends GigPrepperError {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message, 'VALIDATION_ERROR', true);
  }
}

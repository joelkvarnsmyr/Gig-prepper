/**
 * Chat API Endpoint
 * Handles conversation with the Gig-Prepper AI agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAgent, analyzeRiderImage } from '@/lib/ai/agents';
import {
  sessionManager,
  extractPreferencesFromMessage,
  buildContextSummary,
} from '@/lib/ai/memory';
import { getAvailableProvider, isProviderAvailable } from '@/lib/ai/config';
import { ProviderType, ChatRequest, MessageAttachment } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequest;
    const { message, sessionId, provider: requestedProvider, attachments } = body;

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message or attachments required' },
        { status: 400 }
      );
    }

    // Determine provider
    let provider: ProviderType;
    if (requestedProvider && isProviderAvailable(requestedProvider)) {
      provider = requestedProvider;
    } else {
      provider = getAvailableProvider();
    }

    // Get or create session
    let session = sessionId ? sessionManager.get(sessionId) : null;

    if (!session) {
      // Detect language from message
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

    // Handle image attachments with vision
    let imageAnalysis: string | undefined;
    if (attachments?.some((a: MessageAttachment) => a.type === 'image')) {
      const imageAttachment = attachments.find((a: MessageAttachment) => a.type === 'image')!;
      const analysis = await analyzeRiderImage(
        provider,
        imageAttachment.content,
        imageAttachment.mimeType
      );

      if (analysis.success && analysis.data) {
        imageAnalysis = JSON.stringify(analysis.data);
      }
    }

    // Build context-aware input
    const contextSummary = buildContextSummary(session);
    let enhancedInput = message || '';

    if (contextSummary) {
      enhancedInput = `${contextSummary}\n\n${enhancedInput}`;
    }

    if (imageAnalysis) {
      enhancedInput += `\n\n[Vision-analys av bild]:\n${imageAnalysis}`;
    }

    // Get chat history (limited to last 20 messages for context)
    const chatHistory = sessionManager.getHistory(session.id, 20);

    // Run the agent
    const result = await runAgent(
      provider,
      enhancedInput,
      chatHistory.slice(0, -1), // Exclude the message we just added
      attachments,
      { language: session.preferences.language }
    );

    // Add assistant response to history
    sessionManager.addMessage(session.id, 'assistant', result.output, {
      toolCalls: result.toolsUsed.map((tool) => ({
        toolName: tool,
        input: {},
        output: '',
        duration: 0,
      })),
    });

    // Check if mix was generated and store it
    const steps = (result.intermediateSteps || []) as Array<{
      action?: { tool?: string };
      observation?: string;
    }>;
    const mixGenerated = steps.some(
      (step) => step.action?.tool === 'build_mix'
    );
    if (mixGenerated) {
      // Try to extract mix from intermediate steps
      for (const step of steps) {
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

    return NextResponse.json({
      sessionId: session.id,
      message: result.output,
      toolsUsed: result.toolsUsed,
      provider,
      hasCurrentMix: sessionManager.getCurrentMix(session.id) !== null,
    });
  } catch (error) {
    console.error('Chat API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please set the appropriate API key.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Failed to process message: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - get session info
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId required' },
      { status: 400 }
    );
  }

  const session = sessionManager.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    provider: session.provider,
    messageCount: session.messages.length,
    hasCurrentMix: session.currentMix !== null,
    uploadedFiles: session.uploadedFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      parsed: f.parsed,
    })),
    preferences: session.preferences,
  });
}

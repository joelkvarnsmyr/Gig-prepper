/**
 * Session & Memory Management
 * Handles conversation state and context for Gig-Prepper
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GigPrepperSession,
  UploadedFile,
  ChatMessage,
  UserPreferences,
  ProviderType,
} from '../types';
import { UniversalMix } from '@/lib/models/universal-mix';

/**
 * Session Manager - handles all active sessions
 */
class SessionManager {
  private sessions: Map<string, GigPrepperSession> = new Map();
  private readonly maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create a new session
   */
  create(provider: ProviderType, language: 'sv' | 'en' = 'sv'): GigPrepperSession {
    const session: GigPrepperSession = {
      id: uuidv4(),
      createdAt: new Date(),
      provider,
      currentMix: null,
      uploadedFiles: [],
      messages: [],
      preferences: {
        language,
      },
    };

    this.sessions.set(session.id, session);
    this.cleanupOldSessions();

    return session;
  }

  /**
   * Get a session by ID
   */
  get(id: string): GigPrepperSession | undefined {
    const session = this.sessions.get(id);

    // Check if session is expired
    if (session) {
      const age = Date.now() - session.createdAt.getTime();
      if (age > this.maxSessionAge) {
        this.sessions.delete(id);
        return undefined;
      }
    }

    return session;
  }

  /**
   * Update session properties
   */
  update(id: string, updates: Partial<GigPrepperSession>): GigPrepperSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    Object.assign(session, updates);
    return session;
  }

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * Add a message to session history
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    extra?: {
      attachments?: ChatMessage['attachments'];
      toolCalls?: ChatMessage['toolCalls'];
    }
  ): ChatMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
      ...extra,
    };

    session.messages.push(message);
    return message;
  }

  /**
   * Get chat history for a session
   */
  getHistory(sessionId: string, maxMessages?: number): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const messages = session.messages;
    if (maxMessages && messages.length > maxMessages) {
      return messages.slice(-maxMessages);
    }

    return messages;
  }

  /**
   * Add an uploaded file to session
   */
  addUploadedFile(
    sessionId: string,
    file: Omit<UploadedFile, 'id' | 'uploadedAt' | 'parsed'>
  ): UploadedFile | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const uploadedFile: UploadedFile = {
      id: uuidv4(),
      ...file,
      parsed: false,
      uploadedAt: new Date(),
    };

    session.uploadedFiles.push(uploadedFile);
    return uploadedFile;
  }

  /**
   * Mark a file as parsed
   */
  markFileParsed(sessionId: string, fileId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const file = session.uploadedFiles.find((f) => f.id === fileId);
    if (file) {
      file.parsed = true;
    }
  }

  /**
   * Set the current mix for a session
   */
  setCurrentMix(sessionId: string, mix: UniversalMix): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentMix = mix;
    }
  }

  /**
   * Get the current mix for a session
   */
  getCurrentMix(sessionId: string): UniversalMix | null {
    const session = this.sessions.get(sessionId);
    return (session?.currentMix as UniversalMix) || null;
  }

  /**
   * Update user preferences
   */
  updatePreferences(sessionId: string, preferences: Partial<UserPreferences>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.preferences = { ...session.preferences, ...preferences };
    }
  }

  /**
   * Get all active sessions (for admin/debug)
   */
  getAllSessions(): GigPrepperSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up old sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt.getTime() > this.maxSessionAge) {
        this.sessions.delete(id);
      }
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

/**
 * Context builder - creates context summary from session
 */
export function buildContextSummary(session: GigPrepperSession): string {
  const parts: string[] = [];

  // Console info
  if (session.preferences.console) {
    parts.push(`Konsol: ${session.preferences.console.manufacturer} ${session.preferences.console.model}`);
  }

  // Stagebox info
  if (session.preferences.stagebox) {
    parts.push(`Stagebox: ${session.preferences.stagebox.model} (slot ${session.preferences.stagebox.slot})`);
  }

  // Genre
  if (session.preferences.defaultGenre) {
    parts.push(`Genre: ${session.preferences.defaultGenre}`);
  }

  // Current mix info
  if (session.currentMix) {
    const mix = session.currentMix as UniversalMix;
    parts.push(`Aktuell mix: ${mix.gig?.name || 'Unnamed'}`);
    parts.push(`Antal kanaler: ${mix.currentScene?.channels?.length || 0}`);
  }

  // Uploaded files
  if (session.uploadedFiles.length > 0) {
    const fileNames = session.uploadedFiles.map((f) => f.filename).join(', ');
    parts.push(`Uppladdade filer: ${fileNames}`);
  }

  return parts.length > 0
    ? `[Kontext]\n${parts.join('\n')}`
    : '';
}

/**
 * Extract preferences from conversation
 * This tries to learn user preferences from what they say
 */
export function extractPreferencesFromMessage(
  message: string,
  currentPrefs: UserPreferences
): Partial<UserPreferences> {
  const updates: Partial<UserPreferences> = {};

  // Console detection
  const consolePatterns: [RegExp, { manufacturer: string; model: string }][] = [
    [/QL1/i, { manufacturer: 'yamaha', model: 'ql1' }],
    [/QL5/i, { manufacturer: 'yamaha', model: 'ql5' }],
    [/CL1/i, { manufacturer: 'yamaha', model: 'cl1' }],
    [/CL3/i, { manufacturer: 'yamaha', model: 'cl3' }],
    [/CL5/i, { manufacturer: 'yamaha', model: 'cl5' }],
    [/TF1/i, { manufacturer: 'yamaha', model: 'tf1' }],
    [/TF3/i, { manufacturer: 'yamaha', model: 'tf3' }],
    [/TF5/i, { manufacturer: 'yamaha', model: 'tf5' }],
    [/X32/i, { manufacturer: 'behringer', model: 'x32' }],
    [/M32/i, { manufacturer: 'midas', model: 'm32' }],
  ];

  for (const [pattern, console] of consolePatterns) {
    if (pattern.test(message)) {
      updates.console = console;
      break;
    }
  }

  // Stagebox detection
  const stageboxPatterns: [RegExp, { model: string; slot: number }][] = [
    [/Tio1608.*slot\s*(\d)/i, { model: 'yamaha-tio1608-d', slot: 1 }],
    [/Tio1608/i, { model: 'yamaha-tio1608-d', slot: 1 }],
    [/Rio1608/i, { model: 'yamaha-rio1608-d', slot: 1 }],
    [/Rio3224/i, { model: 'yamaha-rio3224-d', slot: 1 }],
  ];

  for (const [pattern, stagebox] of stageboxPatterns) {
    const match = message.match(pattern);
    if (match) {
      const slot = match[1] ? parseInt(match[1], 10) : stagebox.slot;
      updates.stagebox = { ...stagebox, slot };
      break;
    }
  }

  // Genre detection - order matters, more specific patterns first
  const genrePatterns: [RegExp, string][] = [
    // Swedish-specific genres
    [/\b(dansband)\b/i, 'dansband'],
    [/\b(schlager)\b/i, 'schlager'],
    [/\b(visa|singer.?songwriter)\b/i, 'singer-songwriter'],
    [/\b(musikal|musical)\b/i, 'musical'],
    // Rock variants (before generic rock)
    [/\b(punk|hardcore)\b/i, 'punk'],
    [/\b(metal|hårdrock|death|black)\b/i, 'metal'],
    [/\b(indie)\b/i, 'indie'],
    [/\b(ska)\b/i, 'ska'],
    // Main genres
    [/\b(rock)\b/i, 'rock'],
    [/\b(pop)\b/i, 'pop'],
    [/\b(jazz)\b/i, 'jazz'],
    [/\b(folk|acoustic|akustisk)\b/i, 'folk'],
    [/\b(worship|lovsång|praise)\b/i, 'worship'],
    [/\b(gospel)\b/i, 'gospel'],
    [/\b(klassisk|classical|orkester)\b/i, 'classical'],
    [/\b(funk)\b/i, 'funk'],
    [/\b(r&b|rnb|soul)\b/i, 'rnb'],
    [/\b(hiphop|hip.?hop|rap)\b/i, 'hiphop'],
    [/\b(electronic|techno|house|edm)\b/i, 'electronic'],
    [/\b(country)\b/i, 'country'],
    [/\b(blues)\b/i, 'blues'],
    [/\b(reggae|dub)\b/i, 'reggae'],
    [/\b(latin|salsa|bossa)\b/i, 'latin'],
    [/\b(cinematic|filmmusik|soundtrack)\b/i, 'cinematic'],
    [/\b(teater|theater)\b/i, 'theater'],
    [/\b(konferens|corporate|företag)\b/i, 'corporate'],
    [/\b(podcast|podd)\b/i, 'podcast'],
  ];

  for (const [pattern, genre] of genrePatterns) {
    if (pattern.test(message)) {
      updates.defaultGenre = genre;
      break;
    }
  }

  return updates;
}

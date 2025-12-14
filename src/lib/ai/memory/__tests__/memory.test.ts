/**
 * Integration tests for Session & Memory Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sessionManager,
  buildContextSummary,
  extractPreferencesFromMessage,
} from '@/lib/ai/memory';
import type { GigPrepperSession, UserPreferences } from '@/lib/ai/types';

describe('SessionManager', () => {
  // Get initial session count
  let initialSessionCount: number;

  beforeEach(() => {
    initialSessionCount = sessionManager.getSessionCount();
  });

  describe('session creation', () => {
    it('should create a new session with default values', () => {
      const session = sessionManager.create('gemini');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.id.length).toBeGreaterThan(0);
      expect(session.provider).toBe('gemini');
      expect(session.messages).toEqual([]);
      expect(session.uploadedFiles).toEqual([]);
      expect(session.currentMix).toBeNull();
    });

    it('should create session with Swedish language by default', () => {
      const session = sessionManager.create('gemini');
      expect(session.preferences.language).toBe('sv');
    });

    it('should create session with specified language', () => {
      const session = sessionManager.create('gemini', 'en');
      expect(session.preferences.language).toBe('en');
    });

    it('should increment session count', () => {
      sessionManager.create('gemini');
      expect(sessionManager.getSessionCount()).toBe(initialSessionCount + 1);
    });
  });

  describe('session retrieval', () => {
    it('should retrieve an existing session', () => {
      const created = sessionManager.create('gemini');
      const retrieved = sessionManager.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', () => {
      const result = sessionManager.get('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('session update', () => {
    it('should update session properties', () => {
      const session = sessionManager.create('gemini');
      sessionManager.update(session.id, { provider: 'claude' });

      const updated = sessionManager.get(session.id);
      expect(updated?.provider).toBe('claude');
    });

    it('should return undefined when updating non-existent session', () => {
      const result = sessionManager.update('non-existent', { provider: 'claude' });
      expect(result).toBeUndefined();
    });
  });

  describe('session deletion', () => {
    it('should delete a session', () => {
      const session = sessionManager.create('gemini');
      const deleted = sessionManager.delete(session.id);

      expect(deleted).toBe(true);
      expect(sessionManager.get(session.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent session', () => {
      const deleted = sessionManager.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('message management', () => {
    it('should add a user message', () => {
      const session = sessionManager.create('gemini');
      const message = sessionManager.addMessage(session.id, 'user', 'Hello');

      expect(message).toBeDefined();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Hello');
      expect(message?.timestamp).toBeInstanceOf(Date);
    });

    it('should add an assistant message', () => {
      const session = sessionManager.create('gemini');
      const message = sessionManager.addMessage(session.id, 'assistant', 'Hi there!');

      expect(message?.role).toBe('assistant');
    });

    it('should add message with attachments', () => {
      const session = sessionManager.create('gemini');
      const message = sessionManager.addMessage(session.id, 'user', 'See attached', {
        attachments: [{ type: 'image', filename: 'test.png', mimeType: 'image/png', content: 'base64data' }],
      });

      expect(message?.attachments).toHaveLength(1);
      expect(message?.attachments?.[0].filename).toBe('test.png');
    });

    it('should add message with tool calls', () => {
      const session = sessionManager.create('gemini');
      const message = sessionManager.addMessage(session.id, 'assistant', 'Result', {
        toolCalls: [{ toolName: 'build_mix', input: {}, output: '{}', duration: 100 }],
      });

      expect(message?.toolCalls).toHaveLength(1);
      expect(message?.toolCalls?.[0].toolName).toBe('build_mix');
    });

    it('should return undefined when adding to non-existent session', () => {
      const message = sessionManager.addMessage('non-existent', 'user', 'Hello');
      expect(message).toBeUndefined();
    });
  });

  describe('message history', () => {
    it('should get full history', () => {
      const session = sessionManager.create('gemini');
      sessionManager.addMessage(session.id, 'user', 'Message 1');
      sessionManager.addMessage(session.id, 'assistant', 'Response 1');
      sessionManager.addMessage(session.id, 'user', 'Message 2');

      const history = sessionManager.getHistory(session.id);
      expect(history).toHaveLength(3);
    });

    it('should get limited history', () => {
      const session = sessionManager.create('gemini');
      for (let i = 1; i <= 10; i++) {
        sessionManager.addMessage(session.id, 'user', `Message ${i}`);
      }

      const history = sessionManager.getHistory(session.id, 5);
      expect(history).toHaveLength(5);
      expect(history[0].content).toBe('Message 6'); // Last 5 messages
    });

    it('should return empty array for non-existent session', () => {
      const history = sessionManager.getHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('file management', () => {
    it('should add an uploaded file', () => {
      const session = sessionManager.create('gemini');
      const file = sessionManager.addUploadedFile(session.id, {
        filename: 'rider.pdf',
        mimeType: 'application/pdf',
        content: 'base64content',
      });

      expect(file).toBeDefined();
      expect(file?.filename).toBe('rider.pdf');
      expect(file?.parsed).toBe(false);
    });

    it('should mark file as parsed', () => {
      const session = sessionManager.create('gemini');
      const file = sessionManager.addUploadedFile(session.id, {
        filename: 'rider.pdf',
        mimeType: 'application/pdf',
        content: 'base64content',
      });

      sessionManager.markFileParsed(session.id, file!.id);

      const updated = sessionManager.get(session.id);
      const updatedFile = updated?.uploadedFiles.find((f) => f.id === file!.id);
      expect(updatedFile?.parsed).toBe(true);
    });
  });

  describe('mix management', () => {
    it('should set current mix', () => {
      const session = sessionManager.create('gemini');
      const mix = { version: '2.0' as const, id: 'test-mix' } as any;

      sessionManager.setCurrentMix(session.id, mix);

      const retrieved = sessionManager.getCurrentMix(session.id);
      expect(retrieved).toBeDefined();
      expect((retrieved as any).id).toBe('test-mix');
    });

    it('should return null for session without mix', () => {
      const session = sessionManager.create('gemini');
      const mix = sessionManager.getCurrentMix(session.id);
      expect(mix).toBeNull();
    });
  });

  describe('preferences management', () => {
    it('should update preferences', () => {
      const session = sessionManager.create('gemini');
      sessionManager.updatePreferences(session.id, {
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const updated = sessionManager.get(session.id);
      expect(updated?.preferences.console?.model).toBe('ql1');
    });

    it('should merge preferences', () => {
      const session = sessionManager.create('gemini');
      sessionManager.updatePreferences(session.id, {
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });
      sessionManager.updatePreferences(session.id, {
        defaultGenre: 'rock',
      });

      const updated = sessionManager.get(session.id);
      expect(updated?.preferences.console?.model).toBe('ql1');
      expect(updated?.preferences.defaultGenre).toBe('rock');
    });
  });
});

describe('buildContextSummary', () => {
  it('should return empty string for session without context', () => {
    const session: GigPrepperSession = {
      id: 'test',
      createdAt: new Date(),
      provider: 'gemini',
      currentMix: null,
      uploadedFiles: [],
      messages: [],
      preferences: { language: 'sv' },
    };

    const summary = buildContextSummary(session);
    expect(summary).toBe('');
  });

  it('should include console info', () => {
    const session: GigPrepperSession = {
      id: 'test',
      createdAt: new Date(),
      provider: 'gemini',
      currentMix: null,
      uploadedFiles: [],
      messages: [],
      preferences: {
        language: 'sv',
        console: { manufacturer: 'yamaha', model: 'ql1' },
      },
    };

    const summary = buildContextSummary(session);
    expect(summary).toContain('Konsol');
    expect(summary).toContain('yamaha');
    expect(summary).toContain('ql1');
  });

  it('should include stagebox info', () => {
    const session: GigPrepperSession = {
      id: 'test',
      createdAt: new Date(),
      provider: 'gemini',
      currentMix: null,
      uploadedFiles: [],
      messages: [],
      preferences: {
        language: 'sv',
        stagebox: { model: 'tio1608', slot: 2 },
      },
    };

    const summary = buildContextSummary(session);
    expect(summary).toContain('Stagebox');
    expect(summary).toContain('tio1608');
    expect(summary).toContain('slot 2');
  });

  it('should include genre', () => {
    const session: GigPrepperSession = {
      id: 'test',
      createdAt: new Date(),
      provider: 'gemini',
      currentMix: null,
      uploadedFiles: [],
      messages: [],
      preferences: {
        language: 'sv',
        defaultGenre: 'rock',
      },
    };

    const summary = buildContextSummary(session);
    expect(summary).toContain('Genre');
    expect(summary).toContain('rock');
  });

  it('should include uploaded files', () => {
    const session: GigPrepperSession = {
      id: 'test',
      createdAt: new Date(),
      provider: 'gemini',
      currentMix: null,
      uploadedFiles: [
        { id: '1', filename: 'rider.pdf', mimeType: 'application/pdf', content: '', parsed: false, uploadedAt: new Date() },
        { id: '2', filename: 'stage.png', mimeType: 'image/png', content: '', parsed: false, uploadedAt: new Date() },
      ],
      messages: [],
      preferences: { language: 'sv' },
    };

    const summary = buildContextSummary(session);
    expect(summary).toContain('Uppladdade filer');
    expect(summary).toContain('rider.pdf');
    expect(summary).toContain('stage.png');
  });
});

describe('extractPreferencesFromMessage', () => {
  const emptyPrefs: UserPreferences = { language: 'sv' };

  describe('console detection', () => {
    it('should detect Yamaha QL1', () => {
      const prefs = extractPreferencesFromMessage('Jag kör en QL1', emptyPrefs);
      expect(prefs.console?.manufacturer).toBe('yamaha');
      expect(prefs.console?.model).toBe('ql1');
    });

    it('should detect Yamaha CL5', () => {
      const prefs = extractPreferencesFromMessage('Vi har CL5 på jobbet', emptyPrefs);
      expect(prefs.console?.model).toBe('cl5');
    });

    it('should detect Behringer X32', () => {
      const prefs = extractPreferencesFromMessage('Använder X32', emptyPrefs);
      expect(prefs.console?.manufacturer).toBe('behringer');
      expect(prefs.console?.model).toBe('x32');
    });

    it('should detect Midas M32', () => {
      const prefs = extractPreferencesFromMessage('M32 i kyrkan', emptyPrefs);
      expect(prefs.console?.manufacturer).toBe('midas');
      expect(prefs.console?.model).toBe('m32');
    });

    it('should detect TF series', () => {
      const prefs = extractPreferencesFromMessage('TF3 på liten scen', emptyPrefs);
      expect(prefs.console?.model).toBe('tf3');
    });
  });

  describe('stagebox detection', () => {
    it('should detect Tio1608', () => {
      const prefs = extractPreferencesFromMessage('Med Tio1608 på scen', emptyPrefs);
      expect(prefs.stagebox?.model).toBe('yamaha-tio1608-d');
    });

    it('should detect Tio1608 with slot number', () => {
      const prefs = extractPreferencesFromMessage('Tio1608 i slot 3', emptyPrefs);
      expect(prefs.stagebox?.model).toBe('yamaha-tio1608-d');
      expect(prefs.stagebox?.slot).toBe(3);
    });

    it('should detect Rio3224', () => {
      const prefs = extractPreferencesFromMessage('Rio3224 stagebox', emptyPrefs);
      expect(prefs.stagebox?.model).toBe('yamaha-rio3224-d');
    });
  });

  describe('genre detection', () => {
    it('should detect rock', () => {
      const prefs = extractPreferencesFromMessage('Det är ett rock band', emptyPrefs);
      expect(prefs.defaultGenre).toBe('rock');
    });

    it('should detect indie', () => {
      const prefs = extractPreferencesFromMessage('Indie kvartett', emptyPrefs);
      expect(prefs.defaultGenre).toBe('indie');
    });

    it('should detect jazz', () => {
      const prefs = extractPreferencesFromMessage('Jazz trio ikväll', emptyPrefs);
      expect(prefs.defaultGenre).toBe('jazz');
    });

    it('should detect worship', () => {
      const prefs = extractPreferencesFromMessage('Worship team i kyrkan', emptyPrefs);
      expect(prefs.defaultGenre).toBe('worship');
    });

    it('should detect lovsång as worship', () => {
      const prefs = extractPreferencesFromMessage('Spelar lovsång imorgon', emptyPrefs);
      expect(prefs.defaultGenre).toBe('worship');
    });

    it('should detect metal', () => {
      const prefs = extractPreferencesFromMessage('Hårdrock på festivalen', emptyPrefs);
      expect(prefs.defaultGenre).toBe('metal');
    });

    it('should detect folk', () => {
      const prefs = extractPreferencesFromMessage('Vi spelar folk musik', emptyPrefs);
      expect(prefs.defaultGenre).toBe('folk');
    });

    it('should detect acoustic as folk', () => {
      const prefs = extractPreferencesFromMessage('Acoustic gig på puben', emptyPrefs);
      expect(prefs.defaultGenre).toBe('folk');
    });

    it('should detect classical', () => {
      const prefs = extractPreferencesFromMessage('Klassisk konsert', emptyPrefs);
      expect(prefs.defaultGenre).toBe('classical');
    });

    it('should detect punk', () => {
      const prefs = extractPreferencesFromMessage('Punk band från Göteborg', emptyPrefs);
      expect(prefs.defaultGenre).toBe('punk');
    });

    it('should detect dansband', () => {
      const prefs = extractPreferencesFromMessage('Dansband på lördagskvällen', emptyPrefs);
      expect(prefs.defaultGenre).toBe('dansband');
    });

    it('should detect funk', () => {
      const prefs = extractPreferencesFromMessage('Funk kollektiv', emptyPrefs);
      expect(prefs.defaultGenre).toBe('funk');
    });

    it('should detect rnb/soul', () => {
      const prefs = extractPreferencesFromMessage('R&B och soul kvartett', emptyPrefs);
      expect(prefs.defaultGenre).toBe('rnb');
    });

    it('should detect ska', () => {
      const prefs = extractPreferencesFromMessage('Ska band med stor brasssektion', emptyPrefs);
      expect(prefs.defaultGenre).toBe('ska');
    });

    it('should detect schlager', () => {
      const prefs = extractPreferencesFromMessage('Schlager show på hotellet', emptyPrefs);
      expect(prefs.defaultGenre).toBe('schlager');
    });

    it('should detect electronic/EDM', () => {
      const prefs = extractPreferencesFromMessage('Electronic DJ set', emptyPrefs);
      expect(prefs.defaultGenre).toBe('electronic');
    });

    it('should detect hiphop/rap', () => {
      const prefs = extractPreferencesFromMessage('Hiphop artist på scen', emptyPrefs);
      expect(prefs.defaultGenre).toBe('hiphop');
    });
  });

  describe('multiple preferences', () => {
    it('should extract multiple preferences from one message', () => {
      const prefs = extractPreferencesFromMessage(
        'Vi har QL5 med Tio1608 och spelar rock',
        emptyPrefs
      );

      expect(prefs.console?.model).toBe('ql5');
      expect(prefs.stagebox?.model).toBe('yamaha-tio1608-d');
      expect(prefs.defaultGenre).toBe('rock');
    });
  });

  describe('no matches', () => {
    it('should return empty object when no preferences detected', () => {
      const prefs = extractPreferencesFromMessage('Hej, hur mår du?', emptyPrefs);
      expect(Object.keys(prefs)).toHaveLength(0);
    });
  });
});

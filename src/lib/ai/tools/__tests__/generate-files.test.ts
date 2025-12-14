/**
 * Tests for generate-files tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFilesTool } from '../generate-files';

// Create a complete valid UniversalMix for testing
function createTestMix(options: { channelCount?: number; name?: string } = {}) {
  const { channelCount = 3, name = 'Test Gig' } = options;

  const channels = Array.from({ length: channelCount }, (_, i) => ({
    id: `ch-${i + 1}`,
    number: i + 1,
    name: `Channel ${i + 1}`,
    shortName: `CH${i + 1}`,
    type: 'mono' as const,
    category: 'other',
    color: { name: 'White' },
    icon: 'Inst',
    input: {
      inputType: 'mic' as const,
      inputPort: `Local-${i + 1}`,
      phantomPower: 'off' as const,
      gain: 0,
      pad: false,
      source: {
        type: 'local' as const,
        port: i + 1,
        label: `Input ${i + 1}`,
      },
    },
    eq: {
      enabled: true,
      bands: [],
      highPassFilter: { enabled: true, frequency: 80, slope: 18 },
    },
    dynamics: {
      gate: { enabled: false, threshold: -40, range: 20, attack: 1, hold: 50, release: 100 },
      compressor: { enabled: false, threshold: -10, ratio: 4, attack: 10, release: 100, knee: 'soft' as const, autoMakeup: false, makeupGain: 0 },
    },
    fader: -10,
    mute: false,
    busSends: [],
    effectSends: [],
  }));

  return {
    version: '2.0' as const,
    id: 'test-mix-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gig: {
      name,
      date: '2024-06-15',
      artist: { name: 'Test Artist', genre: [] as string[] },
      venue: { name: 'Test Venue', city: '', country: '' },
    },
    console: {
      manufacturer: 'yamaha' as const,
      model: 'ql1' as const,
      inputChannelCount: 32,
      stereoInputCount: 8,
      mixBusCount: 16,
      matrixCount: 8,
      dcaCount: 8,
      effectRackCount: 8,
      localInputs: 16,
      localOutputs: 16,
      stageboxes: [],
    },
    currentScene: {
      name: 'Main',
      index: 1,
      channels,
      buses: [],
      matrices: [],
      dcas: [],
      effects: [],
    },
    presets: { channels: [], effects: [], dynamics: [] },
  };
}

describe('generateFilesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Yamaha CSV generation', () => {
    it('should generate files for yamaha-csv format', async () => {
      const mix = createTestMix({ channelCount: 5 });

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
        includeDocumentation: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('yamaha-csv');
      expect(parsed.totalFiles).toBeGreaterThan(0);
    });

    it('should include CSV files', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
        includeDocumentation: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.csvFiles).toBeGreaterThan(0);

      const csvFiles = parsed.files.filter((f: { type: string }) => f.type === 'csv');
      expect(csvFiles.length).toBeGreaterThan(0);

      // Check for expected CSV files
      const fileNames = csvFiles.map((f: { name: string }) => f.name);
      expect(fileNames).toContain('InName.csv');
    });

    it('should include documentation files when requested', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
        includeDocumentation: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.documentationFiles).toBeGreaterThan(0);

      const mdFiles = parsed.files.filter((f: { type: string }) => f.type === 'md');
      expect(mdFiles.length).toBeGreaterThan(0);
    });

    it('should exclude documentation when not requested', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
        includeDocumentation: false,
      });

      const parsed = JSON.parse(result);
      expect(parsed.documentationFiles).toBe(0);

      const mdFiles = parsed.files.filter((f: { type: string }) => f.type === 'md');
      expect(mdFiles.length).toBe(0);
    });

    it('should include import instructions for Yamaha', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      expect(parsed.instructions).toBeDefined();
      expect(parsed.instructions.length).toBeGreaterThan(0);
      expect(parsed.instructions.some((i: string) => i.includes('USB'))).toBe(true);
    });

    it('should provide file descriptions', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      const inNameFile = parsed.files.find((f: { name: string }) => f.name === 'InName.csv');

      expect(inNameFile).toBeDefined();
      expect(inNameFile.description).toBeDefined();
      expect(inNameFile.description.length).toBeGreaterThan(0);
    });
  });

  describe('X32/M32 generation', () => {
    it('should generate X32 scene file', async () => {
      const mix = createTestMix({ channelCount: 5 });

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'x32-scene',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('x32-scene');
      expect(parsed.sceneFiles).toBeGreaterThan(0);
    });

    it('should include scene file with .scn extension', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'x32-scene',
      });

      const parsed = JSON.parse(result);
      const scnFile = parsed.files.find((f: { name: string }) => f.name.endsWith('.scn'));
      expect(scnFile).toBeDefined();
      expect(scnFile.type).toBe('scn');
    });

    it('should include X32 import instructions', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'x32-scene',
      });

      const parsed = JSON.parse(result);
      expect(parsed.instructions.some((i: string) => i.includes('UTILITY'))).toBe(true);
    });
  });

  describe('unsupported formats', () => {
    it('should return error for dLive format', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'dlive-show',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('not yet implemented');
    });
  });

  describe('invalid input handling', () => {
    it('should handle missing channels', async () => {
      const invalidMix = {
        version: '2.0',
        id: 'test',
        currentScene: {},
      };

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(invalidMix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('missing currentScene.channels');
    });

    it('should handle invalid JSON input', async () => {
      const result = await generateFilesTool.invoke({
        mix: 'not valid json at all',
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    it('should handle empty mix', async () => {
      const mix = createTestMix({ channelCount: 0 });

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      // Should succeed even with 0 channels
      expect(parsed.success).toBe(true);
    });
  });

  describe('file content', () => {
    it('should include channel names in InName.csv', async () => {
      const mix = createTestMix({ channelCount: 2 });
      mix.currentScene.channels[0].name = 'Kick';
      mix.currentScene.channels[0].shortName = 'Kick';
      mix.currentScene.channels[1].name = 'Snare';
      mix.currentScene.channels[1].shortName = 'Snare';

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      const inNameFile = parsed.files.find((f: { name: string }) => f.name === 'InName.csv');

      expect(inNameFile).toBeDefined();
      expect(inNameFile.content).toContain('Kick');
      expect(inNameFile.content).toContain('Snare');
    });

    it('should include file size information', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);
      for (const file of parsed.files) {
        expect(typeof file.size).toBe('number');
        expect(file.size).toBeGreaterThan(0);
      }
    });

    it('should truncate very large file contents', async () => {
      // Create a mix with many channels to generate large files
      const mix = createTestMix({ channelCount: 50 });

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
        format: 'yamaha-csv',
      });

      const parsed = JSON.parse(result);

      // Files with over 10000 characters should be truncated
      for (const file of parsed.files) {
        if (file.content.includes('truncated')) {
          expect(file.content.length).toBeLessThanOrEqual(10050); // 10000 + truncation message
        }
      }
    });
  });

  describe('default values', () => {
    it('should default to yamaha-csv format', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
      });

      const parsed = JSON.parse(result);
      expect(parsed.format).toBe('yamaha-csv');
    });

    it('should include documentation by default', async () => {
      const mix = createTestMix();

      const result = await generateFilesTool.invoke({
        mix: JSON.stringify(mix),
      });

      const parsed = JSON.parse(result);
      expect(parsed.documentationFiles).toBeGreaterThan(0);
    });
  });
});

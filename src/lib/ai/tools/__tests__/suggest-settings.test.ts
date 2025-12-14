/**
 * Tests for suggest-settings tool
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { suggestSettingsTool } from '../suggest-settings';

describe('suggestSettingsTool', () => {
  describe('instrument categorization', () => {
    it('should categorize kick drum correctly', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'Kick',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('kick');
    });

    it('should categorize lead vocal correctly', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'Lead Vocal',
        genre: 'pop',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('lead-vocal');
    });

    it('should categorize bass correctly', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'E-Bass',
        genre: 'funk',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('bass');
    });

    it('should categorize acoustic guitar correctly', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'Akustisk gitarr',
        genre: 'folk',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('acoustic-guitar');
    });

    it('should handle Swedish instrument names', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'Sång',
        genre: 'pop',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('lead-vocal');
    });
  });

  describe('genre-specific settings', () => {
    it('should return rock-specific settings', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'snare',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.genrePhilosophy).toContain('Kraftfullt');
      expect(parsed.dynamics.gate.use).toBe(true);
    });

    it('should return jazz-specific settings (no gate)', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'snare',
        genre: 'jazz',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.genrePhilosophy).toContain('Naturligt');
      expect(parsed.dynamics.gate.use).toBe(false);
    });

    it('should return folk-specific settings', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'vocals',
        genre: 'folk',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.genrePhilosophy).toContain('Organiskt');
    });

    it('should return metal-specific settings (hard compression)', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'kick',
        genre: 'metal',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.dynamics.compressor.ratio).toContain('6:1');
    });
  });

  describe('EQ suggestions', () => {
    it('should suggest HPF for vocals', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'lead vocal',
        genre: 'pop',
      });

      const parsed = JSON.parse(result);
      expect(parsed.eq.highPassFilter).toBeDefined();
      expect(parseInt(parsed.eq.highPassFilter)).toBeGreaterThanOrEqual(80);
    });

    it('should suggest low HPF for kick', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'kick',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parseInt(parsed.eq.highPassFilter)).toBeLessThanOrEqual(40);
    });

    it('should include EQ bands with purposes', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'snare',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.eq.bands).toBeDefined();
      expect(parsed.eq.bands.length).toBeGreaterThan(0);
      expect(parsed.eq.bands[0]).toHaveProperty('freq');
      expect(parsed.eq.bands[0]).toHaveProperty('purpose');
    });
  });

  describe('dynamics suggestions', () => {
    it('should suggest compression for vocals', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'lead vocal',
        genre: 'pop',
      });

      const parsed = JSON.parse(result);
      expect(parsed.dynamics.compressor.use).toBe(true);
      expect(parsed.dynamics.compressor.ratio).toBeDefined();
    });

    it('should suggest gate for kick in rock', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'kick',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.dynamics.gate.use).toBe(true);
    });

    it('should not suggest gate for bass', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'bass',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.dynamics.gate.use).toBe(false);
    });
  });

  describe('effect suggestions', () => {
    it('should suggest reverb for vocals', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'lead vocal',
        genre: 'pop',
        includeEffects: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.effects).toBeDefined();
      expect(parsed.effects.reverb.send).not.toBe('-∞ (ingen)');
    });

    it('should not suggest reverb for kick', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'kick',
        genre: 'rock',
        includeEffects: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.effects.reverb.send).toContain('ingen');
    });

    it('should not include effects when disabled', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'vocals',
        genre: 'rock',
        includeEffects: false,
      });

      const parsed = JSON.parse(result);
      expect(parsed.effects).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle unknown instruments gracefully', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'theremin',
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.category).toBe('other');
    });

    it('should handle unknown genres gracefully', async () => {
      const result = await suggestSettingsTool.invoke({
        instrument: 'vocals',
        genre: 'unknown-genre',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });
});

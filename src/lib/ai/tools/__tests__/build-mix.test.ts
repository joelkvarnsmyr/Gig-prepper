/**
 * Tests for build-mix tool
 */

import { describe, it, expect } from 'vitest';
import { buildMixTool } from '../build-mix';

describe('buildMixTool', () => {
  const sampleChannels = [
    { number: 1, name: 'Kick', instrument: 'kick drum', microphone: 'Beta91' },
    { number: 2, name: 'Snare', instrument: 'snare', microphone: 'SM57' },
    { number: 3, name: 'Lead Vox', instrument: 'vocals', microphone: 'SM58' },
  ];

  describe('basic mix creation', () => {
    it('should create a valid UniversalMix', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test Gig',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.mix).toBeDefined();
      expect(parsed.mix.version).toBe('2.0');
    });

    it('should include correct channel count', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test Gig',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.summary.channelCount).toBe(3);
    });

    it('should set gig name correctly', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Summer Festival 2024',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.gig.name).toBe('Summer Festival 2024');
    });
  });

  describe('console configuration', () => {
    it('should configure Yamaha QL1 correctly', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.console.manufacturer).toBe('yamaha');
      expect(parsed.mix.console.model).toBe('ql1');
      expect(parsed.mix.console.inputChannelCount).toBe(32);
    });

    it('should configure Yamaha CL5 correctly', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'cl5' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.console.model).toBe('cl5');
      expect(parsed.mix.console.inputChannelCount).toBe(72);
    });

    it('should configure X32 correctly', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'behringer', model: 'x32' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.console.manufacturer).toBe('behringer');
      expect(parsed.mix.console.model).toBe('x32');
    });
  });

  describe('stagebox configuration', () => {
    it('should add stagebox when specified', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        stagebox: { model: 'yamaha-tio1608-d', slot: 1 },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.console.stageboxes).toHaveLength(1);
      expect(parsed.mix.console.stageboxes[0].model).toBe('yamaha-tio1608-d');
    });

    it('should set correct Dante start channel', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        stagebox: { model: 'yamaha-tio1608-d', slot: 2 },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.console.stageboxes[0].danteStartChannel).toBe(17);
    });
  });

  describe('channel processing', () => {
    it('should categorize instruments correctly', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: [
          { number: 1, name: 'Kick', instrument: 'kick' },
          { number: 2, name: 'Lead Vox', instrument: 'vocals' },
        ],
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      const channels = parsed.mix.currentScene.channels;

      expect(channels[0].category).toBe('drums');
      expect(channels[1].category).toBe('vocals');
    });

    it('should assign colors based on category', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: [
          { number: 1, name: 'Kick' },
          { number: 2, name: 'Bass' },
          { number: 3, name: 'Vocals' },
        ],
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      const channels = parsed.mix.currentScene.channels;

      expect(channels[0].color.name).toBe('Red'); // Drums
      expect(channels[1].color.name).toBe('Orange'); // Bass
      expect(channels[2].color.name).toBe('Magenta'); // Vocals
    });

    it('should truncate long names to 8 characters', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: [
          { number: 1, name: 'Very Long Channel Name' },
        ],
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.channels[0].shortName.length).toBeLessThanOrEqual(8);
    });

    it('should set phantom power for condenser mic indicators', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: [
          { number: 1, name: 'OH L', phantom: true },
        ],
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.channels[0].input.phantomPower).toBe('on');
    });
  });

  describe('genre-based settings', () => {
    it('should apply genre preset when specified', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Rock Show',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        genre: 'rock',
      });

      const parsed = JSON.parse(result);
      expect(parsed.summary.genre).toBe('rock');
      expect(parsed.mix.aiNotes?.mixPhilosophy).toContain('Kraftfullt');
    });

    it('should set up effects based on genre', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Jazz Night',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        genre: 'jazz',
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.effects).toHaveLength(2);
    });
  });

  describe('default structures', () => {
    it('should create default buses', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.buses.length).toBeGreaterThan(0);
    });

    it('should create default DCAs', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.dcas.length).toBe(8);
      expect(parsed.mix.currentScene.dcas[0].name).toBe('Drums');
    });

    it('should create effects rack', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.currentScene.effects.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('metadata', () => {
    it('should set venue when provided', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        venue: 'Club ABC',
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.gig.venue.name).toBe('Club ABC');
    });

    it('should set artist when provided', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
        artist: 'The Band',
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.gig.artist.name).toBe('The Band');
    });

    it('should include timestamps', async () => {
      const result = await buildMixTool.invoke({
        gigName: 'Test',
        channels: sampleChannels,
        console: { manufacturer: 'yamaha', model: 'ql1' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.mix.createdAt).toBeDefined();
      expect(parsed.mix.updatedAt).toBeDefined();
    });
  });
});

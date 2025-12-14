/**
 * Tests for parse-rider tool
 *
 * Note: PDF parsing tests require mocking the pdf-parse module which uses
 * a dynamic require() pattern. We focus on testing image handling, error
 * cases, and the public API that can be reliably tested.
 */

import { describe, it, expect } from 'vitest';
import { parseRiderTool } from '../parse-rider';

describe('parseRiderTool', () => {
  describe('image handling', () => {
    it('should return requiresVision for PNG images', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/png',
        filename: 'rider.png',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.requiresVision).toBe(true);
      expect(parsed.mimeType).toBe('image/png');
    });

    it('should return requiresVision for JPEG images', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/jpeg',
        filename: 'rider.jpg',
      });

      const parsed = JSON.parse(result);
      expect(parsed.requiresVision).toBe(true);
    });

    it('should set low confidence for images', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/png',
      });

      const parsed = JSON.parse(result);
      expect(parsed.confidence).toBe('low');
    });

    it('should include helpful message for vision requirement', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/webp',
      });

      const parsed = JSON.parse(result);
      expect(parsed.message).toContain('vision');
    });

    it('should handle GIF images', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/gif',
      });

      const parsed = JSON.parse(result);
      expect(parsed.requiresVision).toBe(true);
    });
  });

  describe('unsupported file types', () => {
    it('should reject octet-stream', async () => {
      const result = await parseRiderTool.invoke({
        content: 'someContent',
        mimeType: 'application/octet-stream',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.warnings).toBeDefined();
    });

    it('should reject audio files', async () => {
      const result = await parseRiderTool.invoke({
        content: 'someContent',
        mimeType: 'audio/mp3',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    it('should reject video files', async () => {
      const result = await parseRiderTool.invoke({
        content: 'someContent',
        mimeType: 'video/mp4',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    it('should reject text files', async () => {
      const result = await parseRiderTool.invoke({
        content: 'someContent',
        mimeType: 'text/plain',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('tool metadata', () => {
    it('should have correct tool name', () => {
      expect(parseRiderTool.name).toBe('parse_rider');
    });

    it('should have a description', () => {
      expect(parseRiderTool.description).toBeDefined();
      expect(parseRiderTool.description.length).toBeGreaterThan(0);
    });

    it('should mention PDF and image support in description', () => {
      expect(parseRiderTool.description).toContain('PDF');
      expect(parseRiderTool.description.toLowerCase()).toContain('bild');
    });
  });

  describe('output schema', () => {
    it('should return valid JSON for images', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/png',
      });

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include required fields for image response', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/jpeg',
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('requiresVision');
      expect(parsed).toHaveProperty('mimeType');
      expect(parsed).toHaveProperty('confidence');
    });
  });

  describe('PDF error handling', () => {
    it('should handle empty PDF content gracefully', async () => {
      const result = await parseRiderTool.invoke({
        content: '', // Empty content
        mimeType: 'application/pdf',
      });

      const parsed = JSON.parse(result);
      // Should fail gracefully
      expect(parsed.success).toBe(false);
    });

    it('should handle PDF with invalid base64', async () => {
      const result = await parseRiderTool.invoke({
        content: '!!!not-valid-base64!!!',
        mimeType: 'application/pdf',
      });

      const parsed = JSON.parse(result);
      // Should fail gracefully, not throw
      expect(parsed.success).toBe(false);
    });

    it('should include warnings on parse failure', async () => {
      const result = await parseRiderTool.invoke({
        content: 'invalid',
        mimeType: 'application/pdf',
      });

      const parsed = JSON.parse(result);
      expect(parsed.warnings).toBeDefined();
      expect(Array.isArray(parsed.warnings)).toBe(true);
    });
  });

  describe('filename handling', () => {
    it('should accept optional filename', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/png',
        filename: 'TestBand-TechRider.png',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should work without filename', async () => {
      const result = await parseRiderTool.invoke({
        content: 'base64ImageContent',
        mimeType: 'image/png',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });
});

/**
 * Parse Rider Tool
 * Extracts channel information from PDF riders and images (screenshots)
 */

import { z } from 'zod';
import { createTool } from './index';

// Schema for parsed rider channel
export const RiderChannelSchema = z.object({
  number: z.number().describe('Channel number'),
  name: z.string().describe('Channel/instrument name'),
  microphone: z.string().optional().describe('Microphone model if specified'),
  diBox: z.boolean().optional().describe('Whether DI box is needed'),
  phantom: z.boolean().optional().describe('Whether phantom power is needed'),
  stand: z.string().optional().describe('Stand type if specified'),
  notes: z.string().optional().describe('Additional notes'),
});

export type RiderChannel = z.infer<typeof RiderChannelSchema>;

// Schema for parse rider input
const ParseRiderInputSchema = z.object({
  content: z.string().describe('Base64 encoded PDF or image content'),
  mimeType: z.string().describe('MIME type: application/pdf, image/png, image/jpeg, etc.'),
  filename: z.string().optional().describe('Original filename for context'),
});

// Schema for parse rider output
export const ParseRiderOutputSchema = z.object({
  success: z.boolean(),
  channels: z.array(RiderChannelSchema),
  bandName: z.string().optional(),
  genre: z.string().optional(),
  monitorRequirements: z.array(z.string()).optional(),
  specialRequirements: z.array(z.string()).optional(),
  rawText: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()).optional(),
});

export type ParseRiderOutput = z.infer<typeof ParseRiderOutputSchema>;

/**
 * Extract text from PDF using pdf-parse
 */
async function extractPDFText(base64Content: string): Promise<string> {
  // Dynamic import to avoid SSR issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
  const buffer = Buffer.from(base64Content, 'base64');
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Parse channel list from text using pattern matching
 * This is a heuristic approach - the AI agent will also analyze the content
 */
function parseChannelsFromText(text: string): RiderChannel[] {
  const channels: RiderChannel[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Common patterns for channel lists
  const patterns = [
    // "1. Kick - SM91" or "1. Kick (SM91)"
    /^(\d+)[\.\)\s]+([^-–(]+)(?:[-–]\s*|\s*\()([^)]+)/,
    // "CH1: Vocals (SM58)"
    /^CH?\s*(\d+)\s*:\s*([^(]+)(?:\(([^)]+)\))?/i,
    // "01 Kick SM91"
    /^(\d{1,2})\s+(\S+(?:\s+\S+)?)\s+([A-Z]{2,}\d*[A-Z]*)/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, numStr, name, mic] = match;
        const number = parseInt(numStr, 10);

        if (number > 0 && number <= 128 && name) {
          channels.push({
            number,
            name: name.trim(),
            microphone: mic?.trim(),
            phantom: detectPhantom(name, mic),
            diBox: detectDI(name, line),
          });
          break; // Found a match, move to next line
        }
      }
    }
  }

  return channels;
}

/**
 * Detect if phantom power is likely needed
 */
function detectPhantom(name: string, mic?: string): boolean | undefined {
  const condenserMics = /\b(C414|C451|KM184|SM81|NT5|AT40|MK4|U87|AKG|Neumann|DPA|Schoeps)\b/i;
  const dynamicMics = /\b(SM57|SM58|Beta|MD421|RE20|e[0-9]+|D112|M88)\b/i;

  if (mic) {
    if (condenserMics.test(mic)) return true;
    if (dynamicMics.test(mic)) return false;
  }

  // Instruments that typically use condenser mics
  const condenserInstruments = /\b(overhead|oh|hi-?hat|hh|cymbal|ride|acoustic|piano|violin|cello|strings|choir|room)\b/i;
  if (condenserInstruments.test(name)) return true;

  return undefined;
}

/**
 * Detect if DI box is likely needed
 */
function detectDI(name: string, fullLine: string): boolean | undefined {
  const diIndicators = /\b(DI|direct|line|keys|keyboard|synth|bass\s*(?:guitar)?|acoustic\s*guitar|akustisk)\b/i;
  const explicitDI = /\bDI\b/i;

  if (explicitDI.test(fullLine)) return true;
  if (diIndicators.test(name)) return true;

  return undefined;
}

/**
 * Detect genre from rider text
 */
function detectGenre(text: string): string | undefined {
  const genrePatterns: [RegExp, string][] = [
    [/\b(rock|indie|alternative)\b/i, 'rock'],
    [/\b(pop|schlager)\b/i, 'pop'],
    [/\b(metal|hårdrock|heavy)\b/i, 'metal'],
    [/\b(jazz|swing)\b/i, 'jazz'],
    [/\b(folk|visa|tradition|acoustic)\b/i, 'folk'],
    [/\b(klassisk|orkester|classical)\b/i, 'classical'],
    [/\b(worship|praise|lovsång)\b/i, 'worship'],
    [/\b(gospel|choir|kör)\b/i, 'gospel'],
    [/\b(hip-?hop|rap)\b/i, 'hiphop'],
    [/\b(electronic|edm|dj)\b/i, 'electronic'],
    [/\b(country)\b/i, 'country'],
    [/\b(blues)\b/i, 'blues'],
    [/\b(reggae|ska)\b/i, 'reggae'],
    [/\b(latin|salsa|cumbia)\b/i, 'latin'],
    [/\b(teater|theater|musical)\b/i, 'theater'],
    [/\b(corporate|konferens|event)\b/i, 'corporate'],
  ];

  for (const [pattern, genre] of genrePatterns) {
    if (pattern.test(text)) return genre;
  }

  return undefined;
}

/**
 * Extract band/artist name from text
 */
function extractBandName(text: string, filename?: string): string | undefined {
  // Try to find in text
  const patterns = [
    /(?:band|artist|act|grupp|akt):\s*([^\n]+)/i,
    /(?:rider|tech\s*rider)\s+(?:för\s+)?([^\n]+)/i,
    /^([A-ZÅÄÖ][^\n]{2,30})\s*(?:rider|tech)/im,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Try filename
  if (filename) {
    const nameFromFile = filename
      .replace(/\.(pdf|png|jpg|jpeg)$/i, '')
      .replace(/[-_]?(rider|tech|technical)/i, '')
      .trim();
    if (nameFromFile.length > 2) return nameFromFile;
  }

  return undefined;
}

/**
 * Main tool implementation
 */
export const parseRiderTool = createTool({
  name: 'parse_rider',
  description: `Parsar en teknisk rider (PDF eller bild/skärmdump) och extraherar kanalinformation.
Returnerar strukturerad data med:
- Kanallista med instrument och mikrofoner
- Bandnamn och genre om det kan detekteras
- Monitor- och specialkrav
- Indikation på phantom power och DI-behov

VIKTIGT: För bilder används AI vision för att läsa av innehållet.
PDF:er extraheras som text och analyseras med mönsterigenkänning.`,

  schema: ParseRiderInputSchema,

  func: async (input): Promise<string> => {
    const { content, mimeType, filename } = ParseRiderInputSchema.parse(input);

    try {
      let text = '';
      let channels: RiderChannel[] = [];
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      const warnings: string[] = [];

      // Handle PDF
      if (mimeType === 'application/pdf') {
        text = await extractPDFText(content);
        channels = parseChannelsFromText(text);

        if (channels.length === 0) {
          warnings.push('Kunde inte automatiskt extrahera kanaler från PDF. AI-agenten kommer analysera texten.');
          confidence = 'low';
        } else if (channels.length > 5) {
          confidence = 'high';
        }
      }
      // Handle images - return data for AI vision analysis
      else if (mimeType.startsWith('image/')) {
        // For images, we can't parse automatically
        // The agent will use vision to analyze the image
        warnings.push('Bild/skärmdump detekterad. Kräver AI vision för analys.');
        confidence = 'low';

        return JSON.stringify({
          success: true,
          requiresVision: true,
          mimeType,
          confidence: 'low',
          message: 'Bilden behöver analyseras med AI vision. Skicka bilden till modellen för visuell analys.',
        });
      } else {
        throw new Error(`Filtyp stöds inte: ${mimeType}`);
      }

      // Detect additional info
      const bandName = extractBandName(text, filename);
      const genre = detectGenre(text);

      // Extract monitor requirements
      const monitorMatch = text.match(/monitor[^\n]*:\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/gi);
      const monitorRequirements = monitorMatch?.map((m) => m.trim()) || [];

      // Extract special requirements
      const specialPatterns = [
        /(?:special|övrigt|other|notes?):\s*([^\n]+)/gi,
        /(?:viktigt|important|obs):\s*([^\n]+)/gi,
      ];
      const specialRequirements: string[] = [];
      for (const pattern of specialPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) specialRequirements.push(match[1].trim());
        }
      }

      const result: ParseRiderOutput = {
        success: true,
        channels,
        bandName,
        genre,
        monitorRequirements: monitorRequirements.length > 0 ? monitorRequirements : undefined,
        specialRequirements: specialRequirements.length > 0 ? specialRequirements : undefined,
        rawText: text.length > 0 ? text.substring(0, 5000) : undefined, // Limit text size
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        success: false,
        channels: [],
        confidence: 'low',
        warnings: [`Fel vid parsing: ${error instanceof Error ? error.message : 'Okänt fel'}`],
      });
    }
  },
});

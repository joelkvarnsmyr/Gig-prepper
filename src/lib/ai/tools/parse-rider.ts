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

  // Common patterns for channel lists (order matters - most specific first)
  const patterns = [
    // "1. Kick - SM91" or "1. Kick (SM91)" or "1) Kick - Beta 91"
    /^(\d+)[\.\)\s]+([^-–(]+)(?:[-–]\s*|\s*\()([^)\n]+)/,
    // "CH1: Vocals (SM58)" or "Ch 1: Lead Vox"
    /^CH?\s*(\d+)\s*[:\.]\s*([^(]+)(?:\(([^)]+)\))?/i,
    // "Input 1: Kick Drum - Beta 52"
    /^(?:Input|Inp|Kanal|Channel)\s*(\d+)\s*[:\.]\s*([^-–(]+)(?:[-–]\s*([^()\n]+))?/i,
    // "01 Kick SM91" or "01  Kick  SM57"
    /^(\d{1,2})\s{1,4}(\S+(?:\s+\S+)?)\s{2,}([A-Z]{2,}\d*[A-Za-z]*)/i,
    // Table format: "1    Kick Drum    Beta 52    Boom Stand"
    /^(\d{1,2})\s+([A-Za-zÅÄÖåäö0-9\s]+?)\s{2,}([A-Za-z]+\s*\d+[A-Za-z]*)/,
    // Simple numbered: "1 Kick", "2 Snare Top"
    /^(\d{1,2})[\.\):\s]+([A-Za-zÅÄÖåäö]+(?:\s+[A-Za-zÅÄÖåäö]+)?)\s*$/,
    // Swedish format: "1. Bas-trumma (Beta 52)"
    /^(\d+)[\.\)]\s*([^(]+)\s*\(([^)]+)\)/,
    // Compact: "1-Kick-SM91" or "1_Kick_Beta52"
    /^(\d+)[-_]([A-Za-zÅÄÖåäö]+(?:[-_][A-Za-zÅÄÖåäö]+)?)(?:[-_]([A-Za-z]+\d+))?/,
    // Mic list format: "SM58: Lead Vox" (extract channel from position)
    /^([A-Z]{2,}\d*[A-Za-z]*):\s*(.+)/i,
  ];

  let autoChannelNumber = 1;
  const seenNumbers = new Set<number>();

  for (const line of lines) {
    // Skip header lines
    if (/^(?:channel|kanal|input|ch|#|nr)\s*(?:instrument|name|mic|mikrofon|description)/i.test(line)) {
      continue;
    }

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        let number: number;
        let name: string;
        let mic: string | undefined;

        // Handle mic-first format differently
        if (pattern.source.startsWith('^([A-Z]')) {
          // Mic list format - use auto-increment
          number = autoChannelNumber++;
          mic = match[1];
          name = match[2].trim();
        } else {
          const [, numStr, rawName, rawMic] = match;
          number = parseInt(numStr, 10);
          name = rawName?.trim() || '';
          mic = rawMic?.trim();
        }

        // Validate
        if (number > 0 && number <= 128 && name && name.length > 1) {
          // Skip duplicates
          if (seenNumbers.has(number)) {
            continue;
          }
          seenNumbers.add(number);

          channels.push({
            number,
            name: cleanChannelName(name),
            microphone: mic ? cleanMicName(mic) : undefined,
            phantom: detectPhantom(name, mic),
            diBox: detectDI(name, line),
            stand: detectStand(line),
            notes: extractNotes(line),
          });
          break; // Found a match, move to next line
        }
      }
    }
  }

  // Sort by channel number
  return channels.sort((a, b) => a.number - b.number);
}

/**
 * Clean up channel name
 */
function cleanChannelName(name: string): string {
  return name
    .replace(/^\s*[-–:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean up microphone name
 */
function cleanMicName(mic: string): string {
  return mic
    .replace(/^\s*[-–:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect stand type from line
 */
function detectStand(line: string): string | undefined {
  const standPatterns: [RegExp, string][] = [
    [/\b(boom|galgstativ|galge)\b/i, 'boom'],
    [/\b(short|kort|low)\s*(boom|stand|stativ)?\b/i, 'short'],
    [/\b(tall|hög|high)\s*(stand|stativ)?\b/i, 'tall'],
    [/\b(clip|klämma|rim\s*mount)\b/i, 'clip'],
    [/\b(floor|golv)\s*(stand|stativ)?\b/i, 'floor'],
    [/\b(desk|bord)\s*(stand|stativ)?\b/i, 'desk'],
  ];

  for (const [pattern, stand] of standPatterns) {
    if (pattern.test(line)) return stand;
  }
  return undefined;
}

/**
 * Extract notes from line
 */
function extractNotes(line: string): string | undefined {
  // Look for text in parentheses that isn't a microphone
  const noteMatch = line.match(/\(([^)]+)\)/g);
  if (noteMatch) {
    const notes = noteMatch
      .map(m => m.slice(1, -1))
      .filter(n => !/^[A-Z]{2,}\d*[A-Za-z]*$/.test(n) && n.length > 3)
      .join('; ');
    return notes || undefined;
  }
  return undefined;
}

/**
 * Detect if phantom power is likely needed
 */
function detectPhantom(name: string, mic?: string): boolean | undefined {
  // Known condenser microphones
  const condenserMics = /\b(C414|C451|C451B|C214|C314|KM184|KM185|KSM141|KSM44|SM81|SM94|NT1|NT5|NT55|AT2020|AT40|AT4050|AT4041|MK4|MKH|U47|U67|U87|TLM|AKG\s*C|Neumann|DPA|Schoeps|4006|4011|4015|4060|Sennheiser\s*MKH|SE\s*Electronics|Rode\s*NT|CMC|Lavalier|Lapel)\b/i;

  // Known dynamic and ribbon microphones (no phantom needed)
  const dynamicMics = /\b(SM57|SM58|SM7|SM7B|Beta\s*52|Beta\s*58|Beta\s*91|Beta\s*98|MD421|MD441|RE20|RE320|RE16|e602|e604|e609|e614|e906|e935|e945|D112|D12|M88|M201|M160|Super\s*55|PL|D6|D7|ND|Audix\s*D|Audix\s*i5|Audix\s*OM)\b/i;

  if (mic) {
    if (condenserMics.test(mic)) return true;
    if (dynamicMics.test(mic)) return false;
  }

  // Instruments that typically use condenser mics
  const condenserInstruments = /\b(overhead|oh|hi-?hat|hh|cymbal|ride|crash|splash|acoustic|piano|flygel|grand|violin|fiol|cello|viola|strings|stråkar|choir|kör|room|amb|stereo|string\s*section)\b/i;
  if (condenserInstruments.test(name)) return true;

  // Instruments that typically use dynamic mics
  const dynamicInstruments = /\b(kick|bass\s*drum|bastrumma|snare|virvel|tom|floor|gulvtom|gitarr\s*amp|guitar\s*amp|cab|cabinet)\b/i;
  if (dynamicInstruments.test(name)) return false;

  return undefined;
}

/**
 * Detect if DI box is likely needed
 */
function detectDI(name: string, fullLine: string): boolean | undefined {
  // Explicit DI indicators
  const explicitDI = /\b(DI|D\.I\.|direct\s*box)\b/i;
  if (explicitDI.test(fullLine)) return true;

  // Instruments that typically need DI
  const diInstruments = /\b(keys|keyboard|tangent|synth|synthesizer|piano\s*L|piano\s*R|elpiano|rhodes|wurli|nord|bass\s*(?:guitar)?|elbas|acoustic\s*guitar|akustisk\s*gitarr|laptop|dator|click|track|backing|playback|stereo\s*in|stereo\s*L|stereo\s*R|USB|iPad)\b/i;
  if (diInstruments.test(name)) return true;

  // Line level indicators
  const lineLevelIndicators = /\b(line|linje|stereo|L\/?R|left|right)\b/i;
  if (lineLevelIndicators.test(fullLine) && !fullLine.match(/line\s*check/i)) {
    return true;
  }

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

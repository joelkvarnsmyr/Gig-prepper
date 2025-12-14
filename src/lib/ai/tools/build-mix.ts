/**
 * Build Mix Tool
 * Creates UniversalMix from channel data and configuration
 */

import { z } from 'zod';
import { createTool } from './index';
import {
  UniversalMix,
  Genre,
  ConsoleModel,
  ConsoleManufacturer,
  StageboxModel,
  Channel,
  Bus,
  DCA,
  EffectProcessor,
  GENRE_PRESETS,
  createDefaultChannel,
  createDefaultReverb,
  createDefaultDelay,
  createEmptyMix,
} from '@/lib/models/universal-mix';

// Input schema
const ChannelInputSchema = z.object({
  number: z.number(),
  name: z.string(),
  shortName: z.string().optional(),
  instrument: z.string().optional(),
  microphone: z.string().optional(),
  phantom: z.boolean().optional(),
  diBox: z.boolean().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

const StageboxInputSchema = z.object({
  model: z.string(),
  slot: z.number().default(1),
  location: z.string().optional(),
});

const ConsoleInputSchema = z.object({
  manufacturer: z.enum(['yamaha', 'behringer', 'midas', 'allen-heath']),
  model: z.string(),
});

const BuildMixInputSchema = z.object({
  gigName: z.string().describe('Name of the gig/show'),
  channels: z.array(ChannelInputSchema).describe('Channel list'),
  console: ConsoleInputSchema.describe('Console configuration'),
  stagebox: StageboxInputSchema.optional().describe('Stagebox if used'),
  genre: z.string().optional().describe('Music genre for preset recommendations'),
  venue: z.string().optional().describe('Venue name'),
  artist: z.string().optional().describe('Artist/band name'),
  date: z.string().optional().describe('Show date (ISO format)'),
});

type BuildMixInput = z.infer<typeof BuildMixInputSchema>;

/**
 * Get console configuration based on model
 */
function getConsoleConfig(manufacturer: ConsoleManufacturer, model: string) {
  const configs: Record<string, Partial<UniversalMix['console']>> = {
    // Yamaha
    ql1: { inputChannelCount: 32, stereoInputCount: 8, mixBusCount: 16, matrixCount: 8, dcaCount: 8, effectRackCount: 8, localInputs: 16, localOutputs: 16 },
    ql5: { inputChannelCount: 64, stereoInputCount: 8, mixBusCount: 16, matrixCount: 8, dcaCount: 8, effectRackCount: 8, localInputs: 32, localOutputs: 16 },
    cl1: { inputChannelCount: 48, stereoInputCount: 8, mixBusCount: 24, matrixCount: 8, dcaCount: 8, effectRackCount: 8, localInputs: 8, localOutputs: 8 },
    cl3: { inputChannelCount: 64, stereoInputCount: 8, mixBusCount: 24, matrixCount: 8, dcaCount: 8, effectRackCount: 8, localInputs: 8, localOutputs: 8 },
    cl5: { inputChannelCount: 72, stereoInputCount: 8, mixBusCount: 24, matrixCount: 8, dcaCount: 8, effectRackCount: 8, localInputs: 8, localOutputs: 8 },
    tf1: { inputChannelCount: 16, stereoInputCount: 1, mixBusCount: 8, matrixCount: 0, dcaCount: 4, effectRackCount: 4, localInputs: 16, localOutputs: 8 },
    tf3: { inputChannelCount: 24, stereoInputCount: 1, mixBusCount: 8, matrixCount: 0, dcaCount: 4, effectRackCount: 4, localInputs: 24, localOutputs: 8 },
    tf5: { inputChannelCount: 32, stereoInputCount: 1, mixBusCount: 8, matrixCount: 0, dcaCount: 4, effectRackCount: 4, localInputs: 32, localOutputs: 8 },
    // Behringer/Midas
    x32: { inputChannelCount: 32, stereoInputCount: 0, mixBusCount: 16, matrixCount: 6, dcaCount: 8, effectRackCount: 8, localInputs: 32, localOutputs: 16 },
    m32: { inputChannelCount: 32, stereoInputCount: 0, mixBusCount: 16, matrixCount: 6, dcaCount: 8, effectRackCount: 8, localInputs: 32, localOutputs: 16 },
  };

  const config = configs[model.toLowerCase()] || configs.ql1;

  return {
    manufacturer,
    model: model.toLowerCase() as ConsoleModel,
    ...config,
    stageboxes: [],
  };
}

/**
 * Categorize instrument for icon and color assignment
 */
function categorizeInstrument(name: string): { category: string; color: string; icon: string } {
  const lower = name.toLowerCase();

  // Drums
  if (/kick|bd|bass\s*drum/i.test(lower)) return { category: 'drums', color: 'Red', icon: 'Kick' };
  if (/snare|sd/i.test(lower)) return { category: 'drums', color: 'Red', icon: 'Snare' };
  if (/tom/i.test(lower)) return { category: 'drums', color: 'Red', icon: 'Hi-Tom' };
  if (/hi-?hat|hh/i.test(lower)) return { category: 'drums', color: 'Red', icon: 'Hi-Hat' };
  if (/overhead|oh|cymbal/i.test(lower)) return { category: 'drums', color: 'Red', icon: 'Ride' };

  // Bass
  if (/bass|bas\b/i.test(lower)) return { category: 'bass', color: 'Orange', icon: 'E.Bass' };

  // Guitars
  if (/acoustic|akustisk/i.test(lower) && /git/i.test(lower)) return { category: 'guitar', color: 'Yellow', icon: 'A.Guitar' };
  if (/guitar|gtr|git/i.test(lower)) return { category: 'guitar', color: 'Yellow', icon: 'E.Guitar' };

  // Keys
  if (/piano/i.test(lower)) return { category: 'keys', color: 'Cyan', icon: 'Piano' };
  if (/key|synth|org/i.test(lower)) return { category: 'keys', color: 'Cyan', icon: 'Keyboard' };

  // Vocals
  if (/lead.*vo[cx]|sång|röst/i.test(lower)) return { category: 'vocals', color: 'Magenta', icon: 'Female' };
  if (/back.*vo[cx]|kör|choir|kor/i.test(lower)) return { category: 'vocals', color: 'Purple', icon: 'Female' };
  if (/vo[cx]|sång|vocal/i.test(lower)) return { category: 'vocals', color: 'Magenta', icon: 'Male' };

  // Strings
  if (/violin|fiol|cello|viola/i.test(lower)) return { category: 'strings', color: 'Green', icon: 'Strings' };

  // Brass/Winds
  if (/trumpet|sax|horn|blås/i.test(lower)) return { category: 'brass', color: 'Blue', icon: 'Trumpet' };
  if (/flute|flöjt/i.test(lower)) return { category: 'winds', color: 'Blue', icon: 'Sax' };

  // Percussion
  if (/perc|conga|djembe|shaker|tamb/i.test(lower)) return { category: 'percussion', color: 'Orange', icon: 'Conga' };

  // Default
  return { category: 'other', color: 'White', icon: 'Inst' };
}

/**
 * Build channel from input data
 */
function buildChannel(input: z.infer<typeof ChannelInputSchema>, genre?: Genre): Channel {
  const { category, color, icon } = categorizeInstrument(input.name);
  const preset = genre ? GENRE_PRESETS[genre] : undefined;

  const channel = createDefaultChannel(input.number, input.name);

  // Override with input data
  channel.shortName = input.shortName || input.name.substring(0, 8);
  channel.color = { name: input.color || color };
  channel.category = category;
  channel.icon = icon;

  // Input configuration
  channel.input.inputType = input.diBox ? 'line' : 'mic';
  channel.input.phantomPower = input.phantom ? 'on' : 'off';

  // Set initial fader to -inf (will be brought up during soundcheck)
  channel.fader = -96;

  // Add microphone as note
  if (input.microphone) {
    channel.notes = `Mic: ${input.microphone}`;
  }

  // Apply genre-based HPF
  if (preset && channel.eq.highPassFilter) {
    channel.eq.highPassFilter.enabled = true;
    channel.eq.highPassFilter.frequency = getHPFForInstrument(category, preset);
  }

  return channel;
}

/**
 * Get appropriate HPF frequency based on instrument category
 */
function getHPFForInstrument(category: string, preset: typeof GENRE_PRESETS[Genre]): number {
  const hpfMap: Record<string, number> = {
    drums: 40,      // Kick needs low end
    bass: 30,       // Bass needs very low end
    guitar: 100,
    keys: 80,
    vocals: preset.vocalProcessing.hpf,
    strings: 80,
    brass: 100,
    winds: 150,
    percussion: 80,
    other: 100,
  };

  return hpfMap[category] || 100;
}

/**
 * Build default buses (monitors + main mix)
 */
function buildDefaultBuses(channelCount: number): Bus[] {
  const buses: Bus[] = [];

  // Create some default monitor mixes
  const monitorNames = ['Mon 1', 'Mon 2', 'Mon 3', 'Mon 4', 'IEM L', 'IEM R'];

  for (let i = 0; i < Math.min(6, 16); i++) {
    buses.push({
      id: `bus-${i + 1}`,
      number: i + 1,
      name: monitorNames[i] || `Mix ${i + 1}`,
      shortName: monitorNames[i]?.substring(0, 4) || `MX${i + 1}`,
      type: 'aux',
      stereo: false,
      color: { name: 'Blue' },
      eq: {
        enabled: true,
        bands: [],
        highPassFilter: { enabled: false, frequency: 80, slope: 18 },
      },
      fader: -10, // Start at reasonable level
      mute: false,
      purpose: 'monitor',
    });
  }

  return buses;
}

/**
 * Build default DCAs
 */
function buildDefaultDCAs(): DCA[] {
  const dcaNames = ['Drums', 'Bass', 'Gtr', 'Keys', 'Vocals', 'FX', 'Band', 'All'];

  return dcaNames.map((name, i) => ({
    id: `dca-${i + 1}`,
    number: i + 1,
    name,
    shortName: name.substring(0, 4),
    color: { name: 'White' },
    fader: 0,
    mute: false,
    assignedChannels: [],
  }));
}

/**
 * Build effects rack with genre-appropriate settings
 */
function buildEffectsRack(genre?: Genre): EffectProcessor[] {
  const preset = genre ? GENRE_PRESETS[genre] : GENRE_PRESETS.other;

  const reverb = createDefaultReverb();
  const delay = createDefaultDelay();

  // Apply genre preset
  if (preset.defaultReverb) {
    Object.assign(reverb, preset.defaultReverb);
  }
  if (preset.defaultDelay) {
    Object.assign(delay, preset.defaultDelay);
  }

  return [
    {
      id: 'fx-1',
      slot: 1,
      name: 'Main Reverb',
      category: 'reverb',
      bypassed: false,
      reverb,
      inputSource: 'bus',
      returnLevel: -6,
    },
    {
      id: 'fx-2',
      slot: 2,
      name: 'Vocal Delay',
      category: 'delay',
      bypassed: false,
      delay,
      inputSource: 'bus',
      returnLevel: -10,
    },
  ];
}

/**
 * Main tool implementation
 */
export const buildMixTool = createTool({
  name: 'build_mix',
  description: `Bygger en UniversalMix från kanaldata och konfiguration.
Skapar ett komplett mixdokument med:
- Kanaler med rätt kategorisering och färger
- Genre-anpassade EQ/dynamik-utgångspunkter
- Standard-monitormixar
- DCA-grupper
- Effekt-rack med reverb/delay

Returnerar en fullständig UniversalMix JSON som kan användas för att generera konsolfiler.`,

  schema: BuildMixInputSchema,

  func: async (input): Promise<string> => {
    try {
      const data = BuildMixInputSchema.parse(input);
      const genre = data.genre as Genre | undefined;

      // Create base mix
      const mix = createEmptyMix(data.gigName);

      // Set gig info
      mix.gig.name = data.gigName;
      mix.gig.date = data.date || new Date().toISOString().split('T')[0];
      mix.gig.artist.name = data.artist || '';
      mix.gig.artist.genre = genre ? [genre] : [];
      mix.gig.venue.name = data.venue || '';

      // Set console config
      const consoleConfig = getConsoleConfig(
        data.console.manufacturer as ConsoleManufacturer,
        data.console.model
      );
      mix.console = {
        ...consoleConfig,
        stageboxes: [],
      } as UniversalMix['console'];

      // Add stagebox if specified
      if (data.stagebox) {
        mix.console.stageboxes.push({
          id: 'stagebox-1',
          model: data.stagebox.model as StageboxModel,
          name: data.stagebox.model,
          location: data.stagebox.location || 'Stage',
          inputCount: 16, // Default for most stageboxes
          outputCount: 8,
          danteStartChannel: (data.stagebox.slot - 1) * 16 + 1,
        });
      }

      // Build channels
      mix.currentScene.channels = data.channels.map((ch) => buildChannel(ch, genre));

      // Build buses
      mix.currentScene.buses = buildDefaultBuses(data.channels.length);

      // Build DCAs
      mix.currentScene.dcas = buildDefaultDCAs();

      // Build effects
      mix.currentScene.effects = buildEffectsRack(genre);

      // Add AI notes
      const preset = genre ? GENRE_PRESETS[genre] : undefined;
      mix.aiNotes = {
        genreRecommendations: preset ? [preset.mixPhilosophy] : [],
        processingDecisions: [],
        warnings: [],
        suggestions: [
          'Kom ihåg att line-checka alla kanaler',
          'Verifiera phantom power innan du kopplar in mikrofoner',
        ],
        mixPhilosophy: preset?.mixPhilosophy,
      };

      // Update timestamp
      mix.updatedAt = new Date().toISOString();

      return JSON.stringify({
        success: true,
        mix,
        summary: {
          channelCount: mix.currentScene.channels.length,
          busCount: mix.currentScene.buses.length,
          dcaCount: mix.currentScene.dcas.length,
          effectCount: mix.currentScene.effects.length,
          genre: genre || 'not specified',
          console: `${data.console.manufacturer} ${data.console.model}`,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});

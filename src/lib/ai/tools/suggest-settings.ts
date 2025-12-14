/**
 * Suggest Settings Tool
 * Provides genre and instrument-based audio processing recommendations
 */

import { z } from 'zod';
import { createTool } from './index';
import { Genre, GENRE_PRESETS, GenrePreset } from '@/lib/models/universal-mix';

// Input schema
const SuggestSettingsInputSchema = z.object({
  instrument: z.string().describe('Instrument or source name (e.g., "kick", "lead vocal", "acoustic guitar")'),
  genre: z.string().describe('Music genre (e.g., "rock", "folk", "jazz")'),
  context: z.string().optional().describe('Additional context (e.g., "aggressive style", "soft ballad")'),
  includeEffects: z.boolean().default(true).describe('Include effect recommendations'),
});

// Instrument category type
type InstrumentCategory =
  | 'kick' | 'snare' | 'hihat' | 'toms' | 'overheads'
  | 'bass' | 'electric-guitar' | 'acoustic-guitar' | 'keys'
  | 'lead-vocal' | 'backing-vocal' | 'strings' | 'brass' | 'woodwinds'
  | 'percussion' | 'other';

/**
 * Categorize instrument from name
 */
function categorizeInstrument(name: string): InstrumentCategory {
  const lower = name.toLowerCase();

  if (/kick|bass\s*drum|bd/i.test(lower)) return 'kick';
  if (/snare|sd|virvel/i.test(lower)) return 'snare';
  if (/hi-?hat|hh/i.test(lower)) return 'hihat';
  if (/tom/i.test(lower)) return 'toms';
  if (/overhead|oh|cymbal|ride|crash/i.test(lower)) return 'overheads';
  if (/bass|bas\b/i.test(lower)) return 'bass';
  if (/electric.*guitar|e[.-]?guitar|el.*git/i.test(lower)) return 'electric-guitar';
  if (/acoustic|akustisk|a[.-]?guitar/i.test(lower)) return 'acoustic-guitar';
  if (/key|piano|synth|org|klav/i.test(lower)) return 'keys';
  if (/lead.*voc|sång|röst|vocal/i.test(lower)) return 'lead-vocal';
  if (/back.*voc|kör|choir|kor|bgv/i.test(lower)) return 'backing-vocal';
  if (/violin|fiol|cello|viola|strå/i.test(lower)) return 'strings';
  if (/trumpet|sax|horn|blås|brass|trombon/i.test(lower)) return 'brass';
  if (/flute|flöjt|clarinet|oboe|klarinett/i.test(lower)) return 'woodwinds';
  if (/perc|conga|djembe|shaker|tamb|cajon/i.test(lower)) return 'percussion';

  return 'other';
}

/**
 * Get EQ suggestions based on instrument and genre
 */
function getEQSuggestions(category: InstrumentCategory, preset?: GenrePreset) {
  const suggestions: Record<InstrumentCategory, {
    hpf: number;
    description: string;
    bands: Array<{ freq: number; gain: string; purpose: string }>;
  }> = {
    kick: {
      hpf: 30,
      description: 'Låt basen andas, ta bort sub-rumble',
      bands: [
        { freq: 60, gain: '+2-4 dB', purpose: 'Thump/kropp' },
        { freq: 400, gain: '-2-4 dB', purpose: 'Ta bort "kartong"' },
        { freq: 3500, gain: '+2-3 dB', purpose: 'Attack/klick' },
      ],
    },
    snare: {
      hpf: 80,
      description: 'Ta bort kick-läckage i lågbas',
      bands: [
        { freq: 200, gain: '+1-3 dB', purpose: 'Kropp/fatness' },
        { freq: 800, gain: '-2-4 dB', purpose: 'Ta bort "box"' },
        { freq: 5000, gain: '+2-4 dB', purpose: 'Crack/presence' },
      ],
    },
    hihat: {
      hpf: 300,
      description: 'Filtrera bort allt utom hi-hat',
      bands: [
        { freq: 8000, gain: '+1-2 dB', purpose: 'Glans' },
        { freq: 400, gain: '-3 dB', purpose: 'Ta bort läckage' },
      ],
    },
    toms: {
      hpf: 60,
      description: 'Behåll attack men ta bort rumble',
      bands: [
        { freq: 100, gain: '+2 dB', purpose: 'Kropp' },
        { freq: 400, gain: '-2 dB', purpose: 'Ta bort box' },
        { freq: 3000, gain: '+2 dB', purpose: 'Attack' },
      ],
    },
    overheads: {
      hpf: 200,
      description: 'Fokusera på cymbaler, låt trummorna komma från close mics',
      bands: [
        { freq: 10000, gain: '+1-2 dB', purpose: 'Air/shimmer' },
        { freq: 400, gain: '-1-2 dB', purpose: 'Rensa upp' },
      ],
    },
    bass: {
      hpf: 30,
      description: 'Behåll grunden men ta bort sub-rumble',
      bands: [
        { freq: 80, gain: '+2 dB', purpose: 'Grund/foundation' },
        { freq: 250, gain: '-2 dB', purpose: 'Rensa muddig mitt' },
        { freq: 800, gain: '+1 dB', purpose: 'Definition' },
        { freq: 2500, gain: '+1-2 dB', purpose: 'Plektrumattack' },
      ],
    },
    'electric-guitar': {
      hpf: 100,
      description: 'Låt basen ha låg-registret',
      bands: [
        { freq: 250, gain: '-1-2 dB', purpose: 'Ta bort mud' },
        { freq: 3000, gain: '+1-2 dB', purpose: 'Presence/bite' },
        { freq: 6000, gain: '+1 dB', purpose: 'Klarhet' },
      ],
    },
    'acoustic-guitar': {
      hpf: 80,
      description: 'Naturlig bas men ta bort rumble',
      bands: [
        { freq: 200, gain: '-2 dB', purpose: 'Ta bort boominess' },
        { freq: 3000, gain: '+1-2 dB', purpose: 'Strängklarhet' },
        { freq: 8000, gain: '+1 dB', purpose: 'Air' },
      ],
    },
    keys: {
      hpf: 60,
      description: 'Beror på om det är piano eller synth',
      bands: [
        { freq: 200, gain: '-1 dB', purpose: 'Rensa mud' },
        { freq: 3000, gain: '+1 dB', purpose: 'Presence' },
      ],
    },
    'lead-vocal': {
      hpf: preset?.vocalProcessing.hpf || 100,
      description: 'Ta bort proximity effect och scen-rumble',
      bands: [
        { freq: 200, gain: '-2-3 dB', purpose: 'Reducera proximity' },
        { freq: 3000, gain: '+2-3 dB', purpose: 'Presence/förståelighet' },
        { freq: 8000, gain: '+1 dB', purpose: 'Air' },
        { freq: 6000, gain: '-2 dB', purpose: 'De-ess manuellt vid behov' },
      ],
    },
    'backing-vocal': {
      hpf: 120,
      description: 'Lite hårdare HPF för att ge plats åt lead',
      bands: [
        { freq: 250, gain: '-2 dB', purpose: 'Ge plats åt lead' },
        { freq: 3000, gain: '+1 dB', purpose: 'Klarhet' },
      ],
    },
    strings: {
      hpf: 80,
      description: 'Naturlig klang, minimal EQ',
      bands: [
        { freq: 200, gain: '-1 dB', purpose: 'Vid behov: ta bort boominess' },
        { freq: 6000, gain: '+1 dB', purpose: 'Air' },
      ],
    },
    brass: {
      hpf: 100,
      description: 'Behåll naturlig kropp',
      bands: [
        { freq: 3000, gain: '+1 dB', purpose: 'Presence' },
        { freq: 400, gain: '-1 dB', purpose: 'Vid behov: ta bort honkighet' },
      ],
    },
    woodwinds: {
      hpf: 150,
      description: 'Oftast kondensormikrofon, var försiktig med boost',
      bands: [
        { freq: 8000, gain: '+1 dB', purpose: 'Luft' },
      ],
    },
    percussion: {
      hpf: 80,
      description: 'Anpassa efter instrument',
      bands: [
        { freq: 3000, gain: '+1 dB', purpose: 'Attack' },
      ],
    },
    other: {
      hpf: 100,
      description: 'Anpassa efter källan',
      bands: [],
    },
  };

  return suggestions[category] || suggestions.other;
}

/**
 * Get dynamics suggestions
 */
function getDynamicsSuggestions(category: InstrumentCategory, preset?: GenrePreset) {
  const suggestions: Record<InstrumentCategory, {
    gate: { use: boolean; threshold: string; attack: string; hold: string; release: string };
    compressor: { use: boolean; ratio: string; threshold: string; attack: string; release: string; knee: string };
  }> = {
    kick: {
      gate: { use: true, threshold: '-35 dB', attack: '0.5 ms', hold: '50 ms', release: '100 ms' },
      compressor: { use: true, ratio: '4:1', threshold: '-15 dB', attack: '5 ms', release: '100 ms', knee: 'hard' },
    },
    snare: {
      gate: { use: true, threshold: '-30 dB', attack: '0.5 ms', hold: '50 ms', release: '150 ms' },
      compressor: { use: true, ratio: '4:1', threshold: '-12 dB', attack: '3 ms', release: '150 ms', knee: 'medium' },
    },
    hihat: {
      gate: { use: false, threshold: '-40 dB', attack: '1 ms', hold: '30 ms', release: '100 ms' },
      compressor: { use: false, ratio: '2:1', threshold: '-10 dB', attack: '10 ms', release: '100 ms', knee: 'soft' },
    },
    toms: {
      gate: { use: true, threshold: '-35 dB', attack: '1 ms', hold: '80 ms', release: '200 ms' },
      compressor: { use: true, ratio: '3:1', threshold: '-15 dB', attack: '5 ms', release: '150 ms', knee: 'medium' },
    },
    overheads: {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '2:1', threshold: '-10 dB', attack: '20 ms', release: '200 ms', knee: 'soft' },
    },
    bass: {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: true, ratio: '4:1', threshold: '-15 dB', attack: '10 ms', release: '150 ms', knee: 'soft' },
    },
    'electric-guitar': {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '3:1', threshold: '-15 dB', attack: '15 ms', release: '200 ms', knee: 'soft' },
    },
    'acoustic-guitar': {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: true, ratio: '3:1', threshold: '-15 dB', attack: '20 ms', release: '200 ms', knee: 'soft' },
    },
    keys: {
      gate: { use: false, threshold: '-60 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '2:1', threshold: '-10 dB', attack: '15 ms', release: '150 ms', knee: 'soft' },
    },
    'lead-vocal': {
      gate: { use: false, threshold: '-40 dB', attack: '1 ms', hold: '100 ms', release: '200 ms' },
      compressor: {
        use: true,
        ratio: preset?.vocalProcessing.compression.ratio ? `${preset.vocalProcessing.compression.ratio}:1` : '4:1',
        threshold: '-18 dB',
        attack: preset?.vocalProcessing.compression.attack ? `${preset.vocalProcessing.compression.attack} ms` : '10 ms',
        release: '100 ms',
        knee: preset?.vocalProcessing.compression.knee || 'soft',
      },
    },
    'backing-vocal': {
      gate: { use: false, threshold: '-40 dB', attack: '1 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: true, ratio: '3:1', threshold: '-15 dB', attack: '15 ms', release: '150 ms', knee: 'soft' },
    },
    strings: {
      gate: { use: false, threshold: '-60 dB', attack: '10 ms', hold: '200 ms', release: '300 ms' },
      compressor: { use: false, ratio: '2:1', threshold: '-10 dB', attack: '30 ms', release: '300 ms', knee: 'soft' },
    },
    brass: {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '3:1', threshold: '-12 dB', attack: '10 ms', release: '150 ms', knee: 'medium' },
    },
    woodwinds: {
      gate: { use: false, threshold: '-50 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '2:1', threshold: '-10 dB', attack: '20 ms', release: '200 ms', knee: 'soft' },
    },
    percussion: {
      gate: { use: true, threshold: '-35 dB', attack: '1 ms', hold: '50 ms', release: '150 ms' },
      compressor: { use: false, ratio: '3:1', threshold: '-15 dB', attack: '5 ms', release: '100 ms', knee: 'medium' },
    },
    other: {
      gate: { use: false, threshold: '-40 dB', attack: '5 ms', hold: '100 ms', release: '200 ms' },
      compressor: { use: false, ratio: '3:1', threshold: '-15 dB', attack: '15 ms', release: '150 ms', knee: 'soft' },
    },
  };

  // Adjust for genre
  const result = suggestions[category] || suggestions.other;

  // For jazz/folk/classical - less or no gate
  if (preset?.genre && ['jazz', 'folk', 'classical', 'acoustic'].includes(preset.genre)) {
    result.gate.use = false;
  }

  // For metal - harder gate on drums
  if (preset?.genre === 'metal' && ['kick', 'snare', 'toms'].includes(category)) {
    result.gate.threshold = '-25 dB';
    result.compressor.ratio = '6:1';
  }

  return result;
}

/**
 * Get effect recommendations
 */
function getEffectRecommendations(category: InstrumentCategory, preset?: GenrePreset) {
  const recommendations: Record<InstrumentCategory, {
    reverb: { send: string; type: string; time: string };
    delay: { send: string; type: string; time: string };
    other: string[];
  }> = {
    kick: {
      reverb: { send: '-∞ (ingen)', type: '-', time: '-' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: ['Vanligtvis ingen effekt på kick'],
    },
    snare: {
      reverb: { send: '-15 dB', type: 'Plate', time: '1.0-1.5s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: ['Reverb ger liv och djup'],
    },
    hihat: {
      reverb: { send: '-20 dB', type: 'Room', time: '0.8s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    toms: {
      reverb: { send: '-15 dB', type: 'Plate/Hall', time: '1.2s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    overheads: {
      reverb: { send: '-20 dB', type: 'Room', time: '0.8s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    bass: {
      reverb: { send: '-∞ (ingen)', type: '-', time: '-' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: ['Bas bör vara torr för tight mix'],
    },
    'electric-guitar': {
      reverb: { send: '-12 dB', type: preset?.defaultReverb.algorithm || 'Plate', time: '1.5s' },
      delay: { send: '-15 dB', type: 'Stereo', time: '300-400ms' },
      other: ['Delay kan användas för solo/leads'],
    },
    'acoustic-guitar': {
      reverb: { send: '-10 dB', type: 'Hall', time: preset?.defaultReverb.time ? `${preset.defaultReverb.time}s` : '1.8s' },
      delay: { send: '-18 dB', type: 'Tape', time: '250ms' },
      other: [],
    },
    keys: {
      reverb: { send: '-12 dB', type: 'Hall', time: '1.5s' },
      delay: { send: '-15 dB', type: 'Stereo', time: '350ms' },
      other: [],
    },
    'lead-vocal': {
      reverb: { send: '-10 dB', type: preset?.defaultReverb.algorithm || 'Hall', time: preset?.defaultReverb.time ? `${preset.defaultReverb.time}s` : '1.8s' },
      delay: { send: '-12 dB', type: 'Stereo', time: preset?.defaultDelay.timeLeft ? `${preset.defaultDelay.timeLeft}ms` : '350ms' },
      other: preset?.vocalProcessing.deEss ? ['Överväg de-esser vid 6-8kHz'] : [],
    },
    'backing-vocal': {
      reverb: { send: '-8 dB', type: 'Hall', time: '2.0s' },
      delay: { send: '-15 dB', type: 'Stereo', time: '400ms' },
      other: ['Mer reverb än lead för djup'],
    },
    strings: {
      reverb: { send: '-8 dB', type: 'Hall', time: '2.5s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    brass: {
      reverb: { send: '-12 dB', type: 'Hall', time: '1.5s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    woodwinds: {
      reverb: { send: '-10 dB', type: 'Hall', time: '2.0s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    percussion: {
      reverb: { send: '-15 dB', type: 'Room', time: '0.8s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
    other: {
      reverb: { send: '-15 dB', type: 'Hall', time: '1.5s' },
      delay: { send: '-∞ (ingen)', type: '-', time: '-' },
      other: [],
    },
  };

  return recommendations[category] || recommendations.other;
}

/**
 * Main tool implementation
 */
export const suggestSettingsTool = createTool({
  name: 'suggest_settings',
  description: `Föreslår EQ, dynamik och effekt-inställningar baserat på instrument och genre.
Använder beprövade ljudtekniker-standarder som utgångspunkt.

Returnerar:
- EQ-rekommendationer med frekvenser och syften
- Gate/kompressor-inställningar
- Effekt-sends (reverb, delay)
- Förklaringar till varje förslag

Dessa är UTGÅNGSPUNKTER - justera efter öra och situation!`,

  schema: SuggestSettingsInputSchema,

  func: async (input): Promise<string> => {
    try {
      const { instrument, genre, context, includeEffects } = SuggestSettingsInputSchema.parse(input);

      const category = categorizeInstrument(instrument);
      const preset = GENRE_PRESETS[genre as Genre];

      const eq = getEQSuggestions(category, preset);
      const dynamics = getDynamicsSuggestions(category, preset);
      const effects = includeEffects ? getEffectRecommendations(category, preset) : null;

      return JSON.stringify({
        success: true,
        instrument,
        category,
        genre,
        genrePhilosophy: preset?.mixPhilosophy || 'Anpassa efter situation',
        context,

        eq: {
          highPassFilter: `${eq.hpf} Hz`,
          description: eq.description,
          bands: eq.bands,
        },

        dynamics: {
          gate: dynamics.gate,
          compressor: dynamics.compressor,
        },

        effects: effects ? {
          reverb: effects.reverb,
          delay: effects.delay,
          notes: effects.other,
        } : undefined,

        disclaimer: 'Dessa är utgångspunkter baserade på beprövade tekniker. Lyssna alltid och justera efter situationen, lokalen och artistens önskemål.',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});

/**
 * Universal Mix Data Model
 *
 * This is the core data structure that represents a mix independently of any
 * specific mixing console. All console-specific adapters translate to/from
 * this format.
 *
 * Flow: Rider/Input → AI Processing → UniversalMix → Console Adapter → .clf/.scn/.csv
 */

// ============================================================================
// Channel Types
// ============================================================================

export type ChannelType = 'mono' | 'stereo' | 'group' | 'aux' | 'matrix' | 'main';
export type InputType = 'mic' | 'line' | 'di' | 'digital' | 'usb' | 'dante' | 'aes' | 'madi';
export type PhantomPower = 'on' | 'off' | 'auto';

export interface ChannelColor {
  name: string; // Human readable: 'red', 'blue', 'green', etc.
  hex?: string; // Optional hex value for custom colors
}

// ============================================================================
// EQ Settings
// ============================================================================

export type EQBandType = 'highpass' | 'lowshelf' | 'parametric' | 'highshelf' | 'lowpass';

export interface EQBand {
  enabled: boolean;
  type: EQBandType;
  frequency: number;      // Hz (20-20000)
  gain: number;           // dB (-15 to +15)
  q: number;              // Q factor (0.1 to 10)
}

export interface EQSettings {
  enabled: boolean;
  bands: EQBand[];
  highPassFilter: {
    enabled: boolean;
    frequency: number;    // Hz
    slope: 12 | 18 | 24;  // dB/octave
  };
  lowPassFilter?: {
    enabled: boolean;
    frequency: number;
    slope: 12 | 18 | 24;
  };
}

// ============================================================================
// Dynamics Settings
// ============================================================================

export interface GateSettings {
  enabled: boolean;
  threshold: number;      // dB (-80 to 0)
  range: number;          // dB (0 to 80)
  attack: number;         // ms (0.05 to 100)
  hold: number;           // ms (0 to 2000)
  release: number;        // ms (5 to 4000)
  keyFilter?: {
    enabled: boolean;
    frequency: number;
    q: number;
  };
}

export type CompressorKnee = 'hard' | 'soft' | 'medium';
export type CompressorType = 'comp' | 'expand' | 'gate' | 'ducking';

export interface CompressorSettings {
  enabled: boolean;
  threshold: number;      // dB (-60 to 0)
  ratio: number;          // 1:1 to 20:1 (or infinity)
  attack: number;         // ms (0.05 to 100)
  release: number;        // ms (5 to 4000)
  knee: CompressorKnee;
  makeupGain: number;     // dB (0 to 30)
  autoMakeup?: boolean;
}

export interface DynamicsSettings {
  gate: GateSettings;
  compressor: CompressorSettings;
}

// ============================================================================
// Effects / Inserts
// ============================================================================

export type EffectType =
  | 'reverb' | 'delay' | 'chorus' | 'flanger' | 'phaser'
  | 'tremolo' | 'rotary' | 'pitch' | 'distortion' | 'exciter';

export type ReverbType =
  | 'hall' | 'plate' | 'room' | 'chamber' | 'spring'
  | 'ambience' | 'cathedral' | 'arena';

export interface ReverbSettings {
  type: ReverbType;
  time: number;           // seconds (0.1 to 10)
  preDelay: number;       // ms (0 to 500)
  diffusion: number;      // % (0 to 100)
  density: number;        // % (0 to 100)
  hpf: number;            // Hz
  lpf: number;            // Hz
  mix: number;            // % wet (0 to 100)
}

export interface DelaySettings {
  time: number;           // ms or bpm-synced
  feedback: number;       // % (0 to 100)
  hpf: number;
  lpf: number;
  mix: number;
}

export interface EffectSend {
  effectBusId: string;
  level: number;          // dB (-inf to +10)
  preFader: boolean;
}

// ============================================================================
// Routing
// ============================================================================

export interface PatchPoint {
  type: 'local' | 'dante' | 'aes' | 'madi' | 'stagebox' | 'tio' | 'rio';
  port: number;
  label?: string;
}

export interface BusSend {
  busId: string;
  level: number;          // dB
  preFader: boolean;
  pan?: number;           // -100 to +100 (for stereo buses)
}

export interface DirectOut {
  enabled: boolean;
  destination: PatchPoint;
  level: number;
  preFader: boolean;
}

// ============================================================================
// Channel
// ============================================================================

export interface Channel {
  id: string;
  number: number;
  name: string;
  shortName?: string;     // 4-8 char for console display
  type: ChannelType;
  color: ChannelColor;
  icon?: string;          // Optional icon identifier

  // Source
  input: {
    source: PatchPoint;
    inputType: InputType;
    phantomPower: PhantomPower;
    phase: boolean;       // Phase invert
    gain: number;         // dB (typically -12 to +60 for preamp)
    pad?: boolean;        // -20dB or -26dB pad
  };

  // Processing
  eq: EQSettings;
  dynamics: DynamicsSettings;

  // Levels
  fader: number;          // dB (-inf to +10)
  mute: boolean;
  solo?: boolean;
  pan: number;            // -100 (L) to +100 (R)

  // Routing
  assignedToMain: boolean;
  busSends: BusSend[];
  effectSends: EffectSend[];
  directOut?: DirectOut;

  // DCA/VCA Assignment
  dcaAssignments: string[];

  // Metadata
  notes?: string;
  category?: string;      // 'drums', 'bass', 'guitars', 'keys', 'vocals', etc.
}

// ============================================================================
// Buses (Aux, Group, Matrix)
// ============================================================================

export type BusType = 'aux' | 'group' | 'matrix' | 'main';

export interface Bus {
  id: string;
  number: number;
  name: string;
  shortName?: string;
  type: BusType;
  color: ChannelColor;
  stereo: boolean;

  // Processing
  eq: EQSettings;
  dynamics?: DynamicsSettings;

  // Levels
  fader: number;
  mute: boolean;

  // Output routing
  output?: PatchPoint;

  // Metadata
  purpose?: string;       // 'monitor', 'iem', 'subgroup', 'fx', 'record', etc.
}

// ============================================================================
// DCA/VCA
// ============================================================================

export interface DCA {
  id: string;
  number: number;
  name: string;
  shortName?: string;
  color: ChannelColor;
  fader: number;
  mute: boolean;
}

// ============================================================================
// Effect Processors
// ============================================================================

export interface EffectProcessor {
  id: string;
  name: string;
  type: EffectType;
  settings: ReverbSettings | DelaySettings | Record<string, unknown>;
  inputSource: 'bus' | 'insert';
  returnLevel: number;
}

// ============================================================================
// Scene/Snapshot
// ============================================================================

export interface Scene {
  id: string;
  name: string;
  number: number;
  channels: Channel[];
  buses: Bus[];
  dcas: DCA[];
  effects: EffectProcessor[];
  notes?: string;
}

// ============================================================================
// Stagebox / IO Configuration
// ============================================================================

export type StageboxModel =
  | 'yamaha-rio1608-d' | 'yamaha-rio1608-d2' | 'yamaha-rio3224-d' | 'yamaha-rio3224-d2'
  | 'yamaha-tio1608-d' | 'midas-dl16' | 'midas-dl32' | 'midas-dl251'
  | 'allen-heath-dx168' | 'allen-heath-dx164-w' | 'allen-heath-ar2412'
  | 'digico-sd-rack' | 'd-rack' | 'custom';

export interface Stagebox {
  id: string;
  model: StageboxModel;
  name: string;
  inputCount: number;
  outputCount: number;
  danteStartChannel?: number;
  aesStartChannel?: number;
  madiStartChannel?: number;
}

// ============================================================================
// Console Configuration
// ============================================================================

export type ConsoleManufacturer = 'yamaha' | 'behringer' | 'midas' | 'allen-heath' | 'digico' | 'soundcraft';
export type ConsoleModel =
  // Yamaha
  | 'cl1' | 'cl3' | 'cl5' | 'ql1' | 'ql5' | 'tf1' | 'tf3' | 'tf5' | 'pm5d' | 'pm10' | 'rivage-pm3' | 'rivage-pm5' | 'rivage-pm7' | 'rivage-pm10'
  // Behringer/Midas
  | 'x32' | 'x32-compact' | 'x32-producer' | 'x32-rack' | 'm32' | 'm32r' | 'm32c'
  // Allen & Heath
  | 'dlive-s3000' | 'dlive-s5000' | 'dlive-s7000' | 'dlive-c1500' | 'dlive-c2500' | 'dlive-c3500' | 'avantis' | 'sq-5' | 'sq-6' | 'sq-7'
  // DiGiCo
  | 'sd7' | 'sd10' | 'sd12' | 'sd5' | 'quantum-225' | 'quantum-338' | 'quantum-7'
  // Generic
  | 'custom';

export interface ConsoleConfig {
  manufacturer: ConsoleManufacturer;
  model: ConsoleModel;
  inputChannelCount: number;
  stereInputCount: number;
  mixBusCount: number;
  matrixCount: number;
  dcaCount: number;
  effectRackCount: number;
  stageboxes: Stagebox[];
}

// ============================================================================
// Gig / Show Information
// ============================================================================

export type Genre =
  | 'rock' | 'pop' | 'metal' | 'jazz' | 'folk' | 'acoustic' | 'classical'
  | 'hiphop' | 'electronic' | 'country' | 'blues' | 'gospel' | 'worship'
  | 'reggae' | 'latin' | 'world' | 'theater' | 'corporate' | 'podcast'
  | 'broadcast' | 'other';

export interface Artist {
  name: string;
  genre: Genre[];
  notes?: string;
}

export interface Venue {
  name: string;
  type: 'club' | 'theater' | 'arena' | 'outdoor' | 'church' | 'studio' | 'corporate' | 'other';
  capacity?: number;
  notes?: string;
}

export interface GigInfo {
  id: string;
  name: string;
  date: string;           // ISO date
  artist: Artist;
  venue: Venue;
  notes?: string;
}

// ============================================================================
// Universal Mix (Root Document)
// ============================================================================

export interface UniversalMix {
  // Metadata
  version: '1.0';
  id: string;
  createdAt: string;      // ISO datetime
  updatedAt: string;
  createdBy: string;

  // Gig info
  gig: GigInfo;

  // Console configuration
  console: ConsoleConfig;

  // Current scene
  currentScene: Scene;

  // Additional scenes
  scenes?: Scene[];

  // Global settings
  globalSettings?: {
    sampleRate: 44100 | 48000 | 96000;
    wordClockSource: 'internal' | 'dante' | 'aes' | 'madi';
    recallSafe?: string[];  // Channel IDs that are recall-safe
  };

  // AI processing notes
  aiNotes?: {
    genreRecommendations: string[];
    processingDecisions: string[];
    warnings: string[];
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultEQ(): EQSettings {
  return {
    enabled: true,
    bands: [
      { enabled: false, type: 'lowshelf', frequency: 100, gain: 0, q: 1 },
      { enabled: false, type: 'parametric', frequency: 400, gain: 0, q: 1 },
      { enabled: false, type: 'parametric', frequency: 2000, gain: 0, q: 1 },
      { enabled: false, type: 'highshelf', frequency: 8000, gain: 0, q: 1 },
    ],
    highPassFilter: { enabled: false, frequency: 80, slope: 18 },
  };
}

export function createDefaultGate(): GateSettings {
  return {
    enabled: false,
    threshold: -40,
    range: 40,
    attack: 1,
    hold: 50,
    release: 200,
  };
}

export function createDefaultCompressor(): CompressorSettings {
  return {
    enabled: false,
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 'soft',
    makeupGain: 0,
    autoMakeup: false,
  };
}

export function createDefaultChannel(number: number, name: string): Channel {
  return {
    id: `ch-${number}`,
    number,
    name,
    shortName: name.substring(0, 6),
    type: 'mono',
    color: { name: 'white' },
    input: {
      source: { type: 'local', port: number },
      inputType: 'mic',
      phantomPower: 'off',
      phase: false,
      gain: 0,
    },
    eq: createDefaultEQ(),
    dynamics: {
      gate: createDefaultGate(),
      compressor: createDefaultCompressor(),
    },
    fader: -96,
    mute: false,
    pan: 0,
    assignedToMain: true,
    busSends: [],
    effectSends: [],
    dcaAssignments: [],
  };
}

export function createEmptyMix(gigName: string): UniversalMix {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    createdBy: 'gig-prepper',
    gig: {
      id: crypto.randomUUID(),
      name: gigName,
      date: now.split('T')[0],
      artist: { name: '', genre: [] },
      venue: { name: '', type: 'other' },
    },
    console: {
      manufacturer: 'yamaha',
      model: 'ql1',
      inputChannelCount: 32,
      stereInputCount: 8,
      mixBusCount: 16,
      matrixCount: 8,
      dcaCount: 8,
      effectRackCount: 8,
      stageboxes: [],
    },
    currentScene: {
      id: 'scene-1',
      name: 'Main',
      number: 1,
      channels: [],
      buses: [],
      dcas: [],
      effects: [],
    },
  };
}

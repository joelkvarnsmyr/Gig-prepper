/**
 * Universal Mix Data Model v2.0
 *
 * Komplett datamodell för mixerkonsoler med stöd för:
 * - Kanaler med full processing (EQ, Dynamics, Inserts)
 * - Effekt-rack (Reverb, Delay, Modulation, etc.)
 * - GEQ (Grafisk EQ)
 * - Routing (bussar, matriser, direktutgångar)
 * - Scener och snapshots
 *
 * Adaptern avgör vad som blir maskinläsbar fil vs dokumentation.
 */

// ============================================================================
// BASIC TYPES
// ============================================================================

export type ChannelType = 'mono' | 'stereo' | 'group' | 'aux' | 'matrix' | 'main';
export type InputType = 'mic' | 'line' | 'di' | 'digital' | 'usb' | 'dante' | 'aes' | 'madi';
export type PhantomPower = 'on' | 'off' | 'auto';

export interface ChannelColor {
  name: string;
  hex?: string;
}

// ============================================================================
// EQ SETTINGS (Parametrisk + HPF/LPF)
// ============================================================================

export type EQBandType = 'highpass' | 'lowshelf' | 'parametric' | 'highshelf' | 'lowpass' | 'notch' | 'bandpass';
export type EQSlope = 6 | 12 | 18 | 24 | 36 | 48;

export interface EQBand {
  enabled: boolean;
  type: EQBandType;
  frequency: number;      // Hz (20-20000)
  gain: number;           // dB (-15 to +15)
  q: number;              // Q factor (0.1 to 16)
}

export interface EQSettings {
  enabled: boolean;
  bands: EQBand[];        // Typically 4 bands for channel EQ
  highPassFilter: {
    enabled: boolean;
    frequency: number;    // Hz (20-600)
    slope: EQSlope;       // dB/octave
  };
  lowPassFilter?: {
    enabled: boolean;
    frequency: number;    // Hz (1000-20000)
    slope: EQSlope;
  };
}

// ============================================================================
// GRAPHIC EQ (31-band or 1/3 octave)
// ============================================================================

export interface GEQBand {
  frequency: number;      // Center frequency in Hz
  gain: number;           // dB (-15 to +15)
}

export interface GEQSettings {
  enabled: boolean;
  bands: GEQBand[];       // 31 bands for 1/3 octave
  outputGain: number;     // Master output gain
}

// Create default 31-band GEQ frequencies
export const GEQ_FREQUENCIES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

// ============================================================================
// DYNAMICS (Gate + Compressor + De-esser)
// ============================================================================

export type GateMode = 'gate' | 'duck' | 'expand';
export type CompressorKnee = 'hard' | 'medium' | 'soft';
export type CompressorMode = 'comp' | 'expand' | 'gate' | 'duck' | 'de-ess';
export type DetectorType = 'peak' | 'rms';

export interface GateSettings {
  enabled: boolean;
  mode: GateMode;
  threshold: number;      // dB (-80 to 0)
  range: number;          // dB (0 to 80)
  attack: number;         // ms (0.05 to 120)
  hold: number;           // ms (0.02 to 2000)
  release: number;        // ms (5 to 5000)
  keyFilter?: {
    enabled: boolean;
    frequency: number;    // Hz
    q: number;
    solo: boolean;        // Key listen
  };
}

export interface CompressorSettings {
  enabled: boolean;
  mode: CompressorMode;
  threshold: number;      // dB (-60 to 0)
  ratio: number;          // 1:1 to infinity (20 = inf)
  attack: number;         // ms (0.05 to 120)
  release: number;        // ms (5 to 5000)
  knee: CompressorKnee;
  makeupGain: number;     // dB (0 to 30)
  autoMakeup: boolean;
  detector: DetectorType;
  mix?: number;           // Parallel compression (0-100%)
}

export interface DeEsserSettings {
  enabled: boolean;
  frequency: number;      // Hz (2000-15000)
  threshold: number;      // dB
  ratio: number;
  q: number;
}

export interface DynamicsSettings {
  gate: GateSettings;
  compressor: CompressorSettings;
  deEsser?: DeEsserSettings;
}

// ============================================================================
// EFFECTS - Detailed Parameters
// ============================================================================

export type EffectCategory = 'reverb' | 'delay' | 'modulation' | 'pitch' | 'distortion' | 'dynamics' | 'eq' | 'misc';

// --- REVERB TYPES ---
export type ReverbAlgorithm =
  | 'rev-x-hall' | 'rev-x-room' | 'rev-x-plate'
  | 'spx-hall' | 'spx-room' | 'spx-stage' | 'spx-plate'
  | 'r3-hall' | 'r3-room' | 'r3-plate' | 'r3-chamber'
  | 'hd-hall' | 'hd-room' | 'hd-plate'
  | 'vintage-plate' | 'vintage-spring'
  | 'ambience' | 'early-ref' | 'gate-reverb';

export interface ReverbSettings {
  algorithm: ReverbAlgorithm;
  time: number;           // Decay time in seconds (0.1-30)
  preDelay: number;       // ms (0-500)
  size: number;           // Room size (0-100%)
  diffusion: number;      // (0-100%)
  density: number;        // (0-100%)
  hpf: number;            // Hz - high pass on reverb
  lpf: number;            // Hz - low pass on reverb
  erLevel: number;        // Early reflections level (dB)
  tailLevel: number;      // Reverb tail level (dB)
  modDepth?: number;      // Modulation depth (0-100%)
  modSpeed?: number;      // Modulation speed (Hz)
  mix: number;            // Wet/Dry (0-100%)
}

// --- DELAY TYPES ---
export type DelayAlgorithm =
  | 'mono-delay' | 'stereo-delay' | 'ping-pong'
  | 'tape-delay' | 'analog-delay' | 'modulated-delay'
  | 'tempo-delay' | 'multi-tap' | 'reverse-delay'
  | 'ducking-delay' | 'slapback';

export type DelaySync = 'ms' | '1/4' | '1/8' | '1/8d' | '1/8t' | '1/16' | '1/16d' | '1/16t' | '1/32';

export interface DelaySettings {
  algorithm: DelayAlgorithm;
  timeLeft: number;       // ms or note value
  timeRight: number;      // ms or note value (for stereo)
  sync: DelaySync;        // Time sync mode
  feedback: number;       // % (0-100)
  feedbackHPF: number;    // Hz
  feedbackLPF: number;    // Hz
  crossFeedback?: number; // For ping-pong (0-100%)
  modDepth?: number;
  modSpeed?: number;
  duckLevel?: number;     // For ducking delay (dB)
  mix: number;
}

// --- MODULATION TYPES ---
export type ModulationAlgorithm =
  | 'chorus' | 'flanger' | 'phaser' | 'tremolo'
  | 'vibrato' | 'rotary' | 'auto-pan' | 'ring-mod'
  | 'ensemble' | 'symphonic';

export interface ModulationSettings {
  algorithm: ModulationAlgorithm;
  speed: number;          // Hz or BPM
  depth: number;          // (0-100%)
  feedback?: number;      // For flanger/phaser
  waveform?: 'sine' | 'triangle' | 'square';
  phase?: number;         // Stereo phase offset (0-180°)
  mix: number;
}

// --- PITCH TYPES ---
export type PitchAlgorithm = 'pitch-shift' | 'harmony' | 'octaver' | 'detune';

export interface PitchSettings {
  algorithm: PitchAlgorithm;
  pitch: number;          // Semitones (-12 to +12)
  fine: number;           // Cents (-50 to +50)
  delay: number;          // ms (0-1000)
  feedback?: number;
  formant?: boolean;      // Preserve formants
  mix: number;
}

// --- DISTORTION/SATURATION ---
export type DistortionAlgorithm =
  | 'tube' | 'tape' | 'transistor' | 'fuzz'
  | 'amp-sim' | 'speaker-sim' | 'exciter' | 'enhancer';

export interface DistortionSettings {
  algorithm: DistortionAlgorithm;
  drive: number;          // (0-100%)
  tone: number;           // Low-High balance
  output: number;         // Output level (dB)
  mix: number;
}

// --- UNIFIED EFFECT PROCESSOR ---
export interface EffectProcessor {
  id: string;
  slot: number;           // Rack slot (1-8 typically)
  name: string;
  category: EffectCategory;
  bypassed: boolean;

  // Specific settings based on category
  reverb?: ReverbSettings;
  delay?: DelaySettings;
  modulation?: ModulationSettings;
  pitch?: PitchSettings;
  distortion?: DistortionSettings;

  // I/O
  inputSource: 'bus' | 'insert' | 'mix-send';
  inputBus?: string;      // Bus ID if applicable
  returnLevel: number;    // dB
  returnDestination?: string; // Bus ID for return

  // Notes for documentation
  notes?: string;
  usageHint?: string;     // "Huvudreverb för sång", etc.
}

// ============================================================================
// PREMIUM RACK (Yamaha-specific but modeled universally)
// ============================================================================

export type PremiumRackType =
  | 'portico-5033-eq' | 'portico-5043-comp'
  | 'u76' | 'opt-2a' | 'eq-1a'
  | 'buss-comp-369' | 'channel-strip'
  | 'dynamic-eq' | 'de-esser'
  | 'open-deck' | 'vintage-tape';

export interface PremiumRackUnit {
  id: string;
  slot: number;           // 1-8
  type: PremiumRackType;
  name: string;
  bypassed: boolean;

  // Generic parameters (actual params depend on type)
  parameters: Record<string, number | boolean | string>;

  // Assignment
  assignedTo: string[];   // Channel/Bus IDs

  notes?: string;
}

// ============================================================================
// INSERT PROCESSING
// ============================================================================

export interface InsertPoint {
  enabled: boolean;
  position: 'pre-eq' | 'post-eq' | 'pre-fader' | 'post-fader';
  processor?: {
    type: 'internal' | 'external' | 'premium-rack';
    id: string;           // Reference to effect or premium rack
  };
}

// ============================================================================
// PATCH POINTS & ROUTING
// ============================================================================

export type PatchType = 'local' | 'dante' | 'aes' | 'madi' | 'stagebox' | 'tio' | 'rio' | 'usb';

export interface PatchPoint {
  type: PatchType;
  port: number;
  channel?: number;       // For multi-channel ports
  label?: string;
}

export interface BusSend {
  busId: string;
  level: number;          // dB (-inf to +10)
  pan?: number;           // -100 to +100 for stereo buses
  preFader: boolean;
  enabled: boolean;
}

export interface DirectOut {
  enabled: boolean;
  destination: PatchPoint;
  level: number;          // dB
  preFader: boolean;
  position: 'pre-eq' | 'post-eq' | 'pre-fader' | 'post-fader';
}

export interface EffectSend {
  effectId: string;       // Reference to EffectProcessor
  level: number;          // dB
  preFader: boolean;
  enabled: boolean;
}

// ============================================================================
// CHANNEL (Complete)
// ============================================================================

export interface Channel {
  id: string;
  number: number;
  name: string;
  shortName: string;      // Max 8 chars for console display
  type: ChannelType;
  color: ChannelColor;
  icon?: string;

  // Source / Input
  input: {
    source: PatchPoint;
    inputType: InputType;
    phantomPower: PhantomPower;
    phase: boolean;
    gain: number;         // dB (preamp gain)
    pad?: boolean;        // -20dB or -26dB pad
    hpfOnHA?: boolean;    // HPF on head amp (some consoles)
  };

  // Processing chain
  eq: EQSettings;
  dynamics: DynamicsSettings;
  insert1?: InsertPoint;
  insert2?: InsertPoint;

  // Levels & Routing
  fader: number;          // dB (-inf to +10)
  mute: boolean;
  solo?: boolean;
  pan: number;            // -100 (L) to +100 (R)
  width?: number;         // Stereo width (0-100%)

  // Output routing
  assignedToMain: boolean;
  busSends: BusSend[];
  effectSends: EffectSend[];
  directOut?: DirectOut;

  // DCA/VCA Assignment
  dcaAssignments: string[];
  muteGroups?: number[];

  // Metadata
  category?: string;      // 'vocals', 'strings', 'drums', etc.
  notes?: string;
  sourceDescription?: string; // "AKG C535 på Eva"
}

// ============================================================================
// BUS (Aux/Group/Matrix)
// ============================================================================

export type BusType = 'aux' | 'group' | 'matrix' | 'main';
export type BusPurpose = 'monitor' | 'iem' | 'subgroup' | 'fx-send' | 'record' | 'broadcast' | 'pa' | 'fill' | 'sub';

export interface Bus {
  id: string;
  number: number;
  name: string;
  shortName: string;
  type: BusType;
  stereo: boolean;
  color: ChannelColor;

  // Processing
  eq: EQSettings;
  geq?: GEQSettings;      // Many buses have GEQ
  dynamics?: DynamicsSettings;
  insert1?: InsertPoint;
  insert2?: InsertPoint;

  // Levels
  fader: number;
  mute: boolean;
  pan?: number;           // For mono buses sent to stereo

  // Output routing
  output?: PatchPoint;
  effectSends?: EffectSend[];

  // Metadata
  purpose?: BusPurpose;
  notes?: string;
  feedDescription?: string; // "John & Anna-Karins monitor"
}

// ============================================================================
// DCA / VCA
// ============================================================================

export interface DCA {
  id: string;
  number: number;
  name: string;
  shortName: string;
  color: ChannelColor;
  fader: number;
  mute: boolean;

  // What's assigned
  assignedChannels: string[];
  notes?: string;
}

// ============================================================================
// MUTE GROUPS
// ============================================================================

export interface MuteGroup {
  id: string;
  number: number;
  name: string;
  enabled: boolean;
  assignedChannels: string[];
  assignedBuses: string[];
}

// ============================================================================
// SCENE / SNAPSHOT
// ============================================================================

export interface Scene {
  id: string;
  number: number;
  name: string;
  comment?: string;

  // All scene data
  channels: Channel[];
  buses: Bus[];
  dcas: DCA[];
  muteGroups?: MuteGroup[];
  effects: EffectProcessor[];
  premiumRack?: PremiumRackUnit[];

  // Recall safe lists
  recallSafeChannels?: string[];
  recallSafeBuses?: string[];
  recallSafeParams?: string[]; // 'eq', 'dynamics', 'fader', etc.

  // Focus/filter for this scene
  focusChannels?: string[];

  notes?: string;
}

// ============================================================================
// STAGEBOX / I/O CONFIGURATION
// ============================================================================

export type StageboxModel =
  | 'yamaha-rio1608-d' | 'yamaha-rio1608-d2'
  | 'yamaha-rio3224-d' | 'yamaha-rio3224-d2'
  | 'yamaha-tio1608-d'
  | 'midas-dl16' | 'midas-dl32' | 'midas-dl251'
  | 'allen-heath-dx168' | 'allen-heath-ar2412'
  | 'digico-sd-rack'
  | 'custom';

export interface Stagebox {
  id: string;
  model: StageboxModel;
  name: string;
  location?: string;      // "Stage Left", "FOH", etc.
  inputCount: number;
  outputCount: number;
  danteStartChannel?: number;
  aesStartChannel?: number;
  notes?: string;
}

// ============================================================================
// CONSOLE CONFIGURATION
// ============================================================================

export type ConsoleManufacturer = 'yamaha' | 'behringer' | 'midas' | 'allen-heath' | 'digico' | 'soundcraft';
export type ConsoleModel =
  // Yamaha
  | 'cl1' | 'cl3' | 'cl5' | 'ql1' | 'ql5'
  | 'tf1' | 'tf3' | 'tf5'
  | 'pm5d' | 'pm10'
  | 'rivage-pm3' | 'rivage-pm5' | 'rivage-pm7' | 'rivage-pm10'
  // Behringer/Midas
  | 'x32' | 'x32-compact' | 'x32-producer' | 'x32-rack'
  | 'm32' | 'm32r' | 'm32c'
  // Allen & Heath
  | 'dlive-s3000' | 'dlive-s5000' | 'dlive-s7000'
  | 'dlive-c1500' | 'dlive-c2500' | 'dlive-c3500'
  | 'avantis' | 'sq-5' | 'sq-6' | 'sq-7'
  // DiGiCo
  | 'sd7' | 'sd10' | 'sd12' | 'sd5'
  | 'quantum-225' | 'quantum-338' | 'quantum-7'
  | 'custom';

export interface ConsoleConfig {
  manufacturer: ConsoleManufacturer;
  model: ConsoleModel;
  firmwareVersion?: string;

  // Channel counts
  inputChannelCount: number;
  stereoInputCount: number;
  mixBusCount: number;
  matrixCount: number;
  dcaCount: number;

  // Effect resources
  effectRackCount: number;
  premiumRackCount?: number;  // Yamaha
  geqCount?: number;

  // I/O
  localInputs: number;
  localOutputs: number;
  stageboxes: Stagebox[];
}

// ============================================================================
// GIG / SHOW INFORMATION
// ============================================================================

export type Genre =
  | 'rock' | 'pop' | 'metal' | 'jazz' | 'folk' | 'acoustic' | 'classical'
  | 'hiphop' | 'electronic' | 'country' | 'blues' | 'gospel' | 'worship'
  | 'reggae' | 'latin' | 'world' | 'theater' | 'corporate' | 'podcast'
  | 'broadcast' | 'rnb' | 'funk' | 'punk' | 'indie' | 'dansband' | 'schlager'
  | 'singer-songwriter' | 'cinematic' | 'ska' | 'musical' | 'other';

export type VenueType = 'club' | 'theater' | 'arena' | 'outdoor' | 'church' | 'studio' | 'corporate' | 'festival' | 'other';

export interface Artist {
  name: string;
  genre: Genre[];
  members?: string[];
  technicalContact?: string;
  notes?: string;
}

export interface Venue {
  name: string;
  type: VenueType;
  capacity?: number;
  acousticNotes?: string; // "Lång efterklang", "Dämpad lokal"
  paSystem?: string;      // "L-Acoustics KARA", "Bose L1"
  monitorSystem?: string;
  notes?: string;
}

export interface GigInfo {
  id: string;
  name: string;
  date: string;           // ISO date
  loadIn?: string;        // ISO datetime
  soundcheck?: string;    // ISO datetime
  showStart?: string;     // ISO datetime

  artist: Artist;
  venue: Venue;

  fohEngineer?: string;
  monitorEngineer?: string;
  systemTech?: string;

  notes?: string;
}

// ============================================================================
// AI NOTES & RECOMMENDATIONS
// ============================================================================

export interface AIProcessingDecision {
  channel?: string;       // Channel ID
  category: 'eq' | 'dynamics' | 'effects' | 'routing' | 'general';
  decision: string;       // What was decided
  reasoning: string;      // Why
  confidence: 'high' | 'medium' | 'low';
}

export interface AINotes {
  genreRecommendations: string[];
  processingDecisions: AIProcessingDecision[];
  warnings: string[];
  suggestions: string[];
  mixPhilosophy?: string; // "Organiskt, varmt, dynamiskt"
}

// ============================================================================
// UNIVERSAL MIX (Root Document)
// ============================================================================

export interface UniversalMix {
  // Metadata
  version: '2.0';
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Gig info
  gig: GigInfo;

  // Console configuration
  console: ConsoleConfig;

  // Current active scene
  currentScene: Scene;

  // Additional scenes
  scenes?: Scene[];

  // Global settings
  globalSettings?: {
    sampleRate: 44100 | 48000 | 96000;
    wordClockSource: 'internal' | 'dante' | 'aes' | 'madi';
    oscillator?: {
      enabled: boolean;
      frequency: number;
      level: number;
    };
  };

  // AI processing notes
  aiNotes?: AINotes;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createDefaultEQ(): EQSettings {
  return {
    enabled: true,
    bands: [
      { enabled: false, type: 'lowshelf', frequency: 100, gain: 0, q: 1 },
      { enabled: false, type: 'parametric', frequency: 400, gain: 0, q: 2 },
      { enabled: false, type: 'parametric', frequency: 2500, gain: 0, q: 2 },
      { enabled: false, type: 'highshelf', frequency: 8000, gain: 0, q: 1 },
    ],
    highPassFilter: { enabled: false, frequency: 80, slope: 18 },
  };
}

export function createDefaultGate(): GateSettings {
  return {
    enabled: false,
    mode: 'gate',
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
    mode: 'comp',
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 'soft',
    makeupGain: 0,
    autoMakeup: false,
    detector: 'rms',
  };
}

export function createDefaultDynamics(): DynamicsSettings {
  return {
    gate: createDefaultGate(),
    compressor: createDefaultCompressor(),
  };
}

export function createDefaultChannel(number: number, name: string): Channel {
  return {
    id: `ch-${number}`,
    number,
    name,
    shortName: name.substring(0, 8),
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
    dynamics: createDefaultDynamics(),
    fader: -96,
    mute: false,
    pan: 0,
    assignedToMain: true,
    busSends: [],
    effectSends: [],
    dcaAssignments: [],
  };
}

export function createDefaultReverb(): ReverbSettings {
  return {
    algorithm: 'rev-x-hall',
    time: 1.8,
    preDelay: 25,
    size: 50,
    diffusion: 80,
    density: 70,
    hpf: 100,
    lpf: 8000,
    erLevel: -6,
    tailLevel: 0,
    mix: 100,
  };
}

export function createDefaultDelay(): DelaySettings {
  return {
    algorithm: 'stereo-delay',
    timeLeft: 350,
    timeRight: 350,
    sync: 'ms',
    feedback: 30,
    feedbackHPF: 200,
    feedbackLPF: 6000,
    mix: 100,
  };
}

export function createEmptyMix(gigName: string): UniversalMix {
  const now = new Date().toISOString();
  return {
    version: '2.0',
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
      id: 'scene-1',
      number: 1,
      name: 'Main',
      channels: [],
      buses: [],
      dcas: [],
      effects: [],
    },
  };
}

// ============================================================================
// GENRE PRESETS (For AI recommendations)
// ============================================================================

export interface GenrePreset {
  genre: Genre;
  mixPhilosophy: string;
  defaultReverb: Partial<ReverbSettings>;
  defaultDelay: Partial<DelaySettings>;
  vocalProcessing: {
    hpf: number;
    compression: Partial<CompressorSettings>;
    deEss: boolean;
  };
  drumProcessing?: {
    gateKick: boolean;
    gateSnare: boolean;
    gateThreshold: number;
  };
  masterProcessing?: {
    compression: boolean;
    limiter: boolean;
  };
}

export const GENRE_PRESETS: Record<Genre, GenrePreset> = {
  folk: {
    genre: 'folk',
    mixPhilosophy: 'Organiskt, varmt, dynamiskt. Minimal processing, naturlig klang.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.8, preDelay: 25 },
    defaultDelay: { algorithm: 'tape-delay', timeLeft: 280, feedback: 20 },
    vocalProcessing: { hpf: 100, compression: { ratio: 3, knee: 'soft', attack: 20 }, deEss: false },
  },
  acoustic: {
    genre: 'acoustic',
    mixPhilosophy: 'Transparent, luftigt, naturligt. Bevara instrumentens karaktär.',
    defaultReverb: { algorithm: 'rev-x-room', time: 1.2, preDelay: 15 },
    defaultDelay: { algorithm: 'analog-delay', timeLeft: 200, feedback: 15 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2.5, knee: 'soft', attack: 25 }, deEss: false },
  },
  jazz: {
    genre: 'jazz',
    mixPhilosophy: 'Naturligt, luftigt, dynamiskt. Ingen gate, minimal kompression.',
    defaultReverb: { algorithm: 'rev-x-room', time: 1.2, preDelay: 20 },
    defaultDelay: { algorithm: 'analog-delay', timeLeft: 250, feedback: 15 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2, knee: 'soft', attack: 30 }, deEss: false },
  },
  rock: {
    genre: 'rock',
    mixPhilosophy: 'Kraftfullt, energiskt, punchy. Kontrollerad dynamik.',
    defaultReverb: { algorithm: 'spx-plate', time: 1.2, preDelay: 10 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 320, feedback: 25 },
    vocalProcessing: { hpf: 120, compression: { ratio: 4, knee: 'medium', attack: 10 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -35 },
  },
  pop: {
    genre: 'pop',
    mixPhilosophy: 'Polerat, modernt, radio-ready. Konsekvent nivå.',
    defaultReverb: { algorithm: 'spx-plate', time: 1.0, preDelay: 15 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 280, feedback: 20 },
    vocalProcessing: { hpf: 100, compression: { ratio: 5, knee: 'medium', attack: 5 }, deEss: true },
  },
  metal: {
    genre: 'metal',
    mixPhilosophy: 'Tight, aggressivt, kraftfullt. Gate på trummor, hård kompression.',
    defaultReverb: { algorithm: 'spx-plate', time: 0.8, preDelay: 5 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 200, feedback: 15 },
    vocalProcessing: { hpf: 150, compression: { ratio: 8, knee: 'hard', attack: 1 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -25 },
  },
  classical: {
    genre: 'classical',
    mixPhilosophy: 'Naturligt, transparent, dynamiskt. Minimal processing.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 2.5, preDelay: 40 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 100, feedback: 5 },
    vocalProcessing: { hpf: 60, compression: { ratio: 1.5, knee: 'soft', attack: 50 }, deEss: false },
  },
  worship: {
    genre: 'worship',
    mixPhilosophy: 'Varmt, inkluderande, dynamiskt. Sång i fokus.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 2.0, preDelay: 30 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 350, feedback: 25 },
    vocalProcessing: { hpf: 100, compression: { ratio: 4, knee: 'soft', attack: 15 }, deEss: true },
  },
  gospel: {
    genre: 'gospel',
    mixPhilosophy: 'Varmt, kraftfullt, dynamiskt. Körer i fokus.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 2.2, preDelay: 35 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 400, feedback: 20 },
    vocalProcessing: { hpf: 90, compression: { ratio: 3.5, knee: 'soft', attack: 20 }, deEss: true },
  },
  electronic: {
    genre: 'electronic',
    mixPhilosophy: 'Tight, modernt, kraftfullt. Kontrollerad bas.',
    defaultReverb: { algorithm: 'spx-room', time: 0.8, preDelay: 10 },
    defaultDelay: { algorithm: 'ping-pong', timeLeft: 250, feedback: 30 },
    vocalProcessing: { hpf: 120, compression: { ratio: 6, knee: 'hard', attack: 3 }, deEss: true },
  },
  hiphop: {
    genre: 'hiphop',
    mixPhilosophy: 'Punchy, modern, kraftfull bas. Tydlig sång.',
    defaultReverb: { algorithm: 'spx-plate', time: 0.6, preDelay: 5 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 280, feedback: 20 },
    vocalProcessing: { hpf: 100, compression: { ratio: 5, knee: 'medium', attack: 5 }, deEss: true },
  },
  country: {
    genre: 'country',
    mixPhilosophy: 'Varmt, naturligt, storytelling. Sång och akustiska instrument i fokus.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.5, preDelay: 20 },
    defaultDelay: { algorithm: 'tape-delay', timeLeft: 320, feedback: 20 },
    vocalProcessing: { hpf: 90, compression: { ratio: 3, knee: 'soft', attack: 15 }, deEss: false },
  },
  blues: {
    genre: 'blues',
    mixPhilosophy: 'Rått, varmt, dynamiskt. Naturlig distorsion OK.',
    defaultReverb: { algorithm: 'spx-room', time: 1.0, preDelay: 15 },
    defaultDelay: { algorithm: 'analog-delay', timeLeft: 300, feedback: 20 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2.5, knee: 'soft', attack: 20 }, deEss: false },
  },
  reggae: {
    genre: 'reggae',
    mixPhilosophy: 'Dub-influerat, delay-tungt, kraftfull bas.',
    defaultReverb: { algorithm: 'spx-hall', time: 1.8, preDelay: 30 },
    defaultDelay: { algorithm: 'tape-delay', timeLeft: 375, feedback: 40 },
    vocalProcessing: { hpf: 100, compression: { ratio: 4, knee: 'soft', attack: 10 }, deEss: false },
  },
  latin: {
    genre: 'latin',
    mixPhilosophy: 'Levande, rytmiskt, percussion i fokus.',
    defaultReverb: { algorithm: 'spx-room', time: 1.0, preDelay: 15 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 200, feedback: 15 },
    vocalProcessing: { hpf: 100, compression: { ratio: 3, knee: 'medium', attack: 10 }, deEss: true },
  },
  world: {
    genre: 'world',
    mixPhilosophy: 'Autentiskt, naturligt, respektera traditionella instrument.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.5, preDelay: 25 },
    defaultDelay: { algorithm: 'analog-delay', timeLeft: 250, feedback: 15 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2, knee: 'soft', attack: 25 }, deEss: false },
  },
  theater: {
    genre: 'theater',
    mixPhilosophy: 'Tydligt tal, naturliga effekter, följ dramatiken.',
    defaultReverb: { algorithm: 'rev-x-room', time: 0.8, preDelay: 10 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 150, feedback: 10 },
    vocalProcessing: { hpf: 120, compression: { ratio: 4, knee: 'medium', attack: 5 }, deEss: true },
  },
  corporate: {
    genre: 'corporate',
    mixPhilosophy: 'Tydligt tal, konsekvent nivå, minimala effekter.',
    defaultReverb: { algorithm: 'ambience', time: 0.5, preDelay: 5 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 100, feedback: 5 },
    vocalProcessing: { hpf: 120, compression: { ratio: 5, knee: 'medium', attack: 3 }, deEss: true },
  },
  podcast: {
    genre: 'podcast',
    mixPhilosophy: 'Kristallklart tal, ingen rumskänsla, tight.',
    defaultReverb: { algorithm: 'ambience', time: 0.3, preDelay: 0 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 0, feedback: 0 },
    vocalProcessing: { hpf: 80, compression: { ratio: 4, knee: 'soft', attack: 10 }, deEss: true },
  },
  broadcast: {
    genre: 'broadcast',
    mixPhilosophy: 'Konsekvent, tydligt, broadcast-standard.',
    defaultReverb: { algorithm: 'ambience', time: 0.4, preDelay: 5 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 0, feedback: 0 },
    vocalProcessing: { hpf: 100, compression: { ratio: 6, knee: 'medium', attack: 2 }, deEss: true },
    masterProcessing: { compression: true, limiter: true },
  },
  rnb: {
    genre: 'rnb',
    mixPhilosophy: 'Slät, varm, groovy. Sång i fokus med luftig känsla. Tight bas.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.6, preDelay: 25 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 300, feedback: 25 },
    vocalProcessing: { hpf: 90, compression: { ratio: 4, knee: 'soft', attack: 8 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -35 },
  },
  funk: {
    genre: 'funk',
    mixPhilosophy: 'Tight, groovy, punchy. Bas och trummor i fokus. Dynamiskt.',
    defaultReverb: { algorithm: 'spx-room', time: 0.8, preDelay: 10 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 200, feedback: 15 },
    vocalProcessing: { hpf: 100, compression: { ratio: 3.5, knee: 'medium', attack: 8 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -30 },
  },
  punk: {
    genre: 'punk',
    mixPhilosophy: 'Rått, energiskt, i ansiktet. Minimal processing, naturlig aggression.',
    defaultReverb: { algorithm: 'spx-room', time: 0.6, preDelay: 5 },
    defaultDelay: { algorithm: 'slapback', timeLeft: 100, feedback: 10 },
    vocalProcessing: { hpf: 150, compression: { ratio: 6, knee: 'hard', attack: 2 }, deEss: false },
    drumProcessing: { gateKick: false, gateSnare: false, gateThreshold: -40 },
  },
  indie: {
    genre: 'indie',
    mixPhilosophy: 'Organiskt, texturerat, atmosfäriskt. Rum och djup.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 2.0, preDelay: 30 },
    defaultDelay: { algorithm: 'tape-delay', timeLeft: 350, feedback: 30 },
    vocalProcessing: { hpf: 100, compression: { ratio: 3, knee: 'soft', attack: 15 }, deEss: false },
    drumProcessing: { gateKick: false, gateSnare: false, gateThreshold: -40 },
  },
  dansband: {
    genre: 'dansband',
    mixPhilosophy: 'Polerat, dansbart, sång i centrum. Tydlig bas, glittrande tops.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.8, preDelay: 25 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 350, feedback: 20 },
    vocalProcessing: { hpf: 100, compression: { ratio: 4, knee: 'soft', attack: 10 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -35 },
  },
  schlager: {
    genre: 'schlager',
    mixPhilosophy: 'Brett, inbjudande, lättlyssnat. Sång och melodi i fokus.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 2.0, preDelay: 30 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 320, feedback: 20 },
    vocalProcessing: { hpf: 90, compression: { ratio: 3.5, knee: 'soft', attack: 12 }, deEss: true },
  },
  'singer-songwriter': {
    genre: 'singer-songwriter',
    mixPhilosophy: 'Intimt, ärligt, storytelling. Sång och gitarr i fokus.',
    defaultReverb: { algorithm: 'rev-x-room', time: 1.4, preDelay: 20 },
    defaultDelay: { algorithm: 'tape-delay', timeLeft: 280, feedback: 18 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2.5, knee: 'soft', attack: 20 }, deEss: false },
  },
  cinematic: {
    genre: 'cinematic',
    mixPhilosophy: 'Episkt, atmosfäriskt, brett. Stort soundscape, dynamik.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 3.0, preDelay: 50 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 500, feedback: 35 },
    vocalProcessing: { hpf: 80, compression: { ratio: 2, knee: 'soft', attack: 30 }, deEss: false },
  },
  ska: {
    genre: 'ska',
    mixPhilosophy: 'Energiskt, offbeat-fokus, brass i centrum. Tight rytmsektion.',
    defaultReverb: { algorithm: 'spx-room', time: 0.9, preDelay: 12 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 250, feedback: 15 },
    vocalProcessing: { hpf: 120, compression: { ratio: 4, knee: 'medium', attack: 8 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -32 },
  },
  musical: {
    genre: 'musical',
    mixPhilosophy: 'Teatralt, tydligt tal/sång, följ dramatiken. Dynamisk nivåhantering.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.5, preDelay: 20 },
    defaultDelay: { algorithm: 'mono-delay', timeLeft: 180, feedback: 12 },
    vocalProcessing: { hpf: 100, compression: { ratio: 5, knee: 'medium', attack: 5 }, deEss: true },
    drumProcessing: { gateKick: true, gateSnare: true, gateThreshold: -35 },
  },
  other: {
    genre: 'other',
    mixPhilosophy: 'Anpassa efter situation.',
    defaultReverb: { algorithm: 'rev-x-hall', time: 1.5, preDelay: 20 },
    defaultDelay: { algorithm: 'stereo-delay', timeLeft: 300, feedback: 20 },
    vocalProcessing: { hpf: 100, compression: { ratio: 3, knee: 'soft', attack: 15 }, deEss: false },
  },
};

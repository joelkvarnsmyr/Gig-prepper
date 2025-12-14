/**
 * Behringer X32 / Midas M32 Adapter
 *
 * Genererar .scn (scene) filer för X32/M32 konsoler.
 * Detta format stöder full export av alla inställningar.
 */

import {
  ConsoleAdapter,
  AdapterInfo,
  ExportResult,
  ExportFile,
  ValidationResult,
  registerAdapter,
  truncateName,
} from '../base-adapter';
import {
  UniversalMix,
  Channel,
  Bus,
  DCA,
  EffectProcessor,
  ConsoleModel,
  Genre,
  GENRE_PRESETS,
} from '../../models/universal-mix';

// ============================================================================
// X32 Color Indices
// ============================================================================

const X32_COLOR_MAP: Record<string, number> = {
  off: 0,
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  orange: 1, // Map to red (closest)
  pink: 5, // Map to magenta
  purple: 5, // Map to magenta
  lime: 2, // Map to green
};

// ============================================================================
// X32 Icon Numbers
// ============================================================================

const X32_ICON_MAP: Record<string, number> = {
  // Default
  'Blank': 1,
  'Inst': 1,
  // Microphones
  'Dynamic': 2,
  'Condenser': 3,
  'Headset': 4,
  // Instruments
  'A.Guitar': 5,
  'E.Guitar': 6,
  'E.Bass': 7,
  'Piano': 8,
  'Keyboard': 9,
  'Strings': 10,
  'Trumpet': 11,
  'Sax': 12,
  // Drums
  'Drums': 13,
  'Kick': 14,
  'Snare': 15,
  'Hi-Hat': 16,
  'Hi-Tom': 17,
  'Ride': 18,
  // Percussion
  'Conga': 19,
  'Perc.': 20,
  // Vocals
  'Male': 21,
  'Female': 22,
  // Other
  'Media1': 60,
  'Wedge': 70,
  'Speaker': 71,
  'Fader': 72,
  'DI': 73,
  'Podium': 74,
  'Audience': 75,
};

// ============================================================================
// X32 Source Types
// ============================================================================

function getX32Source(channel: Channel): string {
  const source = channel.input?.source;
  if (!source) return 'IN';

  switch (source.type) {
    case 'local':
      return `IN ${source.port.toString().padStart(2, '0')}`;
    case 'aes':
      return `AES50A ${source.port.toString().padStart(2, '0')}`;
    case 'dante':
    case 'tio':
    case 'rio':
      return `AES50A ${source.port.toString().padStart(2, '0')}`;
    case 'usb':
      return `USB ${source.port.toString().padStart(2, '0')}`;
    default:
      return `IN ${(channel.number).toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// Scene File Generator
// ============================================================================

function generateSceneFile(mix: UniversalMix): string {
  const lines: string[] = [];

  // Scene header
  lines.push('#2.1# X32 Scene');
  lines.push(`/scene/name "${truncateName(mix.gig.name || 'GigPrepper', 12)}"`);
  lines.push('/scene/notes ""');
  lines.push('');

  // Config section
  lines.push('/config/chlink 0x0000');
  lines.push('/config/auxlink 0x00');
  lines.push('/config/buslink 0x0000');
  lines.push('/config/mtxlink 0x00');
  lines.push('/config/mute 0');
  lines.push('/config/linkcfg OFF OFF OFF OFF');
  lines.push('');

  // Channels (01-32)
  for (let i = 1; i <= 32; i++) {
    const channel = mix.currentScene.channels.find(ch => ch.number === i);
    lines.push(...generateChannelSection(i, channel));
    lines.push('');
  }

  // Aux Inputs (01-08)
  for (let i = 1; i <= 8; i++) {
    lines.push(...generateAuxInSection(i));
  }

  // Mix Buses (01-16)
  const mixBuses = mix.currentScene.buses.filter(b => b.type === 'aux');
  for (let i = 1; i <= 16; i++) {
    const bus = mixBuses.find(b => b.number === i);
    lines.push(...generateBusSection(i, bus));
    lines.push('');
  }

  // Matrix (01-06)
  const matrices = mix.currentScene.buses.filter(b => b.type === 'matrix');
  for (let i = 1; i <= 6; i++) {
    const matrix = matrices.find(m => m.number === i);
    lines.push(...generateMatrixSection(i, matrix));
    lines.push('');
  }

  // Main Stereo
  lines.push(...generateMainSection());
  lines.push('');

  // Mono/Center
  lines.push(...generateMonoSection());
  lines.push('');

  // DCAs (1-8)
  for (let i = 1; i <= 8; i++) {
    const dca = mix.currentScene.dcas.find(d => d.number === i);
    lines.push(...generateDCASection(i, dca));
  }
  lines.push('');

  // Effects (1-8)
  for (let i = 1; i <= 8; i++) {
    const fx = mix.currentScene.effects.find(e => e.slot === i);
    lines.push(...generateEffectSection(i, fx));
  }

  return lines.join('\n');
}

function generateChannelSection(num: number, channel?: Channel): string[] {
  const lines: string[] = [];
  const prefix = `/ch/${num.toString().padStart(2, '0')}`;

  if (!channel) {
    // Empty channel defaults
    lines.push(`${prefix}/config "" 1 GN 1`);
    lines.push(`${prefix}/preamp -12.0 OFF OFF 0`);
    lines.push(`${prefix}/gate OFF EXP2 -80.0 60.0 1 500 2000 0`);
    lines.push(`${prefix}/dyn OFF COMP RMS LIN 0.0 3.0 1 10.0 10.0 150 1 0.0 OFF 100`);
    lines.push(`${prefix}/insert OFF OFF POST`);
    lines.push(`${prefix}/eq ON`);
    lines.push(`${prefix}/eq/1 PEQ 100.0 1.000 0.00`);
    lines.push(`${prefix}/eq/2 PEQ 400.0 2.000 0.00`);
    lines.push(`${prefix}/eq/3 PEQ 1600.0 2.000 0.00`);
    lines.push(`${prefix}/eq/4 HShv 6300.0 2.000 0.00`);
    lines.push(`${prefix}/mix ON 0.0 OFF -oo ST 0`);
    lines.push(`${prefix}/grp 0x0000 0x00`);
    lines.push(`${prefix}/automix OFF 0`);
    return lines;
  }

  // Channel configuration
  const name = truncateName(channel.shortName || channel.name, 12);
  const icon = X32_ICON_MAP[channel.icon || 'Blank'] || 1;
  const color = X32_COLOR_MAP[channel.color?.name?.toLowerCase() || 'white'] || 7;
  const source = getX32Source(channel);

  lines.push(`${prefix}/config "${name}" ${icon} ${color} ${source}`);

  // Head amp / preamp
  const gain = channel.input?.gain ?? 0;
  const phantom = channel.input?.phantomPower === 'on' ? 'ON' : 'OFF';
  const pad = channel.input?.pad ? 'ON' : 'OFF';
  lines.push(`${prefix}/preamp ${gain.toFixed(1)} ${phantom} ${pad} 0`);

  // Gate
  if (channel.dynamics?.gate?.enabled) {
    const g = channel.dynamics.gate;
    lines.push(`${prefix}/gate ON EXP2 ${g.threshold.toFixed(1)} ${g.range.toFixed(1)} ${g.attack} ${g.hold} ${g.release} 0`);
  } else {
    lines.push(`${prefix}/gate OFF EXP2 -80.0 60.0 1 500 2000 0`);
  }

  // Dynamics (Compressor)
  if (channel.dynamics?.compressor?.enabled) {
    const c = channel.dynamics.compressor;
    const ratio = c.ratio >= 20 ? 'LIM' : c.ratio.toFixed(1);
    const knee = c.knee === 'hard' ? 'LOG' : 'LIN';
    const makeup = c.autoMakeup ? c.makeupGain : 0;
    lines.push(`${prefix}/dyn ON COMP RMS ${knee} ${c.threshold.toFixed(1)} ${ratio} 1 ${c.attack.toFixed(1)} 10.0 ${c.release} 1 ${makeup.toFixed(1)} OFF 100`);
  } else {
    lines.push(`${prefix}/dyn OFF COMP RMS LIN 0.0 3.0 1 10.0 10.0 150 1 0.0 OFF 100`);
  }

  // Insert
  lines.push(`${prefix}/insert OFF OFF POST`);

  // EQ
  const hpfEnabled = channel.eq?.highPassFilter?.enabled ? 'ON' : 'OFF';
  lines.push(`${prefix}/eq ${hpfEnabled}`);

  // EQ bands (simplified - use defaults with frequency adjustments)
  const hpfFreq = channel.eq?.highPassFilter?.frequency || 80;
  const bands = channel.eq?.bands || [];

  lines.push(`${prefix}/eq/1 PEQ ${bands[0]?.frequency || 100.0} ${bands[0]?.q || 1.000} ${(bands[0]?.gain || 0).toFixed(2)}`);
  lines.push(`${prefix}/eq/2 PEQ ${bands[1]?.frequency || 400.0} ${bands[1]?.q || 2.000} ${(bands[1]?.gain || 0).toFixed(2)}`);
  lines.push(`${prefix}/eq/3 PEQ ${bands[2]?.frequency || 1600.0} ${bands[2]?.q || 2.000} ${(bands[2]?.gain || 0).toFixed(2)}`);
  lines.push(`${prefix}/eq/4 HShv ${bands[3]?.frequency || 6300.0} ${bands[3]?.q || 2.000} ${(bands[3]?.gain || 0).toFixed(2)}`);

  // Mix settings
  const mute = channel.mute ? 'OFF' : 'ON';
  const fader = channel.fader <= -90 ? '-oo' : channel.fader.toFixed(1);
  const pan = channel.pan ?? 0;
  const panStr = pan === 0 ? 'C' : (pan > 0 ? `R${Math.abs(pan)}` : `L${Math.abs(pan)}`);
  lines.push(`${prefix}/mix ${mute} ${fader} OFF -oo ST ${pan}`);

  // Group assignments (DCA)
  let dcaBits = 0;
  for (const dcaId of channel.dcaAssignments || []) {
    // Parse DCA number from ID like "dca-1" or just use numeric value
    const match = dcaId.match(/(\d+)/);
    const dcaNum = match ? parseInt(match[1], 10) : 0;
    if (dcaNum >= 1 && dcaNum <= 8) {
      dcaBits |= (1 << (dcaNum - 1));
    }
  }
  lines.push(`${prefix}/grp 0x${dcaBits.toString(16).padStart(4, '0')} 0x00`);

  // Automix
  lines.push(`${prefix}/automix OFF 0`);

  return lines;
}

function generateAuxInSection(num: number): string[] {
  const prefix = `/auxin/${num.toString().padStart(2, '0')}`;
  return [
    `${prefix}/config "" 1 GN AUX ${num}`,
    `${prefix}/preamp 0.0 OFF`,
    `${prefix}/eq ON`,
    `${prefix}/eq/1 PEQ 100.0 1.000 0.00`,
    `${prefix}/eq/2 PEQ 400.0 2.000 0.00`,
    `${prefix}/eq/3 PEQ 1600.0 2.000 0.00`,
    `${prefix}/eq/4 HShv 6300.0 2.000 0.00`,
    `${prefix}/mix ON 0.0 OFF -oo ST 0`,
    `${prefix}/grp 0x0000 0x00`,
    ''
  ];
}

function generateBusSection(num: number, bus?: Bus): string[] {
  const prefix = `/bus/${num.toString().padStart(2, '0')}`;
  const lines: string[] = [];

  const name = bus ? truncateName(bus.shortName || bus.name, 12) : `MixBus ${num}`;
  const color = bus ? (X32_COLOR_MAP[bus.color?.name?.toLowerCase() || 'blue'] || 4) : 4;
  const icon = bus?.purpose === 'iem' ? X32_ICON_MAP['Headset'] : X32_ICON_MAP['Wedge'];

  lines.push(`${prefix}/config "${name}" ${icon || 70} ${color}`);
  lines.push(`${prefix}/dyn OFF COMP RMS LOG 0.0 3.0 4 10.0 10.0 150 0 0.0 OFF 100`);
  lines.push(`${prefix}/insert OFF OFF POST`);
  lines.push(`${prefix}/eq ON`);
  lines.push(`${prefix}/eq/1 LShv 100.0 1.000 0.00`);
  lines.push(`${prefix}/eq/2 PEQ 400.0 2.000 0.00`);
  lines.push(`${prefix}/eq/3 PEQ 1600.0 2.000 0.00`);
  lines.push(`${prefix}/eq/4 PEQ 4000.0 2.000 0.00`);
  lines.push(`${prefix}/eq/5 PEQ 8000.0 2.000 0.00`);
  lines.push(`${prefix}/eq/6 HShv 12000.0 2.000 0.00`);

  const mute = bus?.mute ? 'OFF' : 'ON';
  const fader = bus?.fader !== undefined ? (bus.fader <= -90 ? '-oo' : bus.fader.toFixed(1)) : '-oo';
  lines.push(`${prefix}/mix ${mute} ${fader}`);
  lines.push(`${prefix}/grp 0x0000 0x00`);

  return lines;
}

function generateMatrixSection(num: number, matrix?: Bus): string[] {
  const prefix = `/mtx/${num.toString().padStart(2, '0')}`;
  const lines: string[] = [];

  const name = matrix ? truncateName(matrix.shortName || matrix.name, 12) : `Matrix ${num}`;
  const color = matrix ? (X32_COLOR_MAP[matrix.color?.name?.toLowerCase() || 'white'] || 7) : 7;

  lines.push(`${prefix}/config "${name}" 71 ${color}`);
  lines.push(`${prefix}/dyn OFF COMP RMS LOG 0.0 3.0 4 10.0 10.0 150 0 0.0 OFF 100`);
  lines.push(`${prefix}/insert OFF OFF POST`);
  lines.push(`${prefix}/eq ON`);
  lines.push(`${prefix}/eq/1 LShv 100.0 1.000 0.00`);
  lines.push(`${prefix}/eq/2 PEQ 400.0 2.000 0.00`);
  lines.push(`${prefix}/eq/3 PEQ 1600.0 2.000 0.00`);
  lines.push(`${prefix}/eq/4 PEQ 4000.0 2.000 0.00`);
  lines.push(`${prefix}/eq/5 PEQ 8000.0 2.000 0.00`);
  lines.push(`${prefix}/eq/6 HShv 12000.0 2.000 0.00`);

  const mute = matrix?.mute ? 'OFF' : 'ON';
  const fader = matrix?.fader !== undefined ? (matrix.fader <= -90 ? '-oo' : matrix.fader.toFixed(1)) : '-oo';
  lines.push(`${prefix}/mix ${mute} ${fader}`);

  return lines;
}

function generateMainSection(): string[] {
  return [
    '/main/st/config "Main LR" 71 WH',
    '/main/st/dyn OFF COMP RMS LOG 0.0 3.0 4 10.0 10.0 150 0 0.0 OFF 100',
    '/main/st/insert OFF OFF POST',
    '/main/st/eq ON',
    '/main/st/eq/1 LShv 100.0 1.000 0.00',
    '/main/st/eq/2 PEQ 400.0 2.000 0.00',
    '/main/st/eq/3 PEQ 1600.0 2.000 0.00',
    '/main/st/eq/4 PEQ 4000.0 2.000 0.00',
    '/main/st/eq/5 PEQ 8000.0 2.000 0.00',
    '/main/st/eq/6 HShv 12000.0 2.000 0.00',
    '/main/st/mix ON 0.0 0',
    '/main/st/grp 0x00',
  ];
}

function generateMonoSection(): string[] {
  return [
    '/main/m/config "M/C" 71 WH',
    '/main/m/dyn OFF COMP RMS LOG 0.0 3.0 4 10.0 10.0 150 0 0.0 OFF 100',
    '/main/m/insert OFF OFF POST',
    '/main/m/eq ON',
    '/main/m/eq/1 LShv 100.0 1.000 0.00',
    '/main/m/eq/2 PEQ 400.0 2.000 0.00',
    '/main/m/eq/3 PEQ 1600.0 2.000 0.00',
    '/main/m/eq/4 PEQ 4000.0 2.000 0.00',
    '/main/m/eq/5 PEQ 8000.0 2.000 0.00',
    '/main/m/eq/6 HShv 12000.0 2.000 0.00',
    '/main/m/mix OFF -oo',
    '/main/m/grp 0x00',
  ];
}

function generateDCASection(num: number, dca?: DCA): string[] {
  const prefix = `/dca/${num}`;
  const name = dca ? truncateName(dca.shortName || dca.name, 12) : `DCA ${num}`;
  const color = dca ? (X32_COLOR_MAP[dca.color?.name?.toLowerCase() || 'white'] || 7) : 7;
  const mute = dca?.mute ? 'OFF' : 'ON';
  const fader = dca?.fader !== undefined ? (dca.fader <= -90 ? '-oo' : dca.fader.toFixed(1)) : '0.0';

  return [
    `${prefix} "${name}" ${color} ${mute} ${fader}`,
  ];
}

function generateEffectSection(slot: number, fx?: EffectProcessor): string[] {
  const prefix = `/fx/${slot}`;
  const lines: string[] = [];

  if (!fx) {
    // Default empty effect slot
    if (slot <= 4) {
      // First 4 slots default to reverb/delay types
      lines.push(`${prefix}/type HALL`);
      lines.push(`${prefix}/source L 0 R 0`);
      lines.push(`${prefix}/par 50 60 8 40 100 72 4000 60 7 36 0.5`);
    } else {
      // Slots 5-8 for inserts
      lines.push(`${prefix}/type PEQ2`);
      lines.push(`${prefix}/source INS`);
      lines.push(`${prefix}/par 0 0 0 0 0 0 0 0 0 0 0`);
    }
    return lines;
  }

  // Map our effect types to X32 types
  if (fx.reverb) {
    const r = fx.reverb;
    let type = 'HALL';
    if (r.algorithm?.includes('room')) type = 'AMBI';
    if (r.algorithm?.includes('plate')) type = 'PLATE';
    if (r.algorithm?.includes('chamber')) type = 'CHMB';

    lines.push(`${prefix}/type ${type}`);
    lines.push(`${prefix}/source L 0 R 0`);

    // Parameters: mix, predelay, decay, size, damp, diffusion, lo, hi, mod, tailgain, revout
    const predelay = Math.round(r.preDelay || 20);
    const decay = Math.round((r.time || 1.5) * 40);
    const size = r.size || 50;
    const damp = 50;
    const diffusion = r.diffusion || 60;

    lines.push(`${prefix}/par 50 ${predelay} ${decay} ${size} 100 ${diffusion} 4000 60 7 36 0.5`);
  } else if (fx.delay) {
    const d = fx.delay;
    let type = 'DLY';
    if (d.algorithm?.includes('tape')) type = 'TAPE';
    if (d.algorithm?.includes('stereo')) type = 'ST.DL';

    lines.push(`${prefix}/type ${type}`);
    lines.push(`${prefix}/source L 0 R 0`);

    // Parameters depend on delay type
    const time = d.timeLeft || 300;
    const feedback = d.feedback || 20;

    lines.push(`${prefix}/par 50 ${time} ${feedback} 0 0 0 0 0 0 0 0`);
  } else {
    // Default
    lines.push(`${prefix}/type HALL`);
    lines.push(`${prefix}/source L 0 R 0`);
    lines.push(`${prefix}/par 50 60 8 40 100 72 4000 60 7 36 0.5`);
  }

  return lines;
}

// ============================================================================
// Documentation Generators
// ============================================================================

function generateReadmeMD(mix: UniversalMix): string {
  return `# X32/M32 Scene Import Guide

## ${mix.gig.name}

### Quick Start

1. **Copy to USB**: Copy the .scn file to a USB drive (FAT32 formatted)
2. **Insert USB**: Insert the USB drive into the console
3. **Load Scene**:
   - Press UTILITY button
   - Select USB → LOAD → SCENE
   - Navigate to the .scn file
   - Press LOAD and confirm

### Scene Contents

- **Channels**: ${mix.currentScene.channels.length} configured
- **Mix Buses**: ${mix.currentScene.buses.filter(b => b.type === 'aux').length} configured
- **DCAs**: ${mix.currentScene.dcas.length} configured
- **Effects**: ${mix.currentScene.effects.length} configured

### Post-Load Checklist

- [ ] Verify channel names and colors
- [ ] Check input sources (Local/AES50)
- [ ] Adjust head amp gains
- [ ] Verify phantom power settings
- [ ] Test monitor mixes
- [ ] Check effect sends
- [ ] Line check all channels

### Tips

- The scene preserves all EQ, dynamics, and routing settings
- Effects are configured in slots 1-4 (reverbs/delays) and 5-8 (inserts)
- DCA assignments are included in the scene

---
*Generated by Gig-Prepper AI Sound Engineer*
`;
}

function generateGainSheetMD(mix: UniversalMix): string {
  let md = '# Gain Sheet - X32/M32\n\n';
  md += `## ${mix.gig.name}\n\n`;
  md += '| CH | Name | Gain | +48V | Source | Notes |\n';
  md += '|:--:|------|:----:|:----:|--------|-------|\n';

  for (const ch of mix.currentScene.channels) {
    const gain = ch.input?.gain ?? 0;
    const gainStr = gain >= 0 ? `+${gain}` : `${gain}`;
    const phantom = ch.input?.phantomPower === 'on' ? '✓' : '-';
    const source = ch.sourceDescription || ch.category || '-';
    const notes = ch.notes || '-';
    md += `| ${ch.number} | ${ch.name} | ${gainStr}dB | ${phantom} | ${source} | ${notes} |\n`;
  }

  md += '\n## Gain Guidelines\n\n';
  md += '- Condenser vocals: +15 to +25 dB\n';
  md += '- Dynamic vocals: +30 to +45 dB\n';
  md += '- DI (guitar/bass): 0 to +10 dB\n';
  md += '- Drums: Kick +20, Snare +25, OH +15\n';
  md += '- Target: Peak around -18 to -12 dBFS\n';

  return md;
}

// ============================================================================
// Main Adapter Class
// ============================================================================

export class X32Adapter implements ConsoleAdapter {
  readonly info: AdapterInfo = {
    manufacturer: 'behringer',
    supportedModels: ['x32', 'm32'],
    name: 'Behringer X32 / Midas M32 Adapter',
    version: '1.0.0',
    author: 'Gig-Prepper',
    capabilities: {
      canExportScene: true,
      canExportInputList: true,
      canExportChannelNames: true,
      canExportPatch: true,
      canExportEQ: true,
      canExportDynamics: true,
      canExportRouting: true,
      canExportEffects: true,
      canImportScene: false, // Not implemented yet
      canImportInputList: false,
      exportFormats: ['.scn', '.md'],
      requiresOfflineEditor: false,
      offlineEditorName: 'X32-Edit',
      offlineEditorUrl: 'https://www.behringer.com/',
      notes: [
        'Full scene export including EQ, dynamics, and effects',
        'Direct USB import to console',
        'No external editor required',
      ],
    },
  };

  async export(mix: UniversalMix): Promise<ExportResult> {
    const files: ExportFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Generate main scene file
      const sceneContent = generateSceneFile(mix);
      const sceneName = (mix.gig.name || 'GigPrepper').replace(/[^a-zA-Z0-9]/g, '_');

      files.push({
        filename: `${sceneName}.scn`,
        extension: '.scn',
        content: sceneContent,
        mimeType: 'text/plain',
        description: 'X32/M32 Scene file - import via USB',
      });

      // Generate documentation
      files.push({
        filename: 'README.md',
        extension: '.md',
        content: generateReadmeMD(mix),
        mimeType: 'text/markdown',
        description: 'Import instructions and checklist',
      });

      files.push({
        filename: 'GainSheet.md',
        extension: '.md',
        content: generateGainSheetMD(mix),
        mimeType: 'text/markdown',
        description: 'Gain settings reference',
      });

      // Add warnings
      if (mix.currentScene.channels.length > 32) {
        warnings.push(`Only first 32 channels will be exported (you have ${mix.currentScene.channels.length})`);
      }

      const phantomChannels = mix.currentScene.channels.filter(c => c.input?.phantomPower === 'on');
      if (phantomChannels.length > 0) {
        warnings.push(`${phantomChannels.length} channel(s) require +48V phantom power`);
      }

    } catch (error) {
      errors.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      success: errors.length === 0,
      files,
      warnings,
      errors,
      instructions: [
        '1. Copy .scn file to USB drive (FAT32)',
        '2. Insert USB in console',
        '3. Press UTILITY → USB → LOAD → SCENE',
        '4. Select file and confirm LOAD',
        '5. Verify settings and run line check',
      ],
    };
  }

  /**
   * Synchronous generate method for tool usage
   */
  generate(mix: UniversalMix): Array<{ name: string; content: string; type: string }> {
    const files: Array<{ name: string; content: string; type: string }> = [];
    const sceneName = (mix.gig.name || 'GigPrepper').replace(/[^a-zA-Z0-9]/g, '_');

    files.push({
      name: `${sceneName}.scn`,
      content: generateSceneFile(mix),
      type: 'scn',
    });

    files.push({
      name: 'README.md',
      content: generateReadmeMD(mix),
      type: 'md',
    });

    files.push({
      name: 'GainSheet.md',
      content: generateGainSheetMD(mix),
      type: 'md',
    });

    return files;
  }

  validate(mix: UniversalMix): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check manufacturer
    if (mix.console.manufacturer !== 'behringer' && mix.console.manufacturer !== 'midas') {
      errors.push(`Manufacturer ${mix.console.manufacturer} is not X32/M32 compatible`);
    }

    // Check channel count
    if (mix.currentScene.channels.length > 32) {
      errors.push(`Too many channels: ${mix.currentScene.channels.length} (max 32)`);
      suggestions.push('Consider using aux inputs or reducing channel count');
    }

    // Check bus count
    const auxBuses = mix.currentScene.buses.filter(b => b.type === 'aux');
    if (auxBuses.length > 16) {
      errors.push(`Too many mix buses: ${auxBuses.length} (max 16)`);
    }

    // Check matrix count
    const matrices = mix.currentScene.buses.filter(b => b.type === 'matrix');
    if (matrices.length > 6) {
      errors.push(`Too many matrices: ${matrices.length} (max 6)`);
    }

    // Name length checks
    for (const ch of mix.currentScene.channels) {
      const name = ch.shortName || ch.name;
      if (name.length > 12) {
        warnings.push(`Channel "${ch.name}" name will be truncated to 12 characters`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}

// Register the adapter
registerAdapter('behringer', ['x32'], () => new X32Adapter());
registerAdapter('midas', ['m32'], () => new X32Adapter());

export default X32Adapter;

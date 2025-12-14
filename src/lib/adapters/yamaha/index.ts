/**
 * Yamaha CL/QL/TF Adapter v2.0
 *
 * Genererar CSV-filer för import via Yamaha CL/QL Editor.
 * Genererar MD-dokumentation för allt som inte kan importeras via CSV.
 *
 * CSV kan exportera: Namn, färger, ikoner, patching
 * MD dokumenterar: EQ, Dynamics, Effects, Premium Rack, Gain, etc.
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
  ConsoleModel,
  EffectProcessor,
  ReverbSettings,
  DelaySettings,
  GENRE_PRESETS,
  Genre,
} from '../../models/universal-mix';

// ============================================================================
// Yamaha Color Names (as used in CSV)
// ============================================================================

const YAMAHA_COLOR_NAMES: Record<string, string> = {
  off: 'Black',
  black: 'Black',
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue',
  magenta: 'Magenta',
  cyan: 'Cyan',
  white: 'White',
  orange: 'Orange',
  pink: 'Magenta',
  purple: 'Magenta',
  lime: 'Green',
};

// ============================================================================
// Yamaha Icon Names
// ============================================================================

const YAMAHA_ICONS: Record<string, string> = {
  vocals: 'Female', vocal: 'Female', female: 'Female', male: 'Male',
  strings: 'Strings', violin: 'Strings', fiol: 'Strings',
  guitar: 'A.Guitar', 'acoustic-guitar': 'A.Guitar', 'electric-guitar': 'E.Guitar',
  bass: 'E.Bass', keys: 'Keyboard', keyboard: 'Keyboard', piano: 'Piano',
  drums: 'Drums', kick: 'Kick', snare: 'Snare', hihat: 'Hi-Hat',
  percussion: 'Perc.', perc: 'Perc.',
  condenser: 'Condenser', mic: 'Dynamic', di: 'DI',
  podium: 'Podium', talk: 'Podium', tal: 'Podium',
  audience: 'Audience', ambient: 'Condenser',
  media: 'Media1', spotify: 'Media1', playback: 'Media1',
  wedge: 'Wedge', monitor: 'Wedge', speaker: 'Speaker', pa: 'Speaker',
  fader: 'Fader', blank: 'Blank', default: 'Blank',
};

// ============================================================================
// Reverb Algorithm Mapping to Yamaha
// ============================================================================

const YAMAHA_REVERB_MAP: Record<string, string> = {
  'rev-x-hall': 'REV-X Hall',
  'rev-x-room': 'REV-X Room',
  'rev-x-plate': 'REV-X Plate',
  'spx-hall': 'SPX Hall',
  'spx-room': 'SPX Room',
  'spx-stage': 'SPX Stage',
  'spx-plate': 'SPX Plate',
  'hd-hall': 'HD Hall',
  'hd-room': 'HD Room',
  'ambience': 'Ambience',
  'early-ref': 'Early Ref.',
  'gate-reverb': 'Gate Reverb',
};

const YAMAHA_DELAY_MAP: Record<string, string> = {
  'mono-delay': 'Mono Delay',
  'stereo-delay': 'Stereo Delay',
  'ping-pong': 'Ping Pong Delay',
  'tape-delay': 'Tape Echo',
  'analog-delay': 'Analog Delay',
  'modulated-delay': 'Mod. Delay',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getColorName(colorInput: string): string {
  return YAMAHA_COLOR_NAMES[colorInput.toLowerCase()] || 'White';
}

function getIconName(category?: string, name?: string): string {
  if (category) {
    const icon = YAMAHA_ICONS[category.toLowerCase()];
    if (icon) return icon;
  }
  if (name) {
    const nameLower = name.toLowerCase();
    for (const [key, icon] of Object.entries(YAMAHA_ICONS)) {
      if (nameLower.includes(key)) return icon;
    }
  }
  return 'Blank';
}

function formatChannelNumber(num: number): string {
  return `_${num.toString().padStart(2, '0')}`;
}

function getModelString(model: ConsoleModel): string {
  const map: Record<string, string> = {
    cl1: 'CL1', cl3: 'CL3', cl5: 'CL5',
    ql1: 'QL1', ql5: 'QL5',
    tf1: 'TF1', tf3: 'TF3', tf5: 'TF5',
  };
  return map[model] || 'QL1';
}

function generateHeader(model: string): string {
  return `[Information]\n${model}\nV4.1\n`;
}

// ============================================================================
// CSV Generators (vad som KAN importeras)
// ============================================================================

function generateInNameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[InName]\n';
  csv += 'IN,NAME,COLOR,ICON,\n';

  for (const channel of mix.currentScene.channels) {
    if (channel.type === 'mono' || channel.type === 'stereo') {
      const num = formatChannelNumber(channel.number);
      const name = truncateName(channel.shortName || channel.name, 8);
      const color = getColorName(channel.color.name);
      const icon = getIconName(channel.category, channel.name);
      csv += `${num},"${name}","${color}","${icon}",\n`;
    }
  }
  return csv;
}

function generateInPatchCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[InPatch]\n';
  csv += 'IN PATCH,SOURCE,COMMENT\n';

  for (const channel of mix.currentScene.channels) {
    const source = channel.input.source;
    let sourceStr = '';
    let comment = '';

    if (source.type === 'dante' || source.type === 'tio' || source.type === 'rio') {
      sourceStr = `DANTE ${source.port}`;
      comment = `# ${source.label || `Dante In ${source.port}`}`;
    } else if (source.type === 'local') {
      sourceStr = `INPUT ${source.port}`;
      comment = `# Local In ${source.port}`;
    } else if (source.type === 'aes') {
      sourceStr = `AES ${source.port}`;
      comment = `# AES In ${source.port}`;
    }

    if (sourceStr) {
      csv += `CH ${channel.number},${sourceStr},"${comment}",\n`;
    }
  }
  return csv;
}

function generateOutPatchCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[OutPatch]\n';
  csv += 'OUT PATCH,SOURCE,COMMENT\n';

  for (const bus of mix.currentScene.buses) {
    if (bus.output && bus.output.type === 'local') {
      csv += `OUTPUT ${bus.output.port},${bus.type.toUpperCase()} ${bus.number},"# ${bus.name}",\n`;
    }
  }
  return csv;
}

function generatePortRackPatchCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[PortRackPatch]\n';
  csv += 'PORT RACK PATCH,SOURCE,COMMENT\n';

  for (const bus of mix.currentScene.buses) {
    if (bus.output && (bus.output.type === 'dante' || bus.output.type === 'tio')) {
      const sourceType = bus.type === 'aux' ? 'MIX' : bus.type === 'matrix' ? 'MATRIX' : 'MIX';
      csv += `DANTE ${bus.output.port},${sourceType} ${bus.number},"# ${bus.name}",\n`;
    }
  }

  for (const channel of mix.currentScene.channels) {
    if (channel.directOut?.enabled && channel.directOut.destination?.type === 'dante') {
      csv += `DANTE ${channel.directOut.destination.port},DIR CH ${channel.number},"# Rec ${channel.shortName}",\n`;
    }
  }
  return csv;
}

function generateMixNameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[MixName]\n';
  csv += 'MIX,NAME,COLOR,ICON,\n';

  const mixBuses = mix.currentScene.buses.filter(b => b.type === 'aux');
  for (const bus of mixBuses) {
    const num = formatChannelNumber(bus.number);
    const name = truncateName(bus.shortName || bus.name, 8);
    const color = getColorName(bus.color.name);
    const icon = bus.purpose === 'monitor' || bus.purpose === 'iem' ? 'Wedge' : 'Fader';
    csv += `${num},"${name}","${color}","${icon}",\n`;
  }
  return csv;
}

function generateMtxNameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[MtxName]\n';
  csv += 'MATRIX,NAME,COLOR,ICON,\n';

  const matrixBuses = mix.currentScene.buses.filter(b => b.type === 'matrix');
  for (const bus of matrixBuses) {
    const num = formatChannelNumber(bus.number);
    const name = truncateName(bus.shortName || bus.name, 8);
    const color = getColorName(bus.color.name);
    csv += `${num},"${name}","${color}","Speaker",\n`;
  }
  return csv;
}

function generateDCANameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[DCAName]\n';
  csv += 'DCA,NAME,COLOR,ICON,\n';

  for (const dca of mix.currentScene.dcas) {
    const num = formatChannelNumber(dca.number);
    const name = truncateName(dca.shortName || dca.name, 8);
    const color = getColorName(dca.color.name);
    csv += `${num},"${name}","${color}","Fader",\n`;
  }
  return csv;
}

function generateStNameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[StName]\n';
  csv += 'ST,NAME,COLOR,ICON,\n';
  csv += `_01,"ST IN 1","Black","Blank",\n`;
  return csv;
}

function generateStMonoNameCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[StMonoName]\n';
  csv += 'STEREO/MONO,NAME,COLOR,ICON,\n';
  csv += `_01,"Main L","Yellow","Fader",\n`;
  csv += `_02,"Main R","Yellow","Fader",\n`;
  csv += `_03,"Mono","Black","Fader",\n`;
  return csv;
}

// ============================================================================
// DOCUMENTATION GENERATORS (allt som INTE kan importeras via CSV)
// ============================================================================

function generatePhantomPowerMD(mix: UniversalMix): string {
  let md = '# Fantommatning (+48V)\n\n';

  const phantomChannels = mix.currentScene.channels.filter(ch => ch.input.phantomPower === 'on');

  if (phantomChannels.length === 0) {
    md += '*Inga kanaler kräver fantommatning.*\n';
    return md;
  }

  md += '| CH | Namn | Källa | Mikrofon |\n';
  md += '|:--:|------|-------|----------|\n';

  for (const ch of phantomChannels) {
    const source = ch.input.source;
    const sourceStr = source.type === 'dante' || source.type === 'tio'
      ? `Dante ${source.port}` : `Local ${source.port}`;
    const mic = ch.sourceDescription || 'Kondensator';
    md += `| ${ch.number} | ${ch.name} | ${sourceStr} | ${mic} |\n`;
  }

  md += '\n## Aktivering\n\n';
  md += '### Tio1608-D Stagebox\n';
  md += '1. QL1 → **Setup** → **I/O Device**\n';
  md += '2. Välj Tio1608 i listan\n';
  md += '3. Tryck **+48V** för aktuella ingångar\n\n';
  md += '### Lokala ingångar\n';
  md += '1. Välj kanal → **Selected Channel**\n';
  md += '2. **HA** (Head Amp) → **+48V ON**\n';

  return md;
}

function generateGainSheetMD(mix: UniversalMix): string {
  let md = '# Gain Sheet\n\n';
  md += '> Startpunkter för gain. Justera efter faktisk nivå vid line check.\n\n';

  md += '| CH | Namn | Gain | Pad | Källa | Anteckning |\n';
  md += '|:--:|------|:----:|:---:|-------|------------|\n';

  for (const ch of mix.currentScene.channels) {
    const gain = ch.input.gain >= 0 ? `+${ch.input.gain}` : `${ch.input.gain}`;
    const pad = ch.input.pad ? '20dB' : '-';
    const source = ch.sourceDescription || ch.category || '-';
    const note = ch.notes || '-';
    md += `| ${ch.number} | ${ch.name} | ${gain}dB | ${pad} | ${source} | ${note} |\n`;
  }

  md += '\n## Gain Tips\n\n';
  md += '- **Kondensator sång**: Börja +15 till +25 dB\n';
  md += '- **Dynamisk sång**: Börja +30 till +45 dB\n';
  md += '- **DI (gitarr/bas)**: Börja 0 till +10 dB\n';
  md += '- **Trummor**: Kick +20, Snare +25, OH +15\n';
  md += '- **Mål**: Peak ca -18 till -12 dBFS\n';

  return md;
}

function generateEQGuideMD(mix: UniversalMix): string {
  let md = '# EQ Guide\n\n';

  // Genre-specific philosophy
  const genres = mix.gig.artist.genre;
  if (genres.length > 0) {
    const preset = GENRE_PRESETS[genres[0] as Genre];
    if (preset) {
      md += `## Mix-filosofi: ${preset.genre.toUpperCase()}\n\n`;
      md += `> ${preset.mixPhilosophy}\n\n`;
    }
  }

  md += '## Kanal-EQ\n\n';
  md += '| CH | Namn | HPF | Band 1 | Band 2 | Band 3 | Band 4 |\n';
  md += '|:--:|------|-----|--------|--------|--------|--------|\n';

  for (const ch of mix.currentScene.channels) {
    const hpf = ch.eq.highPassFilter.enabled
      ? `${ch.eq.highPassFilter.frequency}Hz @ ${ch.eq.highPassFilter.slope}dB/oct`
      : 'OFF';

    const bands = ch.eq.bands.map(b => {
      if (!b.enabled) return '-';
      const sign = b.gain >= 0 ? '+' : '';
      return `${sign}${b.gain}dB @ ${b.frequency}Hz`;
    });

    md += `| ${ch.number} | ${ch.name} | ${hpf} | ${bands[0] || '-'} | ${bands[1] || '-'} | ${bands[2] || '-'} | ${bands[3] || '-'} |\n`;
  }

  md += '\n## Rekommenderade HPF-frekvenser\n\n';
  md += '| Källa | HPF | Anledning |\n';
  md += '|-------|-----|----------|\n';
  md += '| Sång | 80-120 Hz | Ta bort handling noise, plosiver |\n';
  md += '| Akustisk gitarr | 80-100 Hz | Rensa upp botten |\n';
  md += '| Fiol/Viola | 150-200 Hz | Inget LF-innehåll |\n';
  md += '| Kick | OFF eller 30 Hz | Behåll sub |\n';
  md += '| Snare | 80-100 Hz | Ta bort kick-bleed |\n';
  md += '| Tal/Podium | 100-150 Hz | Tydlighet |\n';

  return md;
}

function generateDynamicsGuideMD(mix: UniversalMix): string {
  let md = '# Dynamics Guide\n\n';

  // Check genre for recommendations
  const genres = mix.gig.artist.genre;
  const useGate = genres.some(g => ['rock', 'metal', 'pop'].includes(g));

  md += '## Gate-inställningar\n\n';

  if (!useGate) {
    md += '> **Genre-rekommendation**: Minimal gate-användning för denna genre.\n\n';
  }

  const gatedChannels = mix.currentScene.channels.filter(ch => ch.dynamics.gate.enabled);

  if (gatedChannels.length > 0) {
    md += '| CH | Namn | Threshold | Range | Attack | Hold | Release |\n';
    md += '|:--:|------|:---------:|:-----:|:------:|:----:|:-------:|\n';

    for (const ch of gatedChannels) {
      const g = ch.dynamics.gate;
      md += `| ${ch.number} | ${ch.name} | ${g.threshold}dB | ${g.range}dB | ${g.attack}ms | ${g.hold}ms | ${g.release}ms |\n`;
    }
  } else {
    md += '*Ingen gate konfigurerad.*\n';
  }

  md += '\n## Kompressor-inställningar\n\n';

  const compChannels = mix.currentScene.channels.filter(ch => ch.dynamics.compressor.enabled);

  if (compChannels.length > 0) {
    md += '| CH | Namn | Threshold | Ratio | Attack | Release | Knee | Makeup |\n';
    md += '|:--:|------|:---------:|:-----:|:------:|:-------:|:----:|:------:|\n';

    for (const ch of compChannels) {
      const c = ch.dynamics.compressor;
      const ratio = c.ratio >= 20 ? '∞:1' : `${c.ratio}:1`;
      const makeup = c.autoMakeup ? 'Auto' : `${c.makeupGain}dB`;
      md += `| ${ch.number} | ${ch.name} | ${c.threshold}dB | ${ratio} | ${c.attack}ms | ${c.release}ms | ${c.knee} | ${makeup} |\n`;
    }
  } else {
    md += '*Ingen kompression konfigurerad.*\n';
  }

  md += '\n## Rekommenderade startpunkter\n\n';
  md += '### Sång\n';
  md += '- **Ratio**: 3:1 till 4:1\n';
  md += '- **Threshold**: -20 till -15 dB (justera så 3-6 dB GR)\n';
  md += '- **Attack**: 10-25 ms (behåll transienter)\n';
  md += '- **Release**: 100-200 ms (följ frasen)\n';
  md += '- **Knee**: Soft\n\n';

  md += '### Akustisk gitarr\n';
  md += '- **Ratio**: 2:1 till 3:1\n';
  md += '- **Threshold**: -18 dB\n';
  md += '- **Attack**: 20-30 ms\n';
  md += '- **Release**: 150 ms\n';

  return md;
}

function generateEffectsRackMD(mix: UniversalMix): string {
  let md = '# Effects Rack Setup\n\n';
  md += '> Konfigurera dessa effekter manuellt i QL1 → **RACK**\n\n';

  const effects = mix.currentScene.effects;

  if (effects.length === 0) {
    // Generate based on genre
    const genres = mix.gig.artist.genre;
    if (genres.length > 0) {
      const preset = GENRE_PRESETS[genres[0] as Genre];
      if (preset) {
        md += '## Rekommenderade effekter baserat på genre\n\n';
        md += `### Rack 1: Huvudreverb\n`;
        md += `- **Typ**: ${YAMAHA_REVERB_MAP[preset.defaultReverb.algorithm || 'rev-x-hall'] || 'REV-X Hall'}\n`;
        md += `- **Time**: ${preset.defaultReverb.time || 1.5}s\n`;
        md += `- **Pre-delay**: ${preset.defaultReverb.preDelay || 20}ms\n`;
        md += `- **Användning**: Sång, akustiska instrument\n\n`;

        md += `### Rack 2: Delay\n`;
        md += `- **Typ**: ${YAMAHA_DELAY_MAP[preset.defaultDelay.algorithm || 'stereo-delay'] || 'Stereo Delay'}\n`;
        md += `- **Time**: ${preset.defaultDelay.timeLeft || 300}ms\n`;
        md += `- **Feedback**: ${preset.defaultDelay.feedback || 20}%\n`;
        md += `- **Användning**: Subtilt på sång\n\n`;
      }
    }
  } else {
    md += '## Konfigurerade effekter\n\n';

    for (const fx of effects) {
      md += `### Rack ${fx.slot}: ${fx.name}\n`;

      if (fx.reverb) {
        const r = fx.reverb;
        md += `- **Typ**: ${YAMAHA_REVERB_MAP[r.algorithm] || r.algorithm}\n`;
        md += `- **Time**: ${r.time}s\n`;
        md += `- **Pre-delay**: ${r.preDelay}ms\n`;
        md += `- **Size**: ${r.size}%\n`;
        md += `- **Diffusion**: ${r.diffusion}%\n`;
        md += `- **HPF**: ${r.hpf}Hz\n`;
        md += `- **LPF**: ${r.lpf}Hz\n`;
      }

      if (fx.delay) {
        const d = fx.delay;
        md += `- **Typ**: ${YAMAHA_DELAY_MAP[d.algorithm] || d.algorithm}\n`;
        md += `- **Time L**: ${d.timeLeft}ms\n`;
        md += `- **Time R**: ${d.timeRight}ms\n`;
        md += `- **Feedback**: ${d.feedback}%\n`;
        md += `- **HPF**: ${d.feedbackHPF}Hz\n`;
        md += `- **LPF**: ${d.feedbackLPF}Hz\n`;
      }

      if (fx.usageHint) {
        md += `- **Användning**: ${fx.usageHint}\n`;
      }
      if (fx.notes) {
        md += `- **Not**: ${fx.notes}\n`;
      }
      md += '\n';
    }
  }

  md += '## FX Send-nivåer\n\n';
  md += '| CH | Namn | FX1 (Reverb) | FX2 (Delay) |\n';
  md += '|:--:|------|:------------:|:-----------:|\n';

  for (const ch of mix.currentScene.channels) {
    const sends = ch.effectSends || [];
    const fx1 = sends[0]?.level ?? '-∞';
    const fx2 = sends[1]?.level ?? '-∞';
    md += `| ${ch.number} | ${ch.name} | ${fx1 === '-∞' ? '-' : fx1 + 'dB'} | ${fx2 === '-∞' ? '-' : fx2 + 'dB'} |\n`;
  }

  return md;
}

function generatePremiumRackMD(mix: UniversalMix): string {
  let md = '# Premium Rack Setup\n\n';
  md += '> Yamaha Premium Rack-enheter för analog karaktär\n\n';

  const premiumRack = mix.currentScene.premiumRack || [];

  if (premiumRack.length === 0) {
    md += '## Rekommenderade Premium Rack för denna show\n\n';
    md += '### Slot 1-2: Rupert Neve Designs Portico 5033 EQ\n';
    md += '- **Användning**: Huvudsång, viktiga akustiska källor\n';
    md += '- **Karaktär**: "Silk" för varmt, öppet toppar\n';
    md += '- **Tips**: Subtilt - 1-2 dB boost räcker\n\n';

    md += '### Slot 3-4: Rupert Neve Designs Portico 5043 Comp\n';
    md += '- **Användning**: Sång, akustisk gitarr\n';
    md += '- **Inställning**: Ratio 2-3:1, soft knee\n';
    md += '- **Blend**: 60-70% för parallell kompression\n\n';

    md += '### Slot 5-6: U76 Compressor\n';
    md += '- **Användning**: Trummor (om tillämpligt)\n';
    md += '- **Karaktär**: Snabb attack för transienter\n\n';
  } else {
    for (const unit of premiumRack) {
      md += `### Slot ${unit.slot}: ${unit.name}\n`;
      md += `- **Typ**: ${unit.type}\n`;
      if (unit.assignedTo.length > 0) {
        md += `- **Tilldelas**: ${unit.assignedTo.join(', ')}\n`;
      }
      if (unit.notes) {
        md += `- **Anteckningar**: ${unit.notes}\n`;
      }
      md += '\n';
    }
  }

  md += '## Insert-routing\n\n';
  md += 'För att använda Premium Rack som insert:\n\n';
  md += '1. Välj kanal → **INSERT**\n';
  md += '2. Sätt **INSERT ON**\n';
  md += '3. Välj **PREMIUM RACK** som källa\n';
  md += '4. Välj rack-slot\n';

  return md;
}

function generateMonitorGuideMD(mix: UniversalMix): string {
  let md = '# Monitor Guide\n\n';

  const monitors = mix.currentScene.buses.filter(b =>
    b.type === 'aux' && (b.purpose === 'monitor' || b.purpose === 'iem')
  );

  if (monitors.length === 0) {
    md += '*Inga monitormixar konfigurerade.*\n';
    return md;
  }

  md += '## Monitor-mixar\n\n';

  for (const mon of monitors) {
    md += `### ${mon.name}\n`;
    md += `- **Typ**: ${mon.purpose === 'iem' ? 'In-Ear' : 'Wedge'}\n`;
    if (mon.feedDescription) {
      md += `- **För**: ${mon.feedDescription}\n`;
    }
    if (mon.output) {
      md += `- **Output**: Dante ${mon.output.port}\n`;
    }
    if (mon.notes) {
      md += `- **Anteckningar**: ${mon.notes}\n`;
    }
    md += '\n';
  }

  md += '## Monitor-nivåer\n\n';
  md += '| Kanal |';
  for (const mon of monitors) {
    md += ` ${mon.shortName} |`;
  }
  md += '\n|-------|';
  for (let i = 0; i < monitors.length; i++) {
    md += ':---:|';
  }
  md += '\n';

  for (const ch of mix.currentScene.channels) {
    md += `| ${ch.shortName} |`;
    for (const mon of monitors) {
      const send = ch.busSends.find(s => s.busId === mon.id);
      const level = send?.enabled ? (send.level === -96 ? '-∞' : `${send.level}`) : '-';
      md += ` ${level} |`;
    }
    md += '\n';
  }

  return md;
}

function generateMasterDocMD(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);

  let md = `# ${mix.gig.name} - ${model} Setup\n\n`;
  md += `**Datum**: ${mix.gig.date}\n`;
  md += `**Artist**: ${mix.gig.artist.name}\n`;
  md += `**Genre**: ${mix.gig.artist.genre.join(', ')}\n`;
  md += `**Venue**: ${mix.gig.venue.name}\n\n`;

  if (mix.aiNotes?.mixPhilosophy) {
    md += `## Mix-filosofi\n\n> ${mix.aiNotes.mixPhilosophy}\n\n`;
  }

  // AI Recommendations
  if (mix.aiNotes && mix.aiNotes.processingDecisions.length > 0) {
    md += '## AI-rekommendationer\n\n';
    for (const decision of mix.aiNotes.processingDecisions) {
      md += `### ${decision.category.toUpperCase()}\n`;
      md += `- **Beslut**: ${decision.decision}\n`;
      md += `- **Motivering**: ${decision.reasoning}\n`;
      md += `- **Konfidens**: ${decision.confidence}\n\n`;
    }
  }

  // Quick reference
  md += '## Snabbreferens\n\n';
  md += '| Resurs | Antal |\n';
  md += '|--------|------:|\n';
  md += `| Kanaler | ${mix.currentScene.channels.length} |\n`;
  md += `| Bussar | ${mix.currentScene.buses.length} |\n`;
  md += `| DCAs | ${mix.currentScene.dcas.length} |\n`;
  md += `| Effekter | ${mix.currentScene.effects.length} |\n`;
  md += `| +48V Kanaler | ${mix.currentScene.channels.filter(c => c.input.phantomPower === 'on').length} |\n`;

  md += '\n## Checklista\n\n';
  md += '- [ ] Importera CSV-filer i Editor\n';
  md += '- [ ] Aktivera +48V (se PhantomPower.md)\n';
  md += '- [ ] Ställ in Gain (se GainSheet.md)\n';
  md += '- [ ] Konfigurera EQ (se EQ_Guide.md)\n';
  md += '- [ ] Sätt upp Dynamics (se Dynamics_Guide.md)\n';
  md += '- [ ] Montera Effects Rack (se Effects_Rack.md)\n';
  md += '- [ ] Montera Premium Rack (se Premium_Rack.md)\n';
  md += '- [ ] Spara till USB\n';
  md += '- [ ] Ladda in i bord\n';
  md += '- [ ] Line check\n';

  md += '\n---\n';
  md += `*Genererat av Gig-Prepper ${new Date().toISOString().split('T')[0]}*\n`;

  return md;
}

function generateReadmeMD(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);

  return `# Import-instruktioner för ${model}

## Filstruktur

### CSV-filer (importeras i Editor)
| Fil | Innehåll |
|-----|----------|
| InName.csv | Kanalnamn, färger, ikoner |
| InPatch.csv | Dante/Lokal input-routing |
| OutPatch.csv | Output-routing |
| PortRackPatch.csv | Dante-utgångar |
| MixName.csv | Monitor/Aux-namn |
| MtxName.csv | Matrix-namn |
| DCAName.csv | DCA-namn |
| StName.csv | Stereo-inputs |
| StMonoName.csv | Master L/R/Mono |

### Dokumentation (manuell konfiguration)
| Fil | Innehåll |
|-----|----------|
| MASTER.md | Översikt och checklista |
| PhantomPower.md | +48V-kanaler |
| GainSheet.md | Gain-startpunkter |
| EQ_Guide.md | EQ per kanal |
| Dynamics_Guide.md | Gate och kompressor |
| Effects_Rack.md | Reverb, delay, etc. |
| Premium_Rack.md | Neve, etc. |
| Monitor_Guide.md | Monitormixar |

## Import-steg

### 1. Öppna ${model} Editor
- Starta Yamaha ${model} Editor
- File → New eller öppna befintligt projekt

### 2. Importera CSV
1. **File → Import → Channel Name Table** → \`InName.csv\`
2. **File → Import → Input Patch Table** → \`InPatch.csv\`
3. **File → Import → Output Patch Table** → \`PortRackPatch.csv\`
4. Fortsätt med övriga CSV-filer

### 3. Manuell konfiguration
Följ dokumentationen i ordning:
1. PhantomPower.md - Aktivera +48V
2. GainSheet.md - Sätt gain-nivåer
3. EQ_Guide.md - Konfigurera EQ
4. Dynamics_Guide.md - Gate/kompressor
5. Effects_Rack.md - Sätt upp effekter
6. Premium_Rack.md - Montera premium rack

### 4. Spara och ladda
1. File → Save As → USB-minne (.CLF-fil)
2. Sätt USB i ${model}
3. Load → USB → Välj fil
4. Verifiera att allt laddats korrekt

## Line Check

1. Testa varje kanal med signal
2. Justera gain till -18 till -12 dBFS peak
3. Verifiera +48V på kondensatorer
4. Kontrollera routing till PA och monitorer
5. Testa effekter

---
*Gig-Prepper AI Sound Engineer*
`;
}

// ============================================================================
// Main Adapter Class
// ============================================================================

export class YamahaAdapter implements ConsoleAdapter {
  readonly info: AdapterInfo = {
    manufacturer: 'yamaha',
    supportedModels: ['cl1', 'cl3', 'cl5', 'ql1', 'ql5', 'tf1', 'tf3', 'tf5'],
    name: 'Yamaha CL/QL/TF Adapter',
    version: '2.0.0',
    author: 'Gig-Prepper',
    capabilities: {
      canExportScene: false,
      canExportInputList: true,
      canExportChannelNames: true,
      canExportPatch: true,
      canExportEQ: false,
      canExportDynamics: false,
      canExportRouting: true,
      canExportEffects: false,
      canImportScene: false,
      canImportInputList: false,
      exportFormats: ['.csv', '.md'],
      requiresOfflineEditor: true,
      offlineEditorName: 'Yamaha CL/QL Editor',
      offlineEditorUrl: 'https://www.yamahaproaudio.com/',
      notes: [
        'CSV: Namn, färger, ikoner, patching',
        'MD: EQ, Dynamics, Effects, Premium Rack, Gain',
        'Komplett dokumentation för manuell konfiguration',
      ],
    },
  };

  async export(mix: UniversalMix): Promise<ExportResult> {
    const files: ExportFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // === CSV FILES ===
      files.push({
        filename: 'InName.csv',
        extension: '.csv',
        content: generateInNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Kanalnamn, färger, ikoner',
      });

      files.push({
        filename: 'InPatch.csv',
        extension: '.csv',
        content: generateInPatchCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Input-routing',
      });

      files.push({
        filename: 'OutPatch.csv',
        extension: '.csv',
        content: generateOutPatchCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Output-routing',
      });

      files.push({
        filename: 'PortRackPatch.csv',
        extension: '.csv',
        content: generatePortRackPatchCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Dante-utgångar',
      });

      files.push({
        filename: 'MixName.csv',
        extension: '.csv',
        content: generateMixNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Mix/Aux-namn',
      });

      files.push({
        filename: 'MtxName.csv',
        extension: '.csv',
        content: generateMtxNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Matrix-namn',
      });

      files.push({
        filename: 'DCAName.csv',
        extension: '.csv',
        content: generateDCANameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'DCA-namn',
      });

      files.push({
        filename: 'StName.csv',
        extension: '.csv',
        content: generateStNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Stereo-inputs',
      });

      files.push({
        filename: 'StMonoName.csv',
        extension: '.csv',
        content: generateStMonoNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Master L/R/Mono',
      });

      // === DOCUMENTATION FILES ===
      files.push({
        filename: 'MASTER.md',
        extension: '.md',
        content: generateMasterDocMD(mix),
        mimeType: 'text/markdown',
        description: 'Översikt och checklista',
      });

      files.push({
        filename: 'PhantomPower.md',
        extension: '.md',
        content: generatePhantomPowerMD(mix),
        mimeType: 'text/markdown',
        description: '+48V kanallista',
      });

      files.push({
        filename: 'GainSheet.md',
        extension: '.md',
        content: generateGainSheetMD(mix),
        mimeType: 'text/markdown',
        description: 'Gain-startpunkter',
      });

      files.push({
        filename: 'EQ_Guide.md',
        extension: '.md',
        content: generateEQGuideMD(mix),
        mimeType: 'text/markdown',
        description: 'EQ per kanal',
      });

      files.push({
        filename: 'Dynamics_Guide.md',
        extension: '.md',
        content: generateDynamicsGuideMD(mix),
        mimeType: 'text/markdown',
        description: 'Gate och kompressor',
      });

      files.push({
        filename: 'Effects_Rack.md',
        extension: '.md',
        content: generateEffectsRackMD(mix),
        mimeType: 'text/markdown',
        description: 'Effekt-konfiguration',
      });

      files.push({
        filename: 'Premium_Rack.md',
        extension: '.md',
        content: generatePremiumRackMD(mix),
        mimeType: 'text/markdown',
        description: 'Premium Rack (Neve, etc.)',
      });

      files.push({
        filename: 'Monitor_Guide.md',
        extension: '.md',
        content: generateMonitorGuideMD(mix),
        mimeType: 'text/markdown',
        description: 'Monitormixar',
      });

      files.push({
        filename: 'README.md',
        extension: '.md',
        content: generateReadmeMD(mix),
        mimeType: 'text/markdown',
        description: 'Import-instruktioner',
      });

      // Add warnings
      const phantomCount = mix.currentScene.channels.filter(c => c.input.phantomPower === 'on').length;
      if (phantomCount > 0) {
        warnings.push(`${phantomCount} kanal(er) kräver +48V`);
      }

      const longNames = mix.currentScene.channels.filter(c => (c.shortName || c.name).length > 8);
      if (longNames.length > 0) {
        warnings.push(`${longNames.length} kanal(er) har namn längre än 8 tecken`);
      }

    } catch (error) {
      errors.push(`Export misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`);
    }

    return {
      success: errors.length === 0,
      files,
      warnings,
      errors,
      instructions: [
        '1. Packa upp ZIP-filen',
        '2. Importera CSV-filer i Yamaha Editor',
        '3. Följ MASTER.md för manuell konfiguration',
        '4. Spara som .CLF till USB',
        '5. Ladda in i bord och kör line check',
      ],
    };
  }

  validate(mix: UniversalMix): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (mix.console.manufacturer !== 'yamaha') {
      errors.push(`Fel tillverkare: ${mix.console.manufacturer}`);
    }

    if (!this.info.supportedModels.includes(mix.console.model)) {
      errors.push(`Modellen ${mix.console.model} stöds inte`);
    }

    const maxChannels: Record<string, number> = {
      cl1: 48, cl3: 64, cl5: 72, ql1: 32, ql5: 64, tf1: 16, tf3: 24, tf5: 32,
    };

    const max = maxChannels[mix.console.model] || 32;
    if (mix.currentScene.channels.length > max) {
      errors.push(`För många kanaler: ${mix.currentScene.channels.length} (max ${max})`);
    }

    for (const ch of mix.currentScene.channels) {
      const name = ch.shortName || ch.name;
      if (name.length > 8) {
        warnings.push(`"${ch.name}" är ${name.length} tecken (max 8)`);
        suggestions.push(`Förkorta "${ch.name}"`);
      }
      if (/[åäöÅÄÖ]/.test(name)) {
        warnings.push(`"${name}" innehåller svenska tecken`);
        suggestions.push(`Ersätt å→a, ä→a, ö→o`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }
}

registerAdapter('yamaha', ['cl1', 'cl3', 'cl5', 'ql1', 'ql5', 'tf1', 'tf3', 'tf5'], () => new YamahaAdapter());

export default YamahaAdapter;

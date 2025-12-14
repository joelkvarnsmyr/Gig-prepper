/**
 * Yamaha CL/QL/TF Adapter
 *
 * Genererar CSV-filer för import via Yamaha CL/QL Editor.
 * Baserat på beprövat format som fungerar med QL1.
 *
 * Format-krav:
 * - [Information] header med modell och version
 * - ASCII-kodning (ingen BOM)
 * - Kanalnummer med underscore prefix (_01, _02, etc.)
 * - Namn inom citattecken
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
  ConsoleModel,
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
  // Vocals
  vocals: 'Female',
  vocal: 'Female',
  female: 'Female',
  male: 'Male',
  // Instruments
  strings: 'Strings',
  violin: 'Strings',
  fiol: 'Strings',
  guitar: 'A.Guitar',
  'acoustic-guitar': 'A.Guitar',
  'electric-guitar': 'E.Guitar',
  bass: 'E.Bass',
  keys: 'Keyboard',
  keyboard: 'Keyboard',
  piano: 'Piano',
  drums: 'Drums',
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  percussion: 'Perc.',
  perc: 'Perc.',
  // Misc
  condenser: 'Condenser',
  mic: 'Dynamic',
  di: 'DI',
  podium: 'Podium',
  talk: 'Podium',
  tal: 'Podium',
  audience: 'Audience',
  ambient: 'Condenser',
  media: 'Media1',
  spotify: 'Media1',
  playback: 'Media1',
  wedge: 'Wedge',
  monitor: 'Wedge',
  speaker: 'Speaker',
  pa: 'Speaker',
  fader: 'Fader',
  blank: 'Blank',
  default: 'Blank',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getColorName(colorInput: string): string {
  const normalized = colorInput.toLowerCase();
  return YAMAHA_COLOR_NAMES[normalized] || 'White';
}

function getIconName(category?: string, name?: string): string {
  if (category) {
    const normalized = category.toLowerCase();
    if (YAMAHA_ICONS[normalized]) {
      return YAMAHA_ICONS[normalized];
    }
  }
  if (name) {
    const nameLower = name.toLowerCase();
    for (const [key, icon] of Object.entries(YAMAHA_ICONS)) {
      if (nameLower.includes(key)) {
        return icon;
      }
    }
  }
  return 'Blank';
}

function formatChannelNumber(num: number): string {
  return `_${num.toString().padStart(2, '0')}`;
}

function getModelString(model: ConsoleModel): string {
  const modelMap: Record<string, string> = {
    cl1: 'CL1',
    cl3: 'CL3',
    cl5: 'CL5',
    ql1: 'QL1',
    ql5: 'QL5',
    tf1: 'TF1',
    tf3: 'TF3',
    tf5: 'TF5',
  };
  return modelMap[model] || 'QL1';
}

function generateHeader(model: string): string {
  return `[Information]\n${model}\nV4.1\n`;
}

// ============================================================================
// CSV Generators
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

    if (source.type === 'dante' || source.type === 'tio') {
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

  // Output patches for buses with physical outputs
  for (const bus of mix.currentScene.buses) {
    if (bus.output) {
      const output = bus.output;
      if (output.type === 'local') {
        csv += `OUTPUT ${output.port},${bus.type.toUpperCase()} ${bus.number},"# ${bus.name}",\n`;
      }
    }
  }

  return csv;
}

function generatePortRackPatchCSV(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);
  let csv = generateHeader(model);
  csv += '[PortRackPatch]\n';
  csv += 'PORT RACK PATCH,SOURCE,COMMENT\n';

  // Dante outputs for monitors and PA
  for (const bus of mix.currentScene.buses) {
    if (bus.output && (bus.output.type === 'dante' || bus.output.type === 'tio')) {
      const dantePort = bus.output.port;
      const sourceType = bus.type === 'aux' ? 'MIX' : bus.type === 'matrix' ? 'MATRIX' : 'MIX';
      csv += `DANTE ${dantePort},${sourceType} ${bus.number},"# ${bus.name}",\n`;
    }
  }

  // Direct outputs for recording
  for (const channel of mix.currentScene.channels) {
    if (channel.directOut?.enabled && channel.directOut.destination) {
      const dest = channel.directOut.destination;
      if (dest.type === 'dante') {
        csv += `DANTE ${dest.port},DIR CH ${channel.number},"# Rec ${channel.shortName || channel.name}",\n`;
      }
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

  // Stereo inputs (default values)
  const stereoChannels = mix.currentScene.channels.filter(c => c.type === 'stereo');
  if (stereoChannels.length === 0) {
    csv += `_01,"ST IN 1","Black","Blank",\n`;
  } else {
    for (const ch of stereoChannels) {
      const num = formatChannelNumber(ch.number);
      const name = truncateName(ch.shortName || ch.name, 8);
      const color = getColorName(ch.color.name);
      csv += `${num},"${name}","${color}","Blank",\n`;
    }
  }

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
// Documentation Generators
// ============================================================================

function generatePhantomPowerMD(mix: UniversalMix): string {
  let md = '# Fantommatning (+48V)\n\n';
  md += 'Följande kanaler behöver fantommatning:\n\n';
  md += '| Kanal | Namn | Källa | Typ |\n';
  md += '|-------|------|-------|-----|\n';

  const phantomChannels = mix.currentScene.channels.filter(
    ch => ch.input.phantomPower === 'on'
  );

  if (phantomChannels.length === 0) {
    md += '| - | Inga kanaler kräver fantommatning | - | - |\n';
  } else {
    for (const ch of phantomChannels) {
      const source = ch.input.source;
      const sourceStr = source.type === 'dante' || source.type === 'tio'
        ? `Dante ${source.port}`
        : `Local ${source.port}`;
      md += `| CH ${ch.number} | ${ch.name} | ${sourceStr} | Kondensator |\n`;
    }
  }

  md += '\n## Aktivera +48V\n\n';
  md += '### På Tio1608-D Stagebox:\n';
  md += '1. Öppna QL1 → Setup → Dante Setup\n';
  md += '2. Välj Tio1608 i listan\n';
  md += '3. Aktivera +48V för aktuella ingångar\n\n';
  md += '### På lokala ingångar:\n';
  md += '1. Gå till Selected Channel → HA (Head Amp)\n';
  md += '2. Aktivera +48V\n';

  return md;
}

function generateProcessingGuideMD(mix: UniversalMix): string {
  let md = '# Processing Guide\n\n';
  md += `**Gig:** ${mix.gig.name}\n`;
  md += `**Artist:** ${mix.gig.artist.name}\n`;
  md += `**Genre:** ${mix.gig.artist.genre.join(', ')}\n`;
  md += `**Datum:** ${mix.gig.date}\n\n`;

  if (mix.aiNotes) {
    md += '## AI-rekommendationer\n\n';
    if (mix.aiNotes.genreRecommendations.length > 0) {
      md += '### Genre-baserade val\n';
      for (const rec of mix.aiNotes.genreRecommendations) {
        md += `- ${rec}\n`;
      }
      md += '\n';
    }
    if (mix.aiNotes.processingDecisions.length > 0) {
      md += '### Processing-beslut\n';
      for (const dec of mix.aiNotes.processingDecisions) {
        md += `- ${dec}\n`;
      }
      md += '\n';
    }
    if (mix.aiNotes.warnings.length > 0) {
      md += '### Varningar\n';
      for (const warn of mix.aiNotes.warnings) {
        md += `⚠️ ${warn}\n`;
      }
      md += '\n';
    }
  }

  md += '## Kanalinställningar\n\n';
  md += '| CH | Namn | HPF | Gain | Komp | Kategori |\n';
  md += '|----|------|-----|------|------|----------|\n';

  for (const ch of mix.currentScene.channels) {
    const hpf = ch.eq.highPassFilter.enabled
      ? `${ch.eq.highPassFilter.frequency}Hz`
      : 'OFF';
    const gain = `${ch.input.gain >= 0 ? '+' : ''}${ch.input.gain}dB`;
    const comp = ch.dynamics.compressor.enabled
      ? `${ch.dynamics.compressor.ratio}:1`
      : 'OFF';
    const cat = ch.category || '-';

    md += `| ${ch.number} | ${ch.name} | ${hpf} | ${gain} | ${comp} | ${cat} |\n`;
  }

  md += '\n## Premium Rack Rekommendationer\n\n';
  md += 'För akustisk/organiskt ljud:\n\n';
  md += '- **Rupert Neve Portico 5033 EQ** - Sång, stränginstrument\n';
  md += '- **Rupert Neve Portico 5043 Comp** - Sång (soft knee, 3:1)\n';
  md += '- **Rev-X Hall** - Huvudreverb (1.5-2.0s, predelay 20-30ms)\n';
  md += '- **SPX Delay** - Subtil slap för sång\n';

  return md;
}

function generateReadmeMD(mix: UniversalMix): string {
  const model = getModelString(mix.console.model);

  return `# Import-instruktioner för ${model}

## Innehåll i denna ZIP

| Fil | Beskrivning |
|-----|-------------|
| InName.csv | Kanalnamn, färger och ikoner |
| InPatch.csv | Input-routing (Dante/Lokal) |
| OutPatch.csv | Output-routing |
| PortRackPatch.csv | Dante-utgångar (PA, Monitor, Rec) |
| MixName.csv | Mix/Aux-bussnamn |
| MtxName.csv | Matrix-namn |
| DCAName.csv | DCA-namn |
| StName.csv | Stereo-ingångar |
| StMonoName.csv | Master-namn |
| PhantomPower.md | Lista på +48V-kanaler |
| ProcessingGuide.md | EQ/Dynamics-rekommendationer |

## Import-steg

### 1. Öppna ${model} Editor
1. Starta Yamaha ${model} Editor på din dator
2. Skapa nytt projekt eller öppna befintligt

### 2. Importera CSV-filer
1. **File → Import → Channel Name Table**
   - Välj \`InName.csv\`
2. **File → Import → Input Patch Table**
   - Välj \`InPatch.csv\`
3. **File → Import → Output Patch Table**
   - Välj \`OutPatch.csv\`
4. Upprepa för övriga filer efter behov

### 3. Spara till USB
1. **File → Save As**
2. Spara till USB-minne som .CLF-fil
3. Sätt i USB i ${model}
4. **Load → USB → Välj fil**

## Manuella steg (CSV stödjer inte detta)

⚠️ Följande måste göras manuellt i Editor eller på bordet:

- [ ] Aktivera +48V (se PhantomPower.md)
- [ ] Sätt Gain-nivåer (se ProcessingGuide.md)
- [ ] Konfigurera EQ (se ProcessingGuide.md)
- [ ] Montera Premium Rack-enheter
- [ ] Konfigurera effektprocessorer

## Tips

- Kör Line Check och justera gain efter faktisk nivå
- Börja med faders nere och jobba upp
- Spara ofta under soundcheck

---
*Genererat av Gig-Prepper AI Sound Engineer*
*${new Date().toISOString().split('T')[0]}*
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
    version: '1.1.0',
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
      exportFormats: ['.csv'],
      requiresOfflineEditor: true,
      offlineEditorName: 'Yamaha CL/QL Editor',
      offlineEditorUrl: 'https://www.yamahaproaudio.com/',
      notes: [
        'Använder beprövat CSV-format med [Information]-headers',
        'ASCII-kodning för kompatibilitet',
        'EQ, Gain, Dynamics exporteras som dokumentation',
      ],
    },
  };

  async export(mix: UniversalMix): Promise<ExportResult> {
    const files: ExportFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Generate all CSV files
      files.push({
        filename: 'InName.csv',
        extension: '.csv',
        content: generateInNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Kanalnamn, färger och ikoner',
      });

      files.push({
        filename: 'InPatch.csv',
        extension: '.csv',
        content: generateInPatchCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Input-routing (Dante/Lokal)',
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
        description: 'Dante-utgångar (PA, Monitor, Recording)',
      });

      files.push({
        filename: 'MixName.csv',
        extension: '.csv',
        content: generateMixNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Mix/Aux-bussnamn',
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
        description: 'Stereo-ingångar',
      });

      files.push({
        filename: 'StMonoName.csv',
        extension: '.csv',
        content: generateStMonoNameCSV(mix),
        mimeType: 'text/csv;charset=ascii',
        description: 'Master-namn (ST L/R, Mono)',
      });

      // Generate documentation
      files.push({
        filename: 'PhantomPower.md',
        extension: '.md',
        content: generatePhantomPowerMD(mix),
        mimeType: 'text/markdown',
        description: 'Lista på kanaler som behöver +48V',
      });

      files.push({
        filename: 'ProcessingGuide.md',
        extension: '.md',
        content: generateProcessingGuideMD(mix),
        mimeType: 'text/markdown',
        description: 'EQ, Gain och Dynamics-rekommendationer',
      });

      files.push({
        filename: 'README.md',
        extension: '.md',
        content: generateReadmeMD(mix),
        mimeType: 'text/markdown',
        description: 'Import-instruktioner',
      });

      // Add warnings
      const phantomCount = mix.currentScene.channels.filter(
        ch => ch.input.phantomPower === 'on'
      ).length;
      if (phantomCount > 0) {
        warnings.push(`${phantomCount} kanal(er) kräver +48V. Se PhantomPower.md.`);
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
        '1. Packa upp ZIP-filen till en mapp',
        '2. Öppna Yamaha CL/QL Editor',
        '3. File → Import → Channel Name Table → InName.csv',
        '4. File → Import → Input Patch Table → InPatch.csv',
        '5. Importera övriga CSV-filer efter behov',
        '6. Läs PhantomPower.md och aktivera +48V',
        '7. Läs ProcessingGuide.md för EQ/Gain-tips',
        '8. Spara som .CLF till USB och ladda i bordet',
      ],
    };
  }

  validate(mix: UniversalMix): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check console compatibility
    if (mix.console.manufacturer !== 'yamaha') {
      errors.push(`Fel tillverkare: ${mix.console.manufacturer}. Denna adapter är för Yamaha.`);
    }

    if (!this.info.supportedModels.includes(mix.console.model)) {
      errors.push(`Modellen ${mix.console.model} stöds inte.`);
    }

    // Check channel limits
    const maxChannels: Record<string, number> = {
      cl1: 48, cl3: 64, cl5: 72,
      ql1: 32, ql5: 64,
      tf1: 16, tf3: 24, tf5: 32,
    };

    const max = maxChannels[mix.console.model] || 32;
    if (mix.currentScene.channels.length > max) {
      errors.push(
        `För många kanaler: ${mix.currentScene.channels.length} (max ${max} för ${mix.console.model})`
      );
    }

    // Check name lengths
    for (const ch of mix.currentScene.channels) {
      const displayName = ch.shortName || ch.name;
      if (displayName.length > 8) {
        warnings.push(`"${ch.name}" är för långt (${displayName.length} tecken, max 8)`);
        suggestions.push(`Förkorta "${ch.name}" till max 8 tecken`);
      }
    }

    // Check for special characters
    for (const ch of mix.currentScene.channels) {
      if (/[åäöÅÄÖ]/.test(ch.name)) {
        warnings.push(`"${ch.name}" innehåller svenska tecken som kan orsaka problem`);
        suggestions.push(`Ersätt å→a, ä→a, ö→o i "${ch.name}"`);
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
registerAdapter(
  'yamaha',
  ['cl1', 'cl3', 'cl5', 'ql1', 'ql5', 'tf1', 'tf3', 'tf5'],
  () => new YamahaAdapter()
);

export default YamahaAdapter;

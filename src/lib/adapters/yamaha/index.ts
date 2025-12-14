/**
 * Yamaha CL/QL/TF Adapter
 *
 * Genererar CSV-filer för import via Yamaha CL/QL Editor.
 * Baserat på Yamaha's strikta CSV-format med headers.
 *
 * Begränsningar:
 * - CSV kan INTE sätta EQ, Gain, Faders eller Premium Rack
 * - Dessa genereras som PDF-dokumentation istället
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
  ConsoleModel,
} from '../../models/universal-mix';

// ============================================================================
// Yamaha Color Mapping
// ============================================================================

const YAMAHA_COLORS: Record<string, number> = {
  off: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  orange: 8,
  pink: 1, // Map to red
  purple: 5, // Map to magenta
  lime: 2, // Map to green
};

// ============================================================================
// CSV Header Templates
// ============================================================================

interface YamahaHeader {
  model: string;
  version: string;
  tableType: string;
}

function generateHeader(header: YamahaHeader): string {
  return `[Information]\n${header.model},${header.version},${header.tableType}\n`;
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

// ============================================================================
// Input Name CSV Generator
// ============================================================================

function generateInputNameCSV(mix: UniversalMix): string {
  const modelStr = getModelString(mix.console.model);
  let csv = generateHeader({
    model: modelStr,
    version: 'V4.1',
    tableType: 'Channel Name Table',
  });

  csv += '\n[Channel Name]\n';
  csv += 'CH,Name,Color\n';

  for (const channel of mix.currentScene.channels) {
    if (channel.type === 'mono' || channel.type === 'stereo') {
      const name = truncateName(channel.shortName || channel.name, 8);
      const color = YAMAHA_COLORS[channel.color.name.toLowerCase()] ?? 7;
      csv += `IN ${channel.number},${name},${color}\n`;
    }
  }

  return csv;
}

// ============================================================================
// Output Name CSV Generator
// ============================================================================

function generateOutputNameCSV(mix: UniversalMix): string {
  const modelStr = getModelString(mix.console.model);
  let csv = generateHeader({
    model: modelStr,
    version: 'V4.1',
    tableType: 'Output Name Table',
  });

  csv += '\n[Output Name]\n';
  csv += 'Output,Name,Color\n';

  for (const bus of mix.currentScene.buses) {
    const name = truncateName(bus.shortName || bus.name, 8);
    const color = YAMAHA_COLORS[bus.color.name.toLowerCase()] ?? 7;

    if (bus.type === 'aux') {
      csv += `MIX ${bus.number},${name},${color}\n`;
    } else if (bus.type === 'matrix') {
      csv += `MTX ${bus.number},${name},${color}\n`;
    }
  }

  // Add main outputs
  csv += 'ST L,Main L,7\n';
  csv += 'ST R,Main R,7\n';

  return csv;
}

// ============================================================================
// Dante Patch CSV Generator
// ============================================================================

function generateDantePatchCSV(mix: UniversalMix): string {
  const modelStr = getModelString(mix.console.model);
  let csv = generateHeader({
    model: modelStr,
    version: 'V4.1',
    tableType: 'Dante Input Patch Table',
  });

  csv += '\n[Dante Input Patch]\n';
  csv += 'Console Input,Dante Input\n';

  for (const channel of mix.currentScene.channels) {
    if (channel.input.source.type === 'dante' || channel.input.source.type === 'tio') {
      const dantePort = channel.input.source.port;
      csv += `IN ${channel.number},Dante ${dantePort}\n`;
    }
  }

  return csv;
}

// ============================================================================
// Phantom Power List Generator
// ============================================================================

function generatePhantomPowerList(mix: UniversalMix): string {
  let md = '# Fantommatning (+48V)\n\n';
  md += 'Följande kanaler behöver fantommatning:\n\n';
  md += '| Kanal | Namn | Mikrofon |\n';
  md += '|-------|------|----------|\n';

  const phantomChannels = mix.currentScene.channels.filter(
    (ch) => ch.input.phantomPower === 'on'
  );

  if (phantomChannels.length === 0) {
    md += '| - | Inga kanaler kräver fantommatning | - |\n';
  } else {
    for (const ch of phantomChannels) {
      md += `| IN ${ch.number} | ${ch.name} | ${ch.notes || 'Kondensator'} |\n`;
    }
  }

  md += '\n**OBS:** Slå på +48V på Rio/Tio-stagebox eller i QL1 HA-sektionen.\n';

  return md;
}

// ============================================================================
// Gain & EQ Recommendations Generator
// ============================================================================

function generateProcessingGuide(mix: UniversalMix): string {
  let md = '# Processing Guide\n\n';
  md += `**Gig:** ${mix.gig.name}\n`;
  md += `**Artist:** ${mix.gig.artist.name}\n`;
  md += `**Genre:** ${mix.gig.artist.genre.join(', ')}\n\n`;

  // AI recommendations if available
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
  }

  md += '## Kanalinställningar\n\n';
  md += '| Kanal | Namn | HPF | Gain (start) | Kompressor | Anteckningar |\n';
  md += '|-------|------|-----|--------------|------------|-------------|\n';

  for (const ch of mix.currentScene.channels) {
    const hpf = ch.eq.highPassFilter.enabled
      ? `${ch.eq.highPassFilter.frequency}Hz`
      : 'OFF';
    const gain = ch.input.gain > 0 ? `+${ch.input.gain}dB` : `${ch.input.gain}dB`;
    const comp = ch.dynamics.compressor.enabled
      ? `${ch.dynamics.compressor.ratio}:1`
      : 'OFF';
    const notes = ch.notes || ch.category || '';

    md += `| IN ${ch.number} | ${ch.name} | ${hpf} | ${gain} | ${comp} | ${notes} |\n`;
  }

  md += '\n## Premium Rack Rekommendationer\n\n';
  md += 'För "varmt, organiskt" ljud, överväg:\n\n';
  md += '- **Rupert Neve Designs Portico 5033 EQ** på huvudsång\n';
  md += '- **Rupert Neve Designs Portico 5043 Comp** på akustiska instrument\n';
  md += '- **Rev-X Hall** för rumskänsla på akustiskt material\n';

  return md;
}

// ============================================================================
// Import Instructions Generator
// ============================================================================

function generateImportInstructions(mix: UniversalMix): string {
  const modelStr = getModelString(mix.console.model);

  return `# Import-instruktioner för ${modelStr}

## Förberedelser

1. Ladda ner och installera **${modelStr} Editor** från Yamaha Pro Audio
2. Packa upp ZIP-filen till en mapp

## Import av CSV-filer

### Steg 1: Öppna Editor
1. Starta ${modelStr} Editor
2. Skapa ett nytt projekt eller öppna befintligt

### Steg 2: Importera Kanalnamn
1. Gå till **File → Import → Channel Name Table**
2. Välj filen \`InName.csv\`
3. Bekräfta importen

### Steg 3: Importera Output-namn
1. Gå till **File → Import → Output Name Table**
2. Välj filen \`OutName.csv\`

### Steg 4: Importera Dante-patch (om tillämpligt)
1. Gå till **Setup → Dante Setup**
2. Importera \`DantePatch.csv\` eller konfigurera manuellt

## Manuella steg (CSV kan inte göra detta)

⚠️ Följande måste ställas in manuellt i Editor eller på bordet:

1. **Fantommatning (+48V)** - Se PhantomPower.md
2. **Gain-nivåer** - Se ProcessingGuide.md
3. **EQ-inställningar** - Se ProcessingGuide.md
4. **Premium Rack** - Montera önskade enheter manuellt

## Spara till USB

1. I Editor: **File → Save As**
2. Spara som .CLF-fil till USB-sticka
3. På ${modelStr}: **Load → USB → Välj fil**

## Tips

- Kör Line Check och justera gain efter verklig nivå
- Dokumentet ProcessingGuide.md har startpunkter för EQ/Dynamics
- Premium Rack-enheter måste monteras manuellt efter import

---
Genererat av Gig-Prepper AI Sound Engineer
${new Date().toISOString().split('T')[0]}
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
    version: '1.0.0',
    author: 'Gig-Prepper',
    capabilities: {
      canExportScene: false, // Full scenes require .CLF which is binary
      canExportInputList: true,
      canExportChannelNames: true,
      canExportPatch: true,
      canExportEQ: false, // Not via CSV
      canExportDynamics: false, // Not via CSV
      canExportRouting: true,
      canExportEffects: false,
      canImportScene: false,
      canImportInputList: false,
      exportFormats: ['.csv'],
      requiresOfflineEditor: true,
      offlineEditorName: 'Yamaha CL/QL Editor',
      offlineEditorUrl: 'https://www.yamahaproaudio.com/',
      notes: [
        'CSV-filer kan endast sätta namn, färger och Dante-patch',
        'EQ, Gain, Dynamics och Premium Rack måste sättas manuellt',
        'Genererar PDF-guide med rekommenderade inställningar',
      ],
    },
  };

  async export(mix: UniversalMix): Promise<ExportResult> {
    const files: ExportFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Generate Input Names CSV
      files.push({
        filename: 'InName.csv',
        extension: '.csv',
        content: generateInputNameCSV(mix),
        mimeType: 'text/csv;charset=utf-8',
        description: 'Kanalnamn för import',
      });

      // Generate Output Names CSV
      files.push({
        filename: 'OutName.csv',
        extension: '.csv',
        content: generateOutputNameCSV(mix),
        mimeType: 'text/csv;charset=utf-8',
        description: 'Output-namn för import',
      });

      // Generate Dante Patch CSV if using Dante
      const hasDante = mix.currentScene.channels.some(
        (ch) => ch.input.source.type === 'dante' || ch.input.source.type === 'tio'
      );
      if (hasDante) {
        files.push({
          filename: 'DantePatch.csv',
          extension: '.csv',
          content: generateDantePatchCSV(mix),
          mimeType: 'text/csv;charset=utf-8',
          description: 'Dante Input Patching',
        });
      }

      // Generate Phantom Power list
      files.push({
        filename: 'PhantomPower.md',
        extension: '.md',
        content: generatePhantomPowerList(mix),
        mimeType: 'text/markdown',
        description: 'Kanaler som kräver +48V',
      });

      // Generate Processing Guide
      files.push({
        filename: 'ProcessingGuide.md',
        extension: '.md',
        content: generateProcessingGuide(mix),
        mimeType: 'text/markdown',
        description: 'EQ, Gain och Dynamics-rekommendationer',
      });

      // Generate Import Instructions
      files.push({
        filename: 'README_Import.md',
        extension: '.md',
        content: generateImportInstructions(mix),
        mimeType: 'text/markdown',
        description: 'Steg-för-steg importinstruktioner',
      });

      // Add warnings for limitations
      if (mix.currentScene.channels.some((ch) => ch.eq.bands.some((b) => b.enabled))) {
        warnings.push(
          'EQ-inställningar finns i mixen men kan inte exporteras till CSV. Se ProcessingGuide.md.'
        );
      }
      if (mix.currentScene.channels.some((ch) => ch.dynamics.compressor.enabled)) {
        warnings.push(
          'Kompressor-inställningar finns men kan inte exporteras. Se ProcessingGuide.md.'
        );
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
        '1. Packa upp ZIP-filen',
        '2. Öppna Yamaha CL/QL Editor',
        '3. Importera CSV-filerna via File → Import',
        '4. Läs ProcessingGuide.md för EQ/Gain-inställningar',
        '5. Spara som .CLF till USB och ladda in i bordet',
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
      errors.push(`Modellen ${mix.console.model} stöds inte av denna adapter.`);
    }

    // Check channel count
    const maxChannels: Record<string, number> = {
      cl1: 48,
      cl3: 64,
      cl5: 72,
      ql1: 32,
      ql5: 64,
      tf1: 16,
      tf3: 24,
      tf5: 32,
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
        warnings.push(`Kanal "${ch.name}" har för långt namn (${displayName.length} tecken, max 8)`);
        suggestions.push(`Förkorta "${ch.name}" till max 8 tecken`);
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

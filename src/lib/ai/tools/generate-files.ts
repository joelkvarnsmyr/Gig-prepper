/**
 * Generate Files Tool
 * Creates console-specific setup files from UniversalMix
 */

import { z } from 'zod';
import { createTool } from './index';
import { UniversalMix } from '@/lib/models/universal-mix';
import { YamahaAdapter } from '@/lib/adapters/yamaha';
import { X32Adapter } from '@/lib/adapters/x32';

// Input schema
const GenerateFilesInputSchema = z.object({
  mix: z.string().describe('UniversalMix JSON string'),
  format: z.enum(['yamaha-csv', 'x32-scene', 'dlive-show']).default('yamaha-csv'),
  includeDocumentation: z.boolean().default(true).describe('Include MD documentation files'),
});

// Output file type
interface GeneratedFile {
  name: string;
  type: 'csv' | 'md' | 'json' | 'scn';
  content: string;
  size: number;
  description: string;
}

/**
 * Main tool implementation
 */
export const generateFilesTool = createTool({
  name: 'generate_files',
  description: `Genererar konsol-specifika setup-filer från UniversalMix.

STÖDD UTRUSTNING:

För Yamaha (CL/QL/TF):
- CSV-filer för USB-import: InName, InPatch, OutPatch, etc.
- MD-dokumentation för inställningar som inte kan importeras (EQ, dynamik, effekter)
- OBS: Yamaha CSV kan ENDAST importera namn, färger, patching och DCA-namn

För Behringer X32 / Midas M32:
- .scn scene-fil för USB-import
- Komplett konfiguration inkl. EQ, dynamik, effekter, routing
- Inga manuella inställningar behövs

Returnerar en lista med filer redo för nedladdning som ZIP.`,

  schema: GenerateFilesInputSchema,

  func: async (input): Promise<string> => {
    try {
      const { mix: mixJson, format, includeDocumentation } = GenerateFilesInputSchema.parse(input);

      // Parse the mix
      let mix: UniversalMix;
      try {
        mix = JSON.parse(mixJson);
      } catch {
        // If it's already an object (from previous tool), use it directly
        mix = mixJson as unknown as UniversalMix;
      }

      // Validate basic structure
      if (!mix.currentScene?.channels) {
        return JSON.stringify({
          success: false,
          error: 'Invalid mix: missing currentScene.channels',
        });
      }

      const files: GeneratedFile[] = [];

      switch (format) {
        case 'yamaha-csv': {
          const adapter = new YamahaAdapter();
          const adapterFiles = adapter.generate(mix);

          for (const file of adapterFiles) {
            // Filter documentation if not requested
            if (!includeDocumentation && file.name.endsWith('.md')) {
              continue;
            }

            files.push({
              name: file.name,
              type: file.name.endsWith('.csv') ? 'csv' : 'md',
              content: file.content,
              size: file.content.length,
              description: getFileDescription(file.name),
            });
          }
          break;
        }

        case 'x32-scene': {
          const x32Adapter = new X32Adapter();
          const x32Files = x32Adapter.generate(mix);

          for (const file of x32Files) {
            // Filter documentation if not requested
            if (!includeDocumentation && file.name.endsWith('.md')) {
              continue;
            }

            files.push({
              name: file.name,
              type: file.name.endsWith('.scn') ? 'scn' : 'md',
              content: file.content,
              size: file.content.length,
              description: getFileDescription(file.name),
            });
          }
          break;
        }

        case 'dlive-show':
          return JSON.stringify({
            success: false,
            error: 'Allen & Heath dLive adapter not yet implemented. Coming soon!',
            supportedFormats: ['yamaha-csv'],
          });

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown format: ${format}`,
            supportedFormats: ['yamaha-csv'],
          });
      }

      // Categorize files
      const csvFiles = files.filter((f) => f.type === 'csv');
      const scnFiles = files.filter((f) => f.type === 'scn');
      const mdFiles = files.filter((f) => f.type === 'md');

      return JSON.stringify({
        success: true,
        format,
        totalFiles: files.length,
        csvFiles: csvFiles.length,
        sceneFiles: scnFiles.length,
        documentationFiles: mdFiles.length,
        files: files.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          description: f.description,
          // Include content for smaller files, truncate large ones
          content: f.content.length > 10000
            ? f.content.substring(0, 10000) + '\n... (truncated)'
            : f.content,
        })),
        instructions: getImportInstructions(format),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});

/**
 * Get description for each file type
 */
function getFileDescription(filename: string): string {
  const descriptions: Record<string, string> = {
    // Yamaha CSV files
    'InName.csv': 'Kanalnamn, färger och ikoner för input-kanaler',
    'InPatch.csv': 'Input patching (vilken fysisk ingång till vilken kanal)',
    'OutPatch.csv': 'Output patching (vilken buss till vilken fysisk utgång)',
    'PortRackPatch.csv': 'Dante/stagebox routing',
    'MixName.csv': 'Namn på Mix-bussar (monitorer)',
    'MtxName.csv': 'Namn på Matrix-bussar',
    'DCAName.csv': 'Namn på DCA-grupper',
    'StName.csv': 'Namn på stereo-kanaler',
    'StMonoName.csv': 'Namn på stereo-till-mono-kanaler',
    // Documentation files
    'README.md': 'Översikt och snabbstart-guide',
    'MASTER.md': 'Komplett setup-dokumentation',
    'GainSheet.md': 'Föreslagna gain-värden per kanal',
    'PhantomPower.md': 'Phantom power-konfiguration',
    'EQ_Guide.md': 'EQ-inställningar och rekommendationer',
    'Dynamics_Guide.md': 'Gate och kompressor-inställningar',
    'Effects_Rack.md': 'Effekt-rack konfiguration (reverb, delay, etc.)',
    'Premium_Rack.md': 'Premium Rack-inställningar (Yamaha)',
    'Monitor_Guide.md': 'Monitor-mixar och routing',
  };

  // X32 scene files (dynamic name based on gig)
  if (filename.endsWith('.scn')) {
    return 'X32/M32 Scene fil - komplett konsol-konfiguration';
  }

  return descriptions[filename] || 'Setup file';
}

/**
 * Get import instructions for the format
 */
function getImportInstructions(format: string): string[] {
  switch (format) {
    case 'yamaha-csv':
      return [
        '1. Kopiera alla CSV-filer till ett USB-minne (FAT32-formaterat)',
        '2. Sätt in USB-minnet i konsolen',
        '3. Gå till SETUP > SAVE/LOAD på konsolen',
        '4. Välj USB och sedan LOAD',
        '5. Välj "LOAD LIBRARY" och sedan lämplig fil-typ',
        '6. Välj filen och bekräfta import',
        '7. Upprepa för varje CSV-fil',
        '',
        'OBS: Läs MD-dokumentationen för EQ, dynamik och effekt-inställningar',
        'som måste göras manuellt på konsolen.',
      ];

    case 'x32-scene':
      return [
        '1. Kopiera .scn-filen till ett USB-minne (FAT32-formaterat)',
        '2. Sätt in USB-minnet i X32/M32',
        '3. Tryck på UTILITY-knappen',
        '4. Välj USB → LOAD → SCENE',
        '5. Navigera till .scn-filen och välj den',
        '6. Tryck LOAD och bekräfta',
        '7. Verifiera inställningar och kör line check',
        '',
        'OBS: Scenen innehåller komplett konfiguration inkl. EQ, dynamik och effekter.',
      ];

    case 'dlive-show':
      return ['dLive import instructions coming soon'];

    default:
      return ['See console manual for import instructions'];
  }
}

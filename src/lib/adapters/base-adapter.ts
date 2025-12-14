/**
 * Base Console Adapter Interface
 *
 * All console-specific adapters implement this interface.
 * The adapter translates between UniversalMix and console-specific file formats.
 */

import { UniversalMix, ConsoleManufacturer, ConsoleModel } from '../models/universal-mix';

// ============================================================================
// Export Formats
// ============================================================================

export interface ExportFile {
  filename: string;
  extension: string;
  content: string | Uint8Array;
  mimeType: string;
  description: string;
}

export interface ExportResult {
  success: boolean;
  files: ExportFile[];
  warnings: string[];
  errors: string[];
  instructions: string[];  // Step-by-step import instructions for the user
}

// ============================================================================
// Import Formats
// ============================================================================

export interface ImportResult {
  success: boolean;
  mix?: UniversalMix;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Adapter Capabilities
// ============================================================================

export interface AdapterCapabilities {
  // What can this adapter export?
  canExportScene: boolean;
  canExportInputList: boolean;
  canExportChannelNames: boolean;
  canExportPatch: boolean;
  canExportEQ: boolean;
  canExportDynamics: boolean;
  canExportRouting: boolean;
  canExportEffects: boolean;

  // What can this adapter import?
  canImportScene: boolean;
  canImportInputList: boolean;

  // Export file formats
  exportFormats: string[];  // e.g., ['.clf', '.csv', '.xml']

  // Does this require the offline editor?
  requiresOfflineEditor: boolean;
  offlineEditorName?: string;
  offlineEditorUrl?: string;

  // Special notes
  notes: string[];
}

// ============================================================================
// Adapter Metadata
// ============================================================================

export interface AdapterInfo {
  manufacturer: ConsoleManufacturer;
  supportedModels: ConsoleModel[];
  name: string;
  version: string;
  author: string;
  capabilities: AdapterCapabilities;
}

// ============================================================================
// Base Adapter Interface
// ============================================================================

export interface ConsoleAdapter {
  // Adapter metadata
  readonly info: AdapterInfo;

  // Export to console format
  export(mix: UniversalMix): Promise<ExportResult>;

  // Import from console format
  import?(fileContent: string | Uint8Array, filename: string): Promise<ImportResult>;

  // Validate if the mix is compatible with this console
  validate(mix: UniversalMix): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ============================================================================
// Adapter Registry
// ============================================================================

export type AdapterFactory = () => ConsoleAdapter;

const adapterRegistry = new Map<ConsoleManufacturer, Map<ConsoleModel, AdapterFactory>>();

export function registerAdapter(
  manufacturer: ConsoleManufacturer,
  models: ConsoleModel[],
  factory: AdapterFactory
): void {
  if (!adapterRegistry.has(manufacturer)) {
    adapterRegistry.set(manufacturer, new Map());
  }
  const manufacturerAdapters = adapterRegistry.get(manufacturer)!;
  for (const model of models) {
    manufacturerAdapters.set(model, factory);
  }
}

export function getAdapter(manufacturer: ConsoleManufacturer, model: ConsoleModel): ConsoleAdapter | null {
  const manufacturerAdapters = adapterRegistry.get(manufacturer);
  if (!manufacturerAdapters) return null;
  const factory = manufacturerAdapters.get(model);
  if (!factory) return null;
  return factory();
}

export function getAvailableAdapters(): AdapterInfo[] {
  const adapters: AdapterInfo[] = [];
  for (const manufacturerAdapters of adapterRegistry.values()) {
    const seenFactories = new Set<AdapterFactory>();
    for (const factory of manufacturerAdapters.values()) {
      if (!seenFactories.has(factory)) {
        seenFactories.add(factory);
        adapters.push(factory().info);
      }
    }
  }
  return adapters;
}

// ============================================================================
// Helper Functions for Adapters
// ============================================================================

export function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength);
}

export function sanitizeForCSV(value: string): string {
  // Escape quotes and wrap in quotes if needed
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function colorNameToIndex(colorName: string, colorMap: Record<string, number>): number {
  const normalizedColor = colorName.toLowerCase();
  return colorMap[normalizedColor] ?? 0;
}

// Standard color mappings (most consoles use similar color schemes)
export const STANDARD_COLORS: Record<string, string> = {
  off: '#333333',
  red: '#FF0000',
  green: '#00FF00',
  yellow: '#FFFF00',
  blue: '#0000FF',
  magenta: '#FF00FF',
  cyan: '#00FFFF',
  white: '#FFFFFF',
  orange: '#FF8000',
  pink: '#FF80FF',
  purple: '#8000FF',
  lime: '#80FF00',
};

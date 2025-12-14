/**
 * Tool Registry
 * Central hub for all AI tools
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Tool interface for consistency
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodSchema;
  func: (input: Record<string, unknown>) => Promise<string>;
}

// Global tool registry
const TOOL_REGISTRY = new Map<string, DynamicStructuredTool>();

/**
 * Create a LangChain tool from our definition
 */
export function createTool(definition: ToolDefinition): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    func: definition.func,
  });
}

/**
 * Register a tool in the global registry
 */
export function registerTool(tool: DynamicStructuredTool): void {
  TOOL_REGISTRY.set(tool.name, tool);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): DynamicStructuredTool | undefined {
  return TOOL_REGISTRY.get(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): DynamicStructuredTool[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * Get specific tools by name
 */
export function getTools(names: string[]): DynamicStructuredTool[] {
  return names
    .map((name) => TOOL_REGISTRY.get(name))
    .filter((tool): tool is DynamicStructuredTool => tool !== undefined);
}

/**
 * Initialize all tools - call this at app startup
 */
export async function initializeTools(): Promise<void> {
  // Import and register all tools
  const { parseRiderTool } = await import('./parse-rider');
  const { buildMixTool } = await import('./build-mix');
  const { generateFilesTool } = await import('./generate-files');
  const { suggestSettingsTool } = await import('./suggest-settings');

  registerTool(parseRiderTool);
  registerTool(buildMixTool);
  registerTool(generateFilesTool);
  registerTool(suggestSettingsTool);

  console.log(`[Tools] Initialized ${TOOL_REGISTRY.size} tools`);
}

/**
 * List all available tools with their descriptions
 */
export function listTools(): Array<{ name: string; description: string }> {
  return Array.from(TOOL_REGISTRY.entries()).map(([name, tool]) => ({
    name,
    description: tool.description,
  }));
}

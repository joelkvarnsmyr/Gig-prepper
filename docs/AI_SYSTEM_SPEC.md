# AI System Technical Specification

## Gig-Prepper AI Sound Engineer

Version: 1.0
Date: 2024-12-14
Status: Draft

---

## 1. Overview

### 1.1 Purpose

The AI system enables sound technicians to prepare mixing console configurations through natural language conversation. The AI parses technical riders (PDF), understands audio context, and generates console-specific setup files.

### 1.2 Core Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│  • Natural language (Swedish/English)                           │
│  • PDF rider upload                                             │
│  • Console/stagebox selection                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI AGENT SYSTEM                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Grok      │  │   Gemini    │  │   Claude    │             │
│  │   (xAI)     │  │  (Google)   │  │ (Anthropic) │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   LangChain Agent     │                          │
│              │   (ReAct Pattern)     │                          │
│              └───────────┬───────────┘                          │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ PDF Parser  │  │ Mix Builder │  │ File Gen    │             │
│  │    Tool     │  │    Tool     │  │    Tool     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                   │
│  • UniversalMix JSON                                            │
│  • Console CSV files (Yamaha)                                   │
│  • Documentation (MD)                                           │
│  • Setup instructions                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Core Dependencies

```json
{
  "dependencies": {
    "langchain": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "@langchain/google-genai": "^0.1.x",
    "@langchain/xai": "^0.1.x",
    "@langchain/anthropic": "^0.3.x",
    "@langchain/community": "^0.3.x",
    "pdf-parse": "^1.1.x",
    "zod": "^3.23.x"
  }
}
```

### 2.2 Provider Support Matrix

| Provider | Model | Use Case | Rate Limit | Cost |
|----------|-------|----------|------------|------|
| xAI (Grok) | grok-2 | Primary reasoning | 60 req/min | $5/1M tokens |
| Google | gemini-1.5-pro | Document analysis | 60 req/min | $3.50/1M tokens |
| Google | gemini-1.5-flash | Quick tasks | 60 req/min | $0.35/1M tokens |
| Anthropic | claude-3-5-sonnet | Complex reasoning | 50 req/min | $3/1M tokens |

---

## 3. Architecture

### 3.1 Module Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── index.ts           # Provider factory
│   │   │   ├── grok.ts            # xAI Grok config
│   │   │   ├── gemini.ts          # Google Gemini config
│   │   │   └── claude.ts          # Anthropic Claude config
│   │   │
│   │   ├── agents/
│   │   │   ├── index.ts           # Agent factory
│   │   │   ├── gig-prepper.ts     # Main orchestrator agent
│   │   │   ├── rider-parser.ts    # PDF analysis agent
│   │   │   └── mix-builder.ts     # Mix configuration agent
│   │   │
│   │   ├── tools/
│   │   │   ├── index.ts           # Tool registry
│   │   │   ├── parse-rider.ts     # PDF parsing tool
│   │   │   ├── build-mix.ts       # UniversalMix builder
│   │   │   ├── generate-files.ts  # Console file generator
│   │   │   ├── suggest-settings.ts # Genre-based suggestions
│   │   │   └── validate-patch.ts  # Patch validation
│   │   │
│   │   ├── memory/
│   │   │   ├── index.ts           # Memory manager
│   │   │   ├── conversation.ts    # Chat history
│   │   │   └── session.ts         # Session state
│   │   │
│   │   └── prompts/
│   │       ├── system.ts          # System prompts
│   │       ├── rider-parser.ts    # Rider parsing prompts
│   │       └── mix-builder.ts     # Mix building prompts
│   │
│   ├── models/
│   │   └── universal-mix.ts       # Core data model (exists)
│   │
│   └── adapters/
│       └── yamaha/                # Console adapters (exists)
│
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts           # Chat endpoint
│   │   ├── upload/
│   │   │   └── route.ts           # File upload endpoint
│   │   └── generate/
│   │       └── route.ts           # File generation endpoint
│   │
│   └── chat/
│       └── page.tsx               # Chat UI
```

### 3.2 Provider Abstraction Layer

```typescript
// src/lib/ai/providers/index.ts

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatXAI } from "@langchain/xai";
import { ChatAnthropic } from "@langchain/anthropic";

export type ProviderType = 'grok' | 'gemini' | 'gemini-flash' | 'claude';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export function createProvider(config: ProviderConfig): BaseChatModel {
  const { provider, apiKey, temperature = 0.7, maxTokens = 4096 } = config;

  switch (provider) {
    case 'grok':
      return new ChatXAI({
        model: "grok-2",
        apiKey,
        temperature,
        maxTokens,
      });

    case 'gemini':
      return new ChatGoogleGenerativeAI({
        model: "gemini-1.5-pro",
        apiKey,
        temperature,
        maxOutputTokens: maxTokens,
      });

    case 'gemini-flash':
      return new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        apiKey,
        temperature,
        maxOutputTokens: maxTokens,
      });

    case 'claude':
      return new ChatAnthropic({
        model: "claude-3-5-sonnet-20241022",
        apiKey,
        temperature,
        maxTokens,
      });

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Provider capabilities
export const PROVIDER_CAPABILITIES: Record<ProviderType, {
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  contextWindow: number;
}> = {
  grok: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 131072,
  },
  gemini: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 2097152,  // 2M tokens
  },
  'gemini-flash': {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 1048576,  // 1M tokens
  },
  claude: {
    vision: true,
    functionCalling: true,
    streaming: true,
    contextWindow: 200000,
  },
};
```

---

## 4. Tool System

### 4.1 Tool Interface

```typescript
// src/lib/ai/tools/index.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export interface GigPrepperToolConfig {
  name: string;
  description: string;
  schema: z.ZodSchema;
  func: (input: unknown) => Promise<string>;
}

export function createTool(config: GigPrepperToolConfig): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: config.name,
    description: config.description,
    schema: config.schema,
    func: config.func,
  });
}
```

### 4.2 Core Tools

#### 4.2.1 Parse Rider Tool

```typescript
// src/lib/ai/tools/parse-rider.ts

import { z } from "zod";
import { createTool } from "./index";

const ParseRiderSchema = z.object({
  pdfContent: z.string().describe("Base64 encoded PDF content"),
  language: z.enum(["sv", "en"]).default("sv").describe("Expected language"),
});

export const parseRiderTool = createTool({
  name: "parse_rider",
  description: `
    Parsar en teknisk rider (PDF) och extraherar kanalinformation.
    Returnerar strukturerad data med:
    - Kanallista med instrument/mikrofon
    - Input/output-krav
    - Monitorönskemål
    - Specialbehov (phantom, DI, etc.)
  `,
  schema: ParseRiderSchema,
  func: async (input) => {
    const { pdfContent, language } = ParseRiderSchema.parse(input);

    // PDF parsing logic
    const pdf = await import('pdf-parse');
    const buffer = Buffer.from(pdfContent, 'base64');
    const data = await pdf.default(buffer);

    // Extract channel information using patterns
    const channels = extractChannels(data.text);

    return JSON.stringify({
      success: true,
      channels,
      rawText: data.text,
      pageCount: data.numpages,
    });
  },
});

function extractChannels(text: string): RiderChannel[] {
  // Pattern matching for common rider formats
  const patterns = [
    // "1. Kick - SM91"
    /(\d+)\.\s*([^-–]+)\s*[-–]\s*(.+)/g,
    // "CH1: Vocals (SM58)"
    /CH?\s*(\d+)\s*:\s*([^(]+)\s*\(([^)]+)\)/gi,
    // Table format: "1 | Kick | Beta91"
    /(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)/g,
  ];

  // ... extraction logic
  return [];
}
```

#### 4.2.2 Build Mix Tool

```typescript
// src/lib/ai/tools/build-mix.ts

import { z } from "zod";
import { createTool } from "./index";
import { UniversalMix, Genre, GENRE_PRESETS } from "@/lib/models/universal-mix";

const BuildMixSchema = z.object({
  channels: z.array(z.object({
    number: z.number(),
    name: z.string(),
    instrument: z.string(),
    microphone: z.string().optional(),
  })),
  console: z.object({
    manufacturer: z.enum(["yamaha", "behringer", "midas", "allen-heath"]),
    model: z.string(),
  }),
  stagebox: z.object({
    model: z.string(),
    slot: z.number().default(1),
  }).optional(),
  genre: z.string().optional(),
  gigName: z.string(),
  venue: z.string().optional(),
});

export const buildMixTool = createTool({
  name: "build_mix",
  description: `
    Bygger en UniversalMix från parsed rider-data.
    Applicerar genre-specifika inställningar för EQ, dynamik och effekter.
    Returnerar komplett UniversalMix JSON.
  `,
  schema: BuildMixSchema,
  func: async (input) => {
    const data = BuildMixSchema.parse(input);

    // Get genre preset if available
    const genrePreset = data.genre
      ? GENRE_PRESETS[data.genre as Genre]
      : undefined;

    const mix: UniversalMix = {
      version: "2.0",
      metadata: {
        name: data.gigName,
        venue: data.venue,
        genre: data.genre as Genre,
        createdAt: new Date().toISOString(),
        createdBy: "gig-prepper-ai",
      },
      console: {
        manufacturer: data.console.manufacturer,
        model: data.console.model,
      },
      stagebox: data.stagebox ? {
        model: data.stagebox.model,
        slot: data.stagebox.slot,
        channels: 16,  // Default, will be updated
      } : undefined,
      currentScene: {
        name: "Main",
        channels: data.channels.map((ch, idx) =>
          buildChannel(ch, idx, genrePreset)
        ),
        outputs: buildDefaultOutputs(),
        dcaGroups: buildDefaultDCAs(),
        effectsRack: genrePreset?.defaultReverb
          ? buildEffectsRack(genrePreset)
          : undefined,
      },
    };

    return JSON.stringify(mix, null, 2);
  },
});
```

#### 4.2.3 Generate Files Tool

```typescript
// src/lib/ai/tools/generate-files.ts

import { z } from "zod";
import { createTool } from "./index";
import { YamahaAdapter } from "@/lib/adapters/yamaha";
import { UniversalMix } from "@/lib/models/universal-mix";

const GenerateFilesSchema = z.object({
  mix: z.string().describe("UniversalMix JSON string"),
  format: z.enum(["yamaha-csv", "x32-scene", "dlive-show"]).default("yamaha-csv"),
  includeDocumentation: z.boolean().default(true),
});

export const generateFilesTool = createTool({
  name: "generate_files",
  description: `
    Genererar konsol-specifika setup-filer från UniversalMix.
    För Yamaha: CSV-filer för USB-import + MD-dokumentation.
    Returnerar filnamn och innehåll för nedladdning.
  `,
  schema: GenerateFilesSchema,
  func: async (input) => {
    const { mix: mixJson, format, includeDocumentation } =
      GenerateFilesSchema.parse(input);

    const mix: UniversalMix = JSON.parse(mixJson);

    switch (format) {
      case "yamaha-csv": {
        const adapter = new YamahaAdapter();
        const files = adapter.generate(mix);
        return JSON.stringify({
          success: true,
          fileCount: files.length,
          files: files.map(f => ({
            name: f.name,
            type: f.type,
            size: f.content.length,
            content: f.content,
          })),
        });
      }

      case "x32-scene":
        // Future: X32 adapter
        return JSON.stringify({
          success: false,
          error: "X32 adapter not yet implemented"
        });

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown format: ${format}`
        });
    }
  },
});
```

#### 4.2.4 Suggest Settings Tool

```typescript
// src/lib/ai/tools/suggest-settings.ts

import { z } from "zod";
import { createTool } from "./index";
import {
  Genre,
  GENRE_PRESETS,
  InstrumentCategory,
  EQSettings,
  DynamicsSettings,
} from "@/lib/models/universal-mix";

const SuggestSettingsSchema = z.object({
  instrument: z.string().describe("Instrument name (e.g., 'kick', 'vocals', 'acoustic guitar')"),
  genre: z.string().describe("Music genre"),
  context: z.string().optional().describe("Additional context (e.g., 'lead vocal', 'background')"),
});

export const suggestSettingsTool = createTool({
  name: "suggest_settings",
  description: `
    Föreslår EQ, dynamik och effektinställningar baserat på instrument och genre.
    Använder beprövade ljudtekniker-standarder.
    Returnerar rekommenderade inställningar med förklaringar.
  `,
  schema: SuggestSettingsSchema,
  func: async (input) => {
    const { instrument, genre, context } = SuggestSettingsSchema.parse(input);

    const preset = GENRE_PRESETS[genre as Genre];
    const category = categorizeInstrument(instrument);

    const suggestions = {
      eq: getEQSuggestion(instrument, category, preset),
      dynamics: getDynamicsSuggestion(instrument, category, preset),
      effects: getEffectsSuggestion(instrument, category, preset),
      notes: getSoundEngineerNotes(instrument, genre, context),
    };

    return JSON.stringify(suggestions, null, 2);
  },
});

// Instrument categorization
function categorizeInstrument(name: string): InstrumentCategory {
  const lower = name.toLowerCase();

  if (/kick|bass\s*drum|bd/i.test(lower)) return 'kick';
  if (/snare|sd/i.test(lower)) return 'snare';
  if (/hi-?hat|hh/i.test(lower)) return 'hihat';
  if (/tom/i.test(lower)) return 'toms';
  if (/overhead|oh|cymbal/i.test(lower)) return 'overheads';
  if (/bass|bas\b/i.test(lower)) return 'bass';
  if (/guitar|gtr|git/i.test(lower)) return 'electric-guitar';
  if (/acoustic|akustisk/i.test(lower)) return 'acoustic-guitar';
  if (/key|piano|synth|org/i.test(lower)) return 'keys';
  if (/voc|sång|röst|lead/i.test(lower)) return 'lead-vocal';
  if (/kor|choir|back/i.test(lower)) return 'backing-vocal';
  if (/violin|fiol|cello|viola|strå/i.test(lower)) return 'strings';
  if (/trumpet|sax|horn|blås|brass/i.test(lower)) return 'brass';
  if (/flute|flöjt|clarinet|oboe/i.test(lower)) return 'woodwinds';
  if (/perc|conga|djembe|shaker|tamb/i.test(lower)) return 'percussion';

  return 'other';
}

// EQ suggestions based on sound engineering best practices
function getEQSuggestion(
  instrument: string,
  category: InstrumentCategory,
  preset?: GenrePreset
): EQSettings {
  const suggestions: Record<InstrumentCategory, EQSettings> = {
    'kick': {
      highpass: { frequency: 30, slope: 18 },
      bands: [
        { frequency: 60, gain: 3, q: 1.5, type: 'bell' },    // Thump
        { frequency: 400, gain: -4, q: 2, type: 'bell' },    // Mud removal
        { frequency: 3500, gain: 2, q: 1.2, type: 'bell' },  // Click/attack
      ],
    },
    'snare': {
      highpass: { frequency: 80, slope: 18 },
      bands: [
        { frequency: 200, gain: 2, q: 1.5, type: 'bell' },   // Body
        { frequency: 800, gain: -3, q: 2, type: 'bell' },    // Box removal
        { frequency: 5000, gain: 3, q: 1.2, type: 'bell' },  // Crack
      ],
    },
    'lead-vocal': {
      highpass: { frequency: 80, slope: 12 },
      bands: [
        { frequency: 200, gain: -2, q: 1.5, type: 'bell' },  // Proximity reduction
        { frequency: 3000, gain: 2, q: 1.5, type: 'bell' },  // Presence
        { frequency: 8000, gain: 1, q: 0.7, type: 'highshelf' }, // Air
      ],
    },
    // ... more categories
  };

  return suggestions[category] || { bands: [] };
}
```

### 4.3 Tool Registry

```typescript
// src/lib/ai/tools/registry.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { parseRiderTool } from "./parse-rider";
import { buildMixTool } from "./build-mix";
import { generateFilesTool } from "./generate-files";
import { suggestSettingsTool } from "./suggest-settings";

export const TOOL_REGISTRY: Map<string, DynamicStructuredTool> = new Map([
  ["parse_rider", parseRiderTool],
  ["build_mix", buildMixTool],
  ["generate_files", generateFilesTool],
  ["suggest_settings", suggestSettingsTool],
]);

export function getTools(names?: string[]): DynamicStructuredTool[] {
  if (!names) {
    return Array.from(TOOL_REGISTRY.values());
  }

  return names
    .map(name => TOOL_REGISTRY.get(name))
    .filter((tool): tool is DynamicStructuredTool => tool !== undefined);
}

export function registerTool(tool: DynamicStructuredTool): void {
  TOOL_REGISTRY.set(tool.name, tool);
}
```

---

## 5. Agent System

### 5.1 Main Orchestrator Agent

```typescript
// src/lib/ai/agents/gig-prepper.ts

import { AgentExecutor, createReactAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getTools } from "../tools/registry";

const SYSTEM_PROMPT = `Du är Gig-Prepper AI, en erfaren ljudtekniker-assistent.

Din uppgift är att hjälpa ljudtekniker förbereda mixerbord för spelningar genom att:
1. Analysera tekniska riders (PDF)
2. Förstå spelningens kontext (genre, venue, band)
3. Skapa optimala konfigurationer för deras konsol
4. Generera setup-filer och dokumentation

VIKTIGT:
- Fråga om det saknas kritisk information (konsol-modell, antal kanaler)
- Föreslå genre-anpassade inställningar baserat på din erfarenhet
- Var proaktiv med förslag men respektera teknikerns beslut
- Alla kanalnummer börjar på 1 (inte 0)
- Yamaha CSV-filer har begränsningar - informera om vad som blir dokumentation vs setup-fil

Tillgängliga verktyg:
- parse_rider: Analysera PDF-rider
- build_mix: Bygg UniversalMix från kanaldata
- generate_files: Generera konsol-filer
- suggest_settings: Föreslå EQ/dynamik baserat på genre

Svara alltid på samma språk som användaren (svenska/engelska).`;

export async function createGigPrepperAgent(
  llm: BaseChatModel
): Promise<AgentExecutor> {
  const tools = getTools();

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createReactAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: process.env.NODE_ENV === "development",
    maxIterations: 10,
    returnIntermediateSteps: true,
  });
}
```

### 5.2 Agent State Management

```typescript
// src/lib/ai/memory/session.ts

import { BufferMemory } from "langchain/memory";
import { UniversalMix } from "@/lib/models/universal-mix";

export interface GigPrepperSession {
  id: string;
  createdAt: Date;
  provider: ProviderType;
  memory: BufferMemory;

  // Current work state
  currentMix: UniversalMix | null;
  uploadedRider: {
    filename: string;
    content: string;
    parsed: boolean;
  } | null;

  // User preferences (learned during conversation)
  preferences: {
    console?: { manufacturer: string; model: string };
    stagebox?: { model: string; slot: number };
    defaultGenre?: string;
    language: 'sv' | 'en';
  };
}

export class SessionManager {
  private sessions: Map<string, GigPrepperSession> = new Map();

  create(provider: ProviderType): GigPrepperSession {
    const session: GigPrepperSession = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      provider,
      memory: new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
      }),
      currentMix: null,
      uploadedRider: null,
      preferences: {
        language: 'sv',
      },
    };

    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): GigPrepperSession | undefined {
    return this.sessions.get(id);
  }

  update(id: string, updates: Partial<GigPrepperSession>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates);
    }
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}

export const sessionManager = new SessionManager();
```

---

## 6. API Endpoints

### 6.1 Chat Endpoint

```typescript
// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createProvider, ProviderType } from "@/lib/ai/providers";
import { createGigPrepperAgent } from "@/lib/ai/agents/gig-prepper";
import { sessionManager } from "@/lib/ai/memory/session";

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      sessionId,
      provider = 'gemini'
    } = await request.json();

    // Get or create session
    let session = sessionId
      ? sessionManager.get(sessionId)
      : null;

    if (!session) {
      session = sessionManager.create(provider as ProviderType);
    }

    // Create provider and agent
    const llm = createProvider({
      provider: session.provider,
      apiKey: getApiKey(session.provider),
    });

    const agent = await createGigPrepperAgent(llm);

    // Execute agent
    const result = await agent.invoke({
      input: message,
      chat_history: await session.memory.loadMemoryVariables({}),
    });

    // Save to memory
    await session.memory.saveContext(
      { input: message },
      { output: result.output }
    );

    return NextResponse.json({
      sessionId: session.id,
      message: result.output,
      intermediateSteps: result.intermediateSteps,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

function getApiKey(provider: ProviderType): string {
  const keys: Record<ProviderType, string | undefined> = {
    grok: process.env.XAI_API_KEY,
    gemini: process.env.GOOGLE_API_KEY,
    'gemini-flash': process.env.GOOGLE_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
  };

  const key = keys[provider];
  if (!key) {
    throw new Error(`API key not configured for provider: ${provider}`);
  }
  return key;
}
```

### 6.2 File Upload Endpoint

```typescript
// src/app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/ai/memory/session";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString("base64");

    // Update session with uploaded rider
    if (sessionId) {
      sessionManager.update(sessionId, {
        uploadedRider: {
          filename: file.name,
          content: base64Content,
          parsed: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
```

### 6.3 Generate Files Endpoint

```typescript
// src/app/api/generate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/ai/memory/session";
import { YamahaAdapter } from "@/lib/adapters/yamaha";
import JSZip from "jszip";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, format = "yamaha-csv" } = await request.json();

    const session = sessionManager.get(sessionId);
    if (!session?.currentMix) {
      return NextResponse.json(
        { error: "No mix data in session" },
        { status: 400 }
      );
    }

    // Generate files based on format
    let files: { name: string; content: string }[];

    switch (format) {
      case "yamaha-csv":
        const adapter = new YamahaAdapter();
        files = adapter.generate(session.currentMix);
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported format: ${format}` },
          { status: 400 }
        );
    }

    // Create ZIP archive
    const zip = new JSZip();
    const folderName = `${session.currentMix.metadata.name}_${format}`;
    const folder = zip.folder(folderName);

    for (const file of files) {
      folder?.file(file.name, file.content);
    }

    const zipContent = await zip.generateAsync({ type: "base64" });

    return NextResponse.json({
      success: true,
      filename: `${folderName}.zip`,
      content: zipContent,
      fileCount: files.length,
    });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate files" },
      { status: 500 }
    );
  }
}
```

---

## 7. Streaming Response

### 7.1 Streaming Chat Endpoint

```typescript
// src/app/api/chat/stream/route.ts

import { NextRequest } from "next/server";
import { StreamingTextResponse } from "ai";
import { createProvider } from "@/lib/ai/providers";
import { createGigPrepperAgent } from "@/lib/ai/agents/gig-prepper";

export async function POST(request: NextRequest) {
  const { message, sessionId, provider = 'gemini' } = await request.json();

  const llm = createProvider({
    provider,
    apiKey: getApiKey(provider),
  });

  const agent = await createGigPrepperAgent(llm);

  // Create streaming response
  const stream = await agent.streamEvents(
    { input: message },
    { version: "v2" }
  );

  const textEncoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.event === "on_chat_model_stream") {
          const chunk = event.data?.chunk?.content;
          if (chunk) {
            controller.enqueue(textEncoder.encode(chunk));
          }
        }
      }
      controller.close();
    },
  });

  return new StreamingTextResponse(readableStream);
}
```

---

## 8. Dynamic Tool Creation

### 8.1 Runtime Tool Definition

```typescript
// src/lib/ai/tools/dynamic.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { registerTool } from "./registry";

export interface DynamicToolDefinition {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    description: string;
    required?: boolean;
  }[];
  implementation: string;  // JavaScript code as string
}

export function createDynamicTool(definition: DynamicToolDefinition): DynamicStructuredTool {
  // Build Zod schema from parameters
  const schemaShape: Record<string, z.ZodType> = {};

  for (const param of definition.parameters) {
    let zodType: z.ZodType;

    switch (param.type) {
      case "string":
        zodType = z.string();
        break;
      case "number":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.unknown());
        break;
      case "object":
        zodType = z.record(z.unknown());
        break;
    }

    if (!param.required) {
      zodType = zodType.optional();
    }

    schemaShape[param.name] = zodType.describe(param.description);
  }

  const schema = z.object(schemaShape);

  // Create sandboxed function from implementation
  const func = new Function(
    "input",
    `"use strict"; return (async () => { ${definition.implementation} })()`
  );

  const tool = new DynamicStructuredTool({
    name: definition.name,
    description: definition.description,
    schema,
    func: async (input) => {
      try {
        const result = await func(input);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: String(error) });
      }
    },
  });

  // Register in global registry
  registerTool(tool);

  return tool;
}

// Example: Agent-created tool for delay time calculation
const delayTimeTool = createDynamicTool({
  name: "calculate_delay_time",
  description: "Beräknar delay-tid i millisekunder baserat på BPM och notlängd",
  parameters: [
    { name: "bpm", type: "number", description: "Tempo i BPM", required: true },
    { name: "noteValue", type: "string", description: "Notlängd: quarter, eighth, sixteenth, dotted-eighth", required: true },
  ],
  implementation: `
    const { bpm, noteValue } = input;
    const quarterNote = 60000 / bpm;

    const multipliers = {
      'quarter': 1,
      'eighth': 0.5,
      'sixteenth': 0.25,
      'dotted-eighth': 0.75,
      'triplet': 0.333,
    };

    const multiplier = multipliers[noteValue] || 1;
    const delayMs = Math.round(quarterNote * multiplier);

    return {
      bpm,
      noteValue,
      delayMs,
      delaySeconds: (delayMs / 1000).toFixed(3),
    };
  `,
});
```

---

## 9. Error Handling

### 9.1 Error Types

```typescript
// src/lib/ai/errors.ts

export class GigPrepperError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = "GigPrepperError";
  }
}

export class ProviderError extends GigPrepperError {
  constructor(
    provider: string,
    message: string,
    public statusCode?: number
  ) {
    super(
      `${provider} error: ${message}`,
      "PROVIDER_ERROR",
      statusCode !== 401 // Recoverable unless auth error
    );
  }
}

export class RiderParseError extends GigPrepperError {
  constructor(message: string, public pdfInfo?: { pages: number }) {
    super(message, "RIDER_PARSE_ERROR", true);
  }
}

export class ValidationError extends GigPrepperError {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message, "VALIDATION_ERROR", true);
  }
}
```

### 9.2 Error Recovery

```typescript
// src/lib/ai/error-handler.ts

import { ProviderError } from "./errors";
import { ProviderType } from "./providers";

const FALLBACK_CHAIN: ProviderType[] = ['gemini', 'grok', 'claude'];

export async function withFallback<T>(
  primaryProvider: ProviderType,
  operation: (provider: ProviderType) => Promise<T>
): Promise<T> {
  const providers = [
    primaryProvider,
    ...FALLBACK_CHAIN.filter(p => p !== primaryProvider),
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      return await operation(provider);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof ProviderError && !error.recoverable) {
        throw error; // Don't retry on auth errors
      }

      console.warn(`Provider ${provider} failed, trying next...`);
    }
  }

  throw lastError || new Error("All providers failed");
}
```

---

## 10. Configuration

### 10.1 Environment Variables

```bash
# .env.local

# AI Providers
XAI_API_KEY=xai-...          # Grok
GOOGLE_API_KEY=AIza...       # Gemini
ANTHROPIC_API_KEY=sk-ant-... # Claude

# Default Settings
DEFAULT_PROVIDER=gemini
DEFAULT_LANGUAGE=sv

# Feature Flags
ENABLE_DYNAMIC_TOOLS=true
ENABLE_STREAMING=true
DEBUG_AGENT=false
```

### 10.2 Runtime Configuration

```typescript
// src/lib/ai/config.ts

export interface AIConfig {
  defaultProvider: ProviderType;
  enableDynamicTools: boolean;
  enableStreaming: boolean;
  maxIterations: number;
  timeout: number;
}

export const config: AIConfig = {
  defaultProvider: (process.env.DEFAULT_PROVIDER as ProviderType) || 'gemini',
  enableDynamicTools: process.env.ENABLE_DYNAMIC_TOOLS === 'true',
  enableStreaming: process.env.ENABLE_STREAMING !== 'false',
  maxIterations: 10,
  timeout: 60000, // 60 seconds
};
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// src/lib/ai/__tests__/tools.test.ts

import { describe, it, expect } from "vitest";
import { suggestSettingsTool } from "../tools/suggest-settings";

describe("suggestSettingsTool", () => {
  it("suggests correct EQ for kick drum in rock", async () => {
    const result = await suggestSettingsTool.invoke({
      instrument: "kick",
      genre: "rock",
    });

    const suggestions = JSON.parse(result);
    expect(suggestions.eq.highpass.frequency).toBeLessThanOrEqual(40);
    expect(suggestions.eq.bands).toContainEqual(
      expect.objectContaining({ frequency: expect.any(Number) })
    );
  });

  it("suggests compression for vocals", async () => {
    const result = await suggestSettingsTool.invoke({
      instrument: "lead vocal",
      genre: "pop",
    });

    const suggestions = JSON.parse(result);
    expect(suggestions.dynamics.compressor).toBeDefined();
    expect(suggestions.dynamics.compressor.ratio).toBeGreaterThan(1);
  });
});
```

### 11.2 Integration Tests

```typescript
// src/lib/ai/__tests__/agent.integration.test.ts

import { describe, it, expect } from "vitest";
import { createGigPrepperAgent } from "../agents/gig-prepper";
import { createProvider } from "../providers";

describe("GigPrepper Agent Integration", () => {
  it("handles a complete workflow", async () => {
    const llm = createProvider({
      provider: "gemini-flash",  // Use fast model for tests
      apiKey: process.env.GOOGLE_API_KEY!,
    });

    const agent = await createGigPrepperAgent(llm);

    // Step 1: Set up console
    const result1 = await agent.invoke({
      input: "Jag ska köra en spelning med QL1 och Tio1608 i slot 1",
    });
    expect(result1.output).toContain("QL1");

    // Step 2: Add channels
    const result2 = await agent.invoke({
      input: "Vi har: 1. Kick - Beta91, 2. Snare - SM57, 3. Vocals - SM58",
    });
    expect(result2.output).toMatch(/kick|trumma/i);

    // Step 3: Generate files
    const result3 = await agent.invoke({
      input: "Generera CSV-filer för detta",
    });
    expect(result3.intermediateSteps).toContainEqual(
      expect.objectContaining({
        action: expect.objectContaining({ tool: "generate_files" }),
      })
    );
  });
});
```

---

## 12. Future Enhancements

### 12.1 Planned Features

1. **Voice Input**: Whisper API integration for hands-free operation
2. **Image Analysis**: Parse stage plots and handwritten riders
3. **Real-time Collaboration**: Multiple technicians on same session
4. **Console Templates**: Pre-built setups for common scenarios
5. **Learning System**: Improve suggestions based on user feedback

### 12.2 Additional Console Support

- Behringer X32 / Midas M32 (.scn files)
- Allen & Heath dLive (.showfile)
- DiGiCo SD Series
- Soundcraft Vi Series

---

## Appendix A: ReAct Agent Pattern

```
Thought: Användaren vill sätta upp en spelning med QL1 och Tio1608.
         Jag behöver bekräfta konsol-konfigurationen.

Action: Ingen tool behövs, jag förstår konfigurationen.

Observation: QL1 med Tio1608 i slot 1 ger 16 input-kanaler via Dante.

Thought: Jag bör bekräfta detta med användaren och fråga om fler detaljer.

Response: "Perfekt! QL1 med Tio1608 i slot 1 - det ger dig 16 inputs via
           Dante. Har du en rider eller vill du beskriva kanalerna direkt?"
```

---

## Appendix B: Provider Selection Guide

| Scenario | Recommended Provider |
|----------|---------------------|
| Quick channel setup | Gemini Flash |
| Complex rider analysis | Gemini Pro / Claude |
| Creative suggestions | Grok |
| Cost-sensitive | Gemini Flash |
| Maximum accuracy | Claude |

---

*Document generated by Gig-Prepper AI System*
*Last updated: 2024-12-14*

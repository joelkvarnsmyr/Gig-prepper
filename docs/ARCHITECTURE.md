# AI Sound Engineer - Technical Architecture

## Koncept: "Gig-Prep 2.0"

Teknikern pratar med appen som en kollega. AI:n förstår kontext, läser riders och genererar konsolspecifika filer.

### Exempel på Workflow

**Input (Användaren):**
> "Jag ska mixa John & Anna-Karin på en Yamaha QL1. Det är akustisk folkmusik.
> Jag har en Tio1608 stagebox. Här är deras rider."

**AI-Analys:**
1. Läser ridern → Skapar kanallista (Input List)
2. Förstår genren → "Akustiskt, intimt" → Väljer Rev-X Hall, Soft Knee-kompressorer
3. Förstår hårdvaran → "QL1 + Tio1608" → Patchar Dante Inputs 1-16, slår på +48V för kondensatormickar

**Output:**
- CSV-filer för QL Editor (InName.csv, PortRackPatch.csv, etc.)
- PDF-dokumentation med EQ/Gain-rekommendationer
- Körschema och checklistor

---

## Systemarkitektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Chat/Text   │  │ PDF Rider   │  │ Existing    │  │ Console Selection   │ │
│  │ Beskrivning │  │ Upload      │  │ CSV/Scene   │  │ + Stagebox Config   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI SOUND ENGINEER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Claude API (LLM)                                 ││
│  │  • Rider Parsing (OCR + Strukturering)                                  ││
│  │  • Genre-baserade rekommendationer                                      ││
│  │  • Hårdvaru-förståelse                                                  ││
│  │  • Processing-beslut (EQ, Dynamics, Effects)                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UNIVERSAL DATA MODEL (JSON)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ {                                                                       ││
│  │   "gig": { "name": "Adventsstämman", "genre": ["folk", "acoustic"] },  ││
│  │   "console": { "model": "ql1", "stageboxes": ["tio1608-d"] },          ││
│  │   "channels": [                                                         ││
│  │     { "name": "Eva Sång", "input": "Dante 1", "phantom": true, ... }   ││
│  │   ],                                                                    ││
│  │   "aiNotes": { "recommendations": [...], "decisions": [...] }          ││
│  │ }                                                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   YAMAHA ADAPTER      │ │   MIDAS/BEHRINGER     │ │   ALLEN & HEATH       │
│                       │ │   ADAPTER             │ │   ADAPTER             │
│ • InName.csv          │ │                       │ │                       │
│ • PortRackPatch.csv   │ │ • .scn (OSC-baserat)  │ │ • CSV Input List      │
│ • DanteSetup.csv      │ │ • Textredigerbar!     │ │ • .show-filer         │
│ • OutName.csv         │ │                       │ │                       │
│                       │ │                       │ │                       │
│ Format:               │ │ Format:               │ │ Format:               │
│ [Information]         │ │ /ch/01/config/name    │ │ Proprietärt men       │
│ QL1,V4.1,...          │ │ "Kick"                │ │ CSV för namn          │
│ ASCII/UTF-8           │ │ /ch/01/config/color 1 │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT FILES                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Console     │  │ PDF Tech    │  │ Patchlista  │  │ Körschema           │ │
│  │ Import Files│  │ Rider       │  │ (Print)     │  │ (Print)             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Adapter-specifikationer

### Yamaha CL/QL/TF (Prioritet 1)

**Baserat på din erfarenhet med QL1:**

#### CSV-format Krav
```
[Information]
QL1,V4.1,Channel Name Table
```

| Fil | Innehåll | Begränsningar |
|-----|----------|---------------|
| `InName.csv` | Kanalnamn (IN 1-32) | Max 8 tecken |
| `OutName.csv` | Output-namn | Max 8 tecken |
| `PortRackPatch.csv` | Dante/OMNI patching | Endast routing |
| `DanteSetup.csv` | Dante-konfiguration | Device-specifikt |

#### Vad CSV **inte** kan göra
- ❌ EQ-kurvor
- ❌ Gain-värden
- ❌ Fader-positioner
- ❌ Premium Rack-enheter (Neve, etc.)
- ❌ GEQ-inställningar

#### Lösning: Kompletterande dokumentation
AI:n genererar en **PDF/Markdown** med:
- Rekommenderade Gain-nivåer per kanal
- EQ-startpunkter (HPF, parametrisk)
- Dynamik-inställningar
- Premium Rack-rekommendationer (Rupert Neve Portico för sång/fiol)

```typescript
interface YamahaExportResult {
  csvFiles: {
    inName: string;      // Kanalnamn
    outName: string;     // Output-namn
    portRackPatch: string; // Dante-patching
  };
  documentation: {
    gainSheet: string;   // PDF med Gain-rekommendationer
    eqGuide: string;     // PDF med EQ-startpunkter
    rackSetup: string;   // Premium Rack-montering
  };
  instructions: string[]; // Steg-för-steg import
}
```

### Behringer/Midas X32/M32 (Prioritet 2)

**Fördel: Textbaserade .scn-filer (OSC-protokoll)**

```
/ch/01/config/name "Kick"
/ch/01/config/color 1
/ch/01/preamp/trim 0.0
/ch/01/eq/on ON
```

Detta format är **mycket enklare** - vi kan generera kompletta scenefiler med:
- ✅ Kanalnamn och färger
- ✅ Gain/Trim
- ✅ Komplett EQ
- ✅ Dynamics
- ✅ Routing
- ✅ Effekter

### Allen & Heath dLive/Avantis (Prioritet 3)

- CSV för input-listor
- `.show`-filer är binära men A&H har API:er
- Director-software kan importera CSV

---

## AI-lagret (Prompt Engineering)

### Genre-baserade beslut

```typescript
const genrePresets = {
  folk_acoustic: {
    reverb: { type: 'hall', time: 1.8, predelay: 25 },
    dynamics: { knee: 'soft', ratio: 3 },
    eq: {
      vocal: { hpf: 100, presence: '+2dB @ 3kHz' },
      acoustic_guitar: { hpf: 80, body: '-2dB @ 300Hz' }
    },
    philosophy: "Organiskt, varmt, dynamiskt. Minimal processing."
  },
  metal: {
    reverb: { type: 'plate', time: 0.8, predelay: 10 },
    dynamics: { knee: 'hard', ratio: 8 },
    gate: { threshold: -30, attack: 0.5 },
    philosophy: "Tight, punchy, aggressivt. Gate på trummor."
  },
  jazz: {
    reverb: { type: 'room', time: 1.2, predelay: 20 },
    dynamics: { knee: 'soft', ratio: 2 },
    gate: { enabled: false },
    philosophy: "Naturligt, luftigt. Ingen gate, minimal kompression."
  }
};
```

### Rider Parsing Prompt

```
Du är en erfaren ljudtekniker. Analysera denna rider/input-lista och extrahera:

1. Alla kanaler (instrument/mikrofon)
2. Speciella krav (DI, fantommatning, stereo)
3. Monitor-behov
4. Effekt-önskemål

Returnera som strukturerad JSON enligt vårt UniversalMix-schema.

Ridern: {riderContent}
```

### Hardware Understanding Prompt

```
Du konfigurerar en {consoleModel} med följande stageboxar: {stageboxes}.

Skapa optimal patching:
- Dante Input 1-16 → Tio1608 Port 1-16
- Slå på +48V för kondensatormickar: {condenserChannels}
- Namnge kanaler max 8 tecken

Returnera PortRackPatch-konfiguration.
```

---

## Dataflöde: Steg för steg

### 1. Input-fas
```
Användare → "Jag ska mixa folkmusik på QL1 med Tio1608"
         → Laddar upp PDF-rider
         → Väljer konsol + stagebox i UI
```

### 2. AI-bearbetning
```
Claude API:
  → Parsar PDF-rider (extraherar kanallista)
  → Identifierar genre (folk/akustisk)
  → Väljer passande processing (soft knee, Hall reverb)
  → Genererar UniversalMix JSON
```

### 3. Adapter-översättning
```
YamahaAdapter.export(universalMix):
  → Genererar InName.csv med header
  → Genererar PortRackPatch.csv för Dante
  → Skapar PDF med EQ/Gain-guide
  → Returnerar ZIP med alla filer
```

### 4. Output
```
Användare laddar ner:
  - yamaha_setup.zip
    ├── InName.csv
    ├── OutName.csv
    ├── PortRackPatch.csv
    ├── GainSheet.pdf
    ├── EQ_Guide.pdf
    └── README_import.txt
```

---

## Målgrupp & Värdeerbjudande

| Segment | Smärtpunkt | Vår lösning |
|---------|------------|-------------|
| **Freelancers** | Nya bord varje gig | Konsol-agnostisk prep |
| **Rental-firmor** | Nollställa & prep:a snabbt | Batch-generering |
| **Kyrkor/HoW** | Frivilliga tekniker | AI-guidning + best practices |
| **Festivaler** | Snabba byten mellan akter | Scen-filer redo på USB |

**Säljargument:** "Spara 45 minuter admin-tid vid varje gig."

---

## Tech Stack

```
Frontend:        Next.js 14 + TypeScript + Tailwind CSS
AI:              Claude API (Anthropic)
PDF Parsing:     pdf-parse / pdfjs-dist
File Generation: JSZip för nedladdning
State:           React Context / Zustand
```

---

## Filstruktur

```
src/
├── app/
│   ├── page.tsx              # Landing/Dashboard
│   ├── gig/[id]/page.tsx     # Gig-editor
│   └── api/
│       ├── ai/route.ts       # Claude API endpoint
│       └── parse-rider/route.ts
├── lib/
│   ├── models/
│   │   └── universal-mix.ts  # Core data model
│   ├── adapters/
│   │   ├── base-adapter.ts   # Interface
│   │   ├── yamaha/           # Yamaha CL/QL/TF
│   │   ├── midas/            # X32/M32
│   │   └── allen-heath/      # dLive/Avantis
│   ├── services/
│   │   ├── ai-engineer.ts    # AI prompt logic
│   │   └── rider-parser.ts   # PDF extraction
│   └── utils/
│       └── csv-generator.ts
└── components/
    ├── chat/                 # Tekniker-chat UI
    ├── wizard/               # Setup wizard
    └── export/               # Export preview
```

---

## Nästa steg

1. ✅ Universal Data Model (klar)
2. 🔄 Yamaha Adapter (CSV-generering)
3. ⏳ AI Service (Claude integration)
4. ⏳ Chat Interface
5. ⏳ Midas/X32 Adapter
6. ⏳ PDF Rider Parsing

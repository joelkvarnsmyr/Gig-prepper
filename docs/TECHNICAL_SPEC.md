# Gig-Prepper: Technical Specification

## Version 1.0 | December 2024

---

## 1. Executive Summary

**Gig-Prepper** är en AI-driven applikation som hjälper ljudtekniker att förbereda mixerkonsoler för spelningar. Användaren beskriver sitt gig i naturligt språk eller laddar upp en rider (PDF), och systemet genererar konsolspecifika setup-filer.

### Kärnfunktionalitet
- **Input**: Text/chat, PDF-rider, konsol/stagebox-val
- **Processing**: AI-analys med Claude, Universal Data Model
- **Output**: Konsolspecifika filer (CSV, .scn, etc.) redo för USB-import

### Värde
- Sparar 45+ minuter per gig
- Konsol-agnostisk förberedelse
- Professionella rekommendationer baserade på genre

---

## 2. Systemarkitektur

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND                                     │
│                           (Next.js + React)                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   Chat UI   │  │ PDF Upload  │  │Console/     │  │ Export Preview   │   │
│  │             │  │             │  │Stagebox     │  │ & Download       │   │
│  │             │  │             │  │Selector     │  │                  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
└─────────┼────────────────┼────────────────┼──────────────────┼─────────────┘
          │                │                │                  │
          ▼                ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  API LAYER                                   │
│                            (Next.js API Routes)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ /api/ai     │  │ /api/parse- │  │ /api/gig    │  │ /api/export      │   │
│  │             │  │ rider       │  │             │  │                  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
└─────────┼────────────────┼────────────────┼──────────────────┼─────────────┘
          │                │                │                  │
          ▼                ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVICES LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ AI Engineer     │  │ Rider Parser    │  │ Gig Manager                 │ │
│  │ (Claude API)    │  │ (PDF → JSON)    │  │ (CRUD operations)           │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘ │
│           │                    │                          │                 │
│           └────────────────────┼──────────────────────────┘                 │
│                                ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │ Universal Data Model│                                  │
│                    │ (TypeScript/JSON)   │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                              │
│           ┌───────────────────┼───────────────────┐                         │
│           ▼                   ▼                   ▼                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ Yamaha Adapter  │ │ Midas Adapter   │ │ A&H Adapter     │               │
│  │ (CSV export)    │ │ (.scn export)   │ │ (CSV export)    │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Motivation |
|-------|------------|------------|
| Frontend | Next.js 14, React 18, TypeScript | Server Components, App Router |
| Styling | Tailwind CSS | Utility-first, dark mode |
| State | React Context / Zustand | Lightweight, reactive |
| AI | Claude API (Anthropic) | Starkast på strukturerad output |
| PDF | pdf-parse / pdfjs-dist | Rider extraction |
| Files | JSZip | Client-side ZIP generation |
| Storage | LocalStorage / IndexedDB | Offline-first, privacy |

---

## 3. Universal Data Model

### 3.1 Syfte

En **konsol-agnostisk** representation av en mix. All data lagras i detta format och översätts till specifika konsolformat vid export.

### 3.2 Schema Overview

```typescript
interface UniversalMix {
  version: '1.0';
  id: string;
  createdAt: string;
  updatedAt: string;

  // Gig metadata
  gig: {
    name: string;
    date: string;
    artist: { name: string; genre: Genre[] };
    venue: { name: string; type: VenueType };
  };

  // Hardware configuration
  console: {
    manufacturer: 'yamaha' | 'midas' | 'allen-heath' | 'digico';
    model: ConsoleModel;
    stageboxes: Stagebox[];
  };

  // The actual mix data
  currentScene: {
    channels: Channel[];
    buses: Bus[];
    dcas: DCA[];
    effects: EffectProcessor[];
  };

  // AI recommendations
  aiNotes?: {
    genreRecommendations: string[];
    processingDecisions: string[];
    warnings: string[];
  };
}
```

### 3.3 Channel Schema

```typescript
interface Channel {
  id: string;
  number: number;
  name: string;           // Full name: "Eva Sång"
  shortName: string;      // Console display: "Eva Sng" (max 8 chars)

  type: 'mono' | 'stereo';
  color: { name: string };  // 'red', 'blue', 'magenta', etc.

  input: {
    source: {
      type: 'dante' | 'local' | 'aes' | 'madi';
      port: number;
    };
    phantomPower: 'on' | 'off';
    gain: number;           // dB
    phase: boolean;
  };

  eq: {
    enabled: boolean;
    highPassFilter: { enabled: boolean; frequency: number };
    bands: EQBand[];
  };

  dynamics: {
    gate: GateSettings;
    compressor: CompressorSettings;
  };

  fader: number;            // dB (-inf to +10)
  mute: boolean;
  pan: number;              // -100 to +100

  assignedToMain: boolean;
  busSends: BusSend[];
  dcaAssignments: string[];

  category?: string;        // 'vocals', 'strings', 'drums', etc.
  notes?: string;
}
```

---

## 4. Console Adapters

### 4.1 Adapter Interface

```typescript
interface ConsoleAdapter {
  readonly info: AdapterInfo;

  export(mix: UniversalMix): Promise<ExportResult>;
  validate(mix: UniversalMix): ValidationResult;
}

interface ExportResult {
  success: boolean;
  files: ExportFile[];        // Array of files to include in ZIP
  warnings: string[];
  errors: string[];
  instructions: string[];     // User-facing import guide
}
```

### 4.2 Yamaha CL/QL/TF Adapter

**Prioritet**: 1 (Huvudfokus)

#### Filformat

Yamaha CL/QL Editor kräver specifika CSV-filer med headers:

```csv
[Information]
QL1
V4.1
[InName]
IN,NAME,COLOR,ICON,
_01,"Eva Sng","Magenta","Female",
_02,"John","Cyan","Male",
```

#### Genererade filer

| Fil | Innehåll | Begränsningar |
|-----|----------|---------------|
| `InName.csv` | Kanalnamn, färg, ikon | Max 8 tecken |
| `InPatch.csv` | Dante/Local input routing | |
| `OutPatch.csv` | Output routing | |
| `PortRackPatch.csv` | Dante outputs (PA, Rec) | |
| `MixName.csv` | Mix bus namn | |
| `MtxName.csv` | Matrix namn | |
| `DCAName.csv` | DCA namn | |

#### Begränsningar

CSV kan **INTE** exportera:
- EQ-inställningar
- Gain-värden
- Fader-positioner
- Premium Rack-enheter
- GEQ-kurvor

**Lösning**: Generera kompletterande dokumentation:
- `ProcessingGuide.md` - EQ/Dynamics-rekommendationer
- `PhantomPower.md` - Lista på +48V-kanaler
- `README_Import.md` - Steg-för-steg guide

### 4.3 Behringer/Midas X32/M32 Adapter

**Prioritet**: 2

#### Filformat

`.scn`-filer är textbaserade och följer OSC-protokollet:

```
/ch/01/config/name "Kick"
/ch/01/config/color 1
/ch/01/preamp/trim 0.0
/ch/01/eq/on ON
/ch/01/eq/1/type 2
/ch/01/eq/1/f 100.0
/ch/01/eq/1/g 0.0
/ch/01/eq/1/q 2.0
```

#### Fördel

Vi kan exportera **allt**:
- Kanalnamn och färger
- Gain/Trim
- Komplett EQ (alla 4 band)
- Dynamics (Gate + Comp)
- Routing och bussning
- Effektinställningar

### 4.4 Allen & Heath dLive/Avantis Adapter

**Prioritet**: 3

#### Filformat

- CSV för input-listor (Director-kompatibelt)
- `.show`-filer är binära men kan delvis parsas
- API-möjligheter via Director-software

---

## 5. AI Sound Engineer Service

### 5.1 Arkitektur

```typescript
class AISoundEngineer {
  private client: Anthropic;

  // Main entry point - natural language to UniversalMix
  async processRequest(
    userMessage: string,
    context: GigContext
  ): Promise<AIResponse>;

  // Parse a PDF rider into structured data
  async parseRider(pdfContent: string): Promise<RiderData>;

  // Generate genre-appropriate processing settings
  async suggestProcessing(
    channels: Channel[],
    genre: Genre[]
  ): Promise<ProcessingSuggestions>;
}
```

### 5.2 Prompt Engineering

#### System Prompt (Core Identity)

```
Du är en erfaren FOH-ljudtekniker med 20+ års erfarenhet av live-ljud.
Du hjälper användaren att förbereda sin mixerkonsol för ett gig.

Din uppgift är att:
1. Förstå gigets kontext (artist, genre, venue)
2. Analysera rider/input-lista
3. Konfigurera konsolen optimalt
4. Ge professionella rekommendationer

Du har djup kunskap om:
- Yamaha CL/QL/TF, Midas M32/X32, Allen & Heath dLive, DiGiCo SD
- Dante, MADI, AES50 networking
- Genre-specifik processing (Rock, Jazz, Folk, Metal, etc.)
- Mic selection och placering
```

#### Genre Processing Rules

```typescript
const genrePresets: Record<Genre, ProcessingProfile> = {
  'folk': {
    reverb: { type: 'hall', time: 1.8, predelay: 25 },
    compression: { knee: 'soft', ratio: 3, attack: 20 },
    eq: { approach: 'subtractive', hpf: 'gentle' },
    gate: { enabled: false },
    philosophy: "Organiskt, varmt, dynamiskt. Minimal processing."
  },

  'metal': {
    reverb: { type: 'plate', time: 0.8, predelay: 10 },
    compression: { knee: 'hard', ratio: 8, attack: 1 },
    gate: { enabled: true, threshold: -30 },
    philosophy: "Tight, punchy, aggressivt. Gate på trummor."
  },

  'jazz': {
    reverb: { type: 'room', time: 1.2, predelay: 20 },
    compression: { knee: 'soft', ratio: 2, attack: 30 },
    gate: { enabled: false },
    philosophy: "Naturligt, luftigt. Ingen gate, minimal kompression."
  }
};
```

### 5.3 Rider Parsing

```typescript
interface RiderData {
  inputList: InputItem[];
  monitorRequirements: MonitorReq[];
  specialRequirements: string[];
  technicalNotes: string[];
}

interface InputItem {
  channel: number;
  source: string;        // "Kick", "Lead Vocal", etc.
  micPreference?: string; // "SM58", "Beta 91", etc.
  diRequired?: boolean;
  stereo?: boolean;
  notes?: string;
}
```

---

## 6. User Interface

### 6.1 Pages

| Route | Component | Funktion |
|-------|-----------|----------|
| `/` | LandingPage | Marketing, features, CTA |
| `/app` | MainApp | Chat + Setup wizard |
| `/app/gig/[id]` | GigEditor | Edit specific gig |
| `/app/export` | ExportPreview | Preview & download files |

### 6.2 Chat Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  Gig-Prepper AI                                    [Ny setup]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👤 Användare                                             │   │
│  │ Jag ska mixa en akustisk folkduo på Yamaha QL1.         │   │
│  │ De heter John & Anna-Karin. Jag har en Tio1608.         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🤖 AI Sound Engineer                                     │   │
│  │                                                          │   │
│  │ Perfekt! Jag föreslår följande setup för akustisk folk: │   │
│  │                                                          │   │
│  │ **Kanaler:**                                             │   │
│  │ • CH 1-2: Sång (kondensatormickar, +48V)                │   │
│  │ • CH 3-4: Akustiska gitarrer (DI + mic)                 │   │
│  │ • CH 5-6: Fioler (kondensatormickar, +48V)              │   │
│  │                                                          │   │
│  │ **Dante Patch:** Tio1608 In 1-6 → CH 1-6                │   │
│  │                                                          │   │
│  │ **Processing:**                                          │   │
│  │ • Rev-X Hall (1.8s) för sång                            │   │
│  │ • Soft knee-kompression                                  │   │
│  │ • HPF @ 100Hz på sång, 80Hz på stränginstrument         │   │
│  │                                                          │   │
│  │ [📋 Visa detaljer] [⬇️ Exportera] [✏️ Redigera]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [📎 Ladda upp rider] Skriv ett meddelande...          [Skicka] │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Export Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  Export: Yamaha QL1                                    [← Back] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📁 adventsstamman_ql1_setup.zip                               │
│                                                                 │
│  ├── 📄 InName.csv          Kanalnamn & färger                 │
│  ├── 📄 InPatch.csv         Dante input routing                │
│  ├── 📄 PortRackPatch.csv   Dante outputs (PA, Rec)           │
│  ├── 📄 MixName.csv         Monitor-namn                       │
│  ├── 📄 DCAName.csv         DCA-namn                           │
│  ├── 📄 PhantomPower.md     +48V kanallista                    │
│  ├── 📄 ProcessingGuide.md  EQ/Dynamics-guide                  │
│  └── 📄 README_Import.md    Importinstruktioner                │
│                                                                 │
│  ⚠️ Notera: CSV kan inte exportera EQ/Gain-värden.            │
│     Se ProcessingGuide.md för rekommendationer.                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    [⬇️ Ladda ner ZIP]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. API Endpoints

### 7.1 AI Chat

```typescript
// POST /api/ai
interface AIRequest {
  message: string;
  context: {
    gigId?: string;
    console?: ConsoleConfig;
    currentMix?: UniversalMix;
  };
}

interface AIResponse {
  message: string;
  actions?: AIAction[];
  updatedMix?: UniversalMix;
  suggestions?: string[];
}
```

### 7.2 Rider Parsing

```typescript
// POST /api/parse-rider
// Content-Type: multipart/form-data

interface ParseRiderResponse {
  success: boolean;
  data?: {
    inputList: InputItem[];
    rawText: string;
    confidence: number;
  };
  error?: string;
}
```

### 7.3 Export

```typescript
// POST /api/export
interface ExportRequest {
  mix: UniversalMix;
  format: 'yamaha' | 'midas' | 'allen-heath';
}

interface ExportResponse {
  success: boolean;
  files: {
    filename: string;
    content: string;
    mimeType: string;
  }[];
  instructions: string[];
  warnings: string[];
}
```

---

## 8. Data Storage

### 8.1 Client-Side (MVP)

```typescript
// LocalStorage for small data
localStorage.setItem('gig-prepper:gigs', JSON.stringify(gigs));

// IndexedDB for larger data (PDFs, full mixes)
const db = await openDB('gig-prepper', 1, {
  upgrade(db) {
    db.createObjectStore('gigs', { keyPath: 'id' });
    db.createObjectStore('riders', { keyPath: 'id' });
  }
});
```

### 8.2 Future: Cloud Sync

```
User → Auth (Clerk/NextAuth) → Supabase/Firebase → Real-time Sync
```

---

## 9. Security Considerations

### 9.1 API Keys

```typescript
// Server-side only
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY // Never expose to client
});
```

### 9.2 File Handling

- PDF parsing sker server-side
- Validera filtyper och storlek
- Sanitize alla inputs före export

### 9.3 GDPR

- All data lagras lokalt (default)
- Opt-in för cloud sync
- Export/delete user data på begäran

---

## 10. Development Roadmap

### Phase 1: MVP (v0.1)
- [x] Landningssida
- [x] Universal Data Model
- [ ] Yamaha CSV Adapter (fullständig)
- [ ] Basic chat UI
- [ ] Manual channel entry
- [ ] Export to ZIP

### Phase 2: AI Integration (v0.2)
- [ ] Claude API integration
- [ ] Rider PDF parsing
- [ ] Genre-based suggestions
- [ ] Processing recommendations

### Phase 3: Multi-Console (v0.3)
- [ ] Midas/X32 .scn adapter
- [ ] Allen & Heath CSV adapter
- [ ] Console comparison view

### Phase 4: Advanced (v1.0)
- [ ] User accounts
- [ ] Cloud sync
- [ ] Template library
- [ ] Mobile app

---

## 11. Appendix

### A. Yamaha CSV Format Reference

```csv
[Information]
QL1
V4.1
[InName]
IN,NAME,COLOR,ICON,
_01,"Kick","Red","Kick",
_02,"Snare","Red","Snare",
_03,"HH","Red","Hi-Hat",

[InPatch]
IN PATCH,SOURCE,COMMENT
CH 1,DANTE 1,"# Tio In 1",
CH 2,DANTE 2,"# Tio In 2",

[PortRackPatch]
PORT RACK PATCH,SOURCE,COMMENT
DANTE 1,MIX 1,"# Mon 1",
DANTE 2,MIX 2,"# Mon 2",
```

### B. X32/M32 .scn Format Reference

```
#2.1# "Scene Name" 0 0 0 0 0 0 0 0 0 0 0

/ch/01/config/name "Kick"
/ch/01/config/icon 1
/ch/01/config/color RED
/ch/01/preamp/trim 0.0
/ch/01/preamp/invert OFF
/ch/01/gate/on OFF
/ch/01/gate/mode GATE
/ch/01/gate/thr -80.0
/ch/01/dyn/on OFF
/ch/01/dyn/mode COMP
/ch/01/dyn/thr 0.0
/ch/01/dyn/ratio 4.0
/ch/01/eq/on ON
/ch/01/eq/1/type LCut
/ch/01/eq/1/f 100.0
/ch/01/eq/1/g 0.0
/ch/01/eq/1/q 1.0
/ch/01/mix/on ON
/ch/01/mix/fader -oo
```

### C. Color Mappings

| Färg | Yamaha | X32/M32 | A&H |
|------|--------|---------|-----|
| Off | 0 | OFF | 0 |
| Red | 1 | RD | 1 |
| Green | 2 | GN | 2 |
| Yellow | 3 | YE | 3 |
| Blue | 4 | BL | 4 |
| Magenta | 5 | MG | 5 |
| Cyan | 6 | CY | 6 |
| White | 7 | WH | 7 |

---

*Document version: 1.0*
*Last updated: December 2024*

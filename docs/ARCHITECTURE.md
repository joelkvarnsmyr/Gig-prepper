# Gig-Prepper Arkitektur

> AI-driven ljudtekniker-assistent för att förbereda mixerkonsoler

**Senast uppdaterad:** 2024-12-14
**Version:** 2.0
**Status:** 133 tester passerar

---

## Innehåll

1. [Systemöversikt](#systemöversikt)
2. [Huvudflöde](#huvudflöde)
3. [AI Agent-arkitektur](#ai-agent-arkitektur)
4. [Verktygsflöden](#verktygsflöden)
5. [Adapter-system](#adapter-system)
6. [Streaming Chat](#streaming-chat)
7. [Datamodeller](#datamodeller)
8. [Saknade funktioner](#saknade-funktioner)

---

## Systemöversikt

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js)"]
        UI[Chat UI]
        Hook[useStreamingChat]
        Download[File Download]
    end

    subgraph API["API Routes"]
        ChatAPI["/api/chat"]
        StreamAPI["/api/chat/stream"]
        UploadAPI["/api/upload"]
        GenerateAPI["/api/generate"]
    end

    subgraph AI["AI Layer"]
        Agent[AI Agent]
        Tools[Tool Registry]
        Memory[Session Manager]
        Prompts[System Prompts]
    end

    subgraph Adapters["Console Adapters"]
        Yamaha[Yamaha CL/QL/TF]
        X32[Behringer X32/Midas M32]
        Future[Allen & Heath dLive]
    end

    subgraph Providers["LLM Providers"]
        Gemini[Google Gemini]
        Claude[Anthropic Claude]
        Grok[xAI Grok]
    end

    UI --> Hook
    Hook --> StreamAPI
    UI --> ChatAPI
    UI --> UploadAPI
    Download --> GenerateAPI

    ChatAPI --> Agent
    StreamAPI --> Agent
    UploadAPI --> Memory
    GenerateAPI --> Adapters

    Agent --> Tools
    Agent --> Memory
    Agent --> Prompts
    Agent --> Providers

    Tools --> Memory

    Yamaha --> |CSV + Docs| GenerateAPI
    X32 --> |.scn Scene| GenerateAPI
    Future -.-> |Ej implementerad| GenerateAPI

    style Future stroke-dasharray: 5 5
```

### Komponentöversikt

| Komponent | Plats | Ansvar |
|-----------|-------|--------|
| **SessionManager** | `memory/index.ts` | Session-livscykel, meddelandehistorik, preferenser |
| **runAgent** | `agents/index.ts` | LLM-anrop, verktygsexekvering |
| **Tool Registry** | `tools/index.ts` | Verktygsregistrering och uppslagning |
| **parse_rider** | `tools/parse-rider.ts` | Extrahera kanaler från PDF/bild |
| **build_mix** | `tools/build-mix.ts` | Skapa UniversalMix med genre presets |
| **suggest_settings** | `tools/suggest-settings.ts` | EQ/dynamik/effekt-rekommendationer |
| **generate_files** | `tools/generate-files.ts` | Adapter-anrop för filgenerering |
| **YamahaAdapter** | `adapters/yamaha/index.ts` | Yamaha CSV-export + markdown docs |
| **X32Adapter** | `adapters/x32/index.ts` | X32/M32 .scn scene-export |

---

## Huvudflöde

### Komplett användarresa

```mermaid
sequenceDiagram
    autonumber
    participant U as Användare
    participant F as Frontend
    participant S as /api/chat/stream
    participant M as SessionManager
    participant A as AI Agent
    participant T as Tools
    participant G as /api/generate
    participant Ad as Adapter

    Note over U,Ad: 1. LADDA UPP RIDER
    U->>F: Väljer PDF/bild
    F->>S: POST med attachment
    S->>M: Skapa session (UUID)
    S->>M: Spara fil i session

    Note over U,Ad: 2. ANALYSERA RIDER
    U->>F: "Analysera ridern"
    F->>S: SSE Stream startar
    S->>A: runAgent()
    A->>A: Välj verktyg: parse_rider
    A->>T: parse_rider.invoke()
    T->>T: PDF → Text → Regex
    T-->>A: {channels[], confidence}
    A-->>S: Stream: tool status
    A->>A: Generera sammanfattning
    A-->>S: Stream: text chunks
    S->>M: Spara meddelande
    S-->>F: done event

    Note over U,Ad: 3. BYGG MIX
    U->>F: "Bygg mix för QL1, rock"
    F->>S: SSE Stream
    S->>A: runAgent()
    A->>T: build_mix.invoke()
    T->>T: Skapa UniversalMix
    T->>T: Applicera genre preset
    T-->>A: {mix: UniversalMix}
    A->>M: setCurrentMix()
    A-->>S: Stream: bekräftelse
    S-->>F: done + hasCurrentMix=true

    Note over U,Ad: 4. GENERERA FILER
    U->>F: Klicka "Ladda ner"
    F->>G: POST {format: yamaha-csv}
    G->>M: Hämta currentMix
    G->>Ad: adapter.generate(mix)
    Ad->>Ad: Generera CSV + Docs
    Ad-->>G: {files[], warnings[]}
    G->>G: Skapa ZIP
    G-->>F: Base64 ZIP
    F-->>U: Laddar ner fil
```

---

## AI Agent-arkitektur

### Verktygsval och exekvering

```mermaid
flowchart TD
    subgraph Input["Användarinput"]
        MSG[Meddelande]
        ATT[Bilagor]
        CTX[Session Context]
    end

    subgraph Agent["AI Agent"]
        PROMPT[System Prompt<br/>SV/EN]
        HIST[Chat History<br/>Max 20 msg]
        LLM[LLM Provider]
        DECISION{Verktyg<br/>behövs?}
    end

    subgraph Tools["Tillgängliga Verktyg"]
        PR[parse_rider<br/>Analysera rider]
        BM[build_mix<br/>Bygg mix]
        SS[suggest_settings<br/>EQ/Dynamik tips]
        GF[generate_files<br/>Skapa filer]
    end

    subgraph Output["Output"]
        STREAM[SSE Stream]
        STORE[Spara i Session]
    end

    MSG --> PROMPT
    ATT --> PROMPT
    CTX --> PROMPT
    HIST --> PROMPT

    PROMPT --> LLM
    LLM --> DECISION

    DECISION -->|Ja| PR
    DECISION -->|Ja| BM
    DECISION -->|Ja| SS
    DECISION -->|Ja| GF
    DECISION -->|Nej| STREAM

    PR --> LLM
    BM --> LLM
    SS --> LLM
    GF --> LLM

    LLM --> STREAM
    STREAM --> STORE
```

### Provider Fallback-kedja

```mermaid
flowchart LR
    START[Start] --> CHECK1{GOOGLE_API_KEY?}
    CHECK1 -->|Ja| GEMINI[Gemini Flash<br/>1M tokens, $0.35/M]
    CHECK1 -->|Nej| CHECK2{ANTHROPIC_API_KEY?}
    CHECK2 -->|Ja| CLAUDE[Claude<br/>200K tokens, $3/M]
    CHECK2 -->|Nej| CHECK3{XAI_API_KEY?}
    CHECK3 -->|Ja| GROK[Grok<br/>128K tokens, $5/M]
    CHECK3 -->|Nej| ERROR[Fel: Ingen provider]

    GEMINI --> DONE[Klar]
    CLAUDE --> DONE
    GROK --> DONE
```

---

## Verktygsflöden

### parse_rider - Rideranalys

```mermaid
flowchart TD
    START[Input: Base64 fil] --> TYPE{Filtyp?}

    TYPE -->|PDF| PDF[pdf-parse]
    TYPE -->|Bild| VISION[Kräver Vision AI]

    PDF --> TEXT[Extrahera text]
    TEXT --> PATTERNS[9 Regex-mönster]

    subgraph Patterns["Mönstermatchning (prioritetsordning)"]
        P1["1. Num. Namn - Mic<br/>'1. Kick - SM91'"]
        P2["2. CH Num: Namn<br/>'CH1: Vocals'"]
        P3["3. Input/Kanal prefix<br/>'Input 1: Kick'"]
        P4["4. Kolumnformat<br/>'01  Kick  SM91'"]
        P5["5. Tabellformat"]
        P6["6. Enkelt numrerat<br/>'1 Kick'"]
        P7["7. Svenska/Parentes<br/>'1. Bastrumma (Beta52)'"]
        P8["8. Kompakt delimiter<br/>'1-Kick-SM91'"]
        P9["9. Mic-först<br/>'SM58: Lead Vox'"]
    end

    PATTERNS --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9

    P9 --> DETECT[Detektera egenskaper]

    subgraph Detection["Egenskapsdetektering"]
        PHANTOM[Fantommatning?<br/>60+ mikrofoner i databas]
        DI[DI-box?<br/>Keys, Bas, Akustisk]
        STAND[Stativtyp?<br/>Boom, Short, Tall]
        GENRE[Genre?<br/>30+ genres]
    end

    DETECT --> PHANTOM
    DETECT --> DI
    DETECT --> STAND
    DETECT --> GENRE

    PHANTOM --> OUTPUT
    DI --> OUTPUT
    STAND --> OUTPUT
    GENRE --> OUTPUT

    VISION --> OUTPUT[Output JSON]

    OUTPUT --> CONF{Kanaler > 5?}
    CONF -->|Ja| HIGH[confidence: high]
    CONF -->|Nej| MED[confidence: medium]
```

### build_mix - Skapa mix

```mermaid
flowchart TD
    INPUT[Input: channels, console, genre] --> CREATE[Skapa tom UniversalMix]

    CREATE --> CONSOLE[Sätt konsolkonfiguration]
    CONSOLE --> CHANNELS[Bygg kanaler]

    subgraph ChannelBuild["Per kanal"]
        CAT[categorizeInstrument<br/>Kick, Snare, Vocals...]
        COLOR[Tilldela färg<br/>Red, Blue, Magenta...]
        ICON[Tilldela ikon<br/>Kick, Female, A.Guitar...]
        HPF[Sätt HPF frekvens<br/>30-150 Hz]
        DCA[Tilldela DCA-grupp<br/>1-8]
    end

    CHANNELS --> CAT --> COLOR --> ICON --> HPF --> DCA

    DCA --> PRESET[Hämta genre preset]

    subgraph GenrePreset["Genre Preset (30+ genres)"]
        REVERB[Default Reverb<br/>Algorithm, Time, PreDelay]
        DELAY[Default Delay<br/>Type, Time, Feedback]
        VOCAL[Vocal Processing<br/>HPF, Compression, DeEss]
        DRUMS[Drum Processing<br/>Gate Kick/Snare, Threshold]
    end

    PRESET --> REVERB
    PRESET --> DELAY
    PRESET --> VOCAL
    PRESET --> DRUMS

    DRUMS --> BUSES[Skapa bussar<br/>6 monitor + stereo]
    BUSES --> DCAS[Skapa DCAs<br/>Drums, Bass, Gtr, Keys, Vox, FX, Band, All]
    DCAS --> EFFECTS[Skapa effekter<br/>Main Reverb, Vocal Delay]
    EFFECTS --> OUTPUT[UniversalMix klar]
```

### Instrumentkategorisering

```mermaid
flowchart LR
    subgraph Input
        NAME[Kanalnamn]
    end

    subgraph Categories["Kategorier & Färger"]
        DRUMS[Trummor<br/>🔴 Red]
        BASS[Bas<br/>🔵 Blue]
        GUITAR[Gitarr<br/>🟡 Yellow]
        KEYS[Keys<br/>🔵 Cyan]
        VOCALS[Sång<br/>🟣 Magenta]
        STRINGS[Stråk<br/>🟢 Green]
        BRASS[Blås<br/>🔵 Blue]
        OTHER[Övrigt<br/>⚪ White]
    end

    NAME --> |kick, bd, bass drum| DRUMS
    NAME --> |snare, virvel, sd| DRUMS
    NAME --> |tom, hi-hat, oh| DRUMS
    NAME --> |bass, bas| BASS
    NAME --> |guitar, gitarr| GUITAR
    NAME --> |keys, piano, synth| KEYS
    NAME --> |vocal, vox, sång| VOCALS
    NAME --> |violin, cello, fiol| STRINGS
    NAME --> |trumpet, sax, horn| BRASS
    NAME --> |default| OTHER
```

---

## Adapter-system

### Adapter-hierarki

```mermaid
classDiagram
    class ConsoleAdapter {
        <<interface>>
        +info: AdapterInfo
        +export(mix) ExportResult
        +import(file) ImportResult
        +validate(mix) ValidationResult
    }

    class AdapterCapabilities {
        +canExportScene: boolean
        +canExportChannelNames: boolean
        +canExportEQ: boolean
        +canExportDynamics: boolean
        +canExportEffects: boolean
        +canImportScene: boolean
    }

    class YamahaAdapter {
        +info: "Yamaha CL/QL/TF"
        +export(mix) CSV + Markdown
        -generateCSV(channels)
        -generateDocumentation(mix)
        -mapColor(color) YamahaColor
        -mapIcon(category) YamahaIcon
    }

    class X32Adapter {
        +info: "Behringer X32/Midas M32"
        +export(mix) .scn Scene
        -generateScene(mix)
        -formatChannel(ch) string
        -mapColor(color) number
        -mapIcon(category) number
    }

    class AllenHeathAdapter {
        +info: "Allen & Heath dLive"
        +export(mix) NotImplemented
    }

    ConsoleAdapter <|.. YamahaAdapter
    ConsoleAdapter <|.. X32Adapter
    ConsoleAdapter <|.. AllenHeathAdapter
    ConsoleAdapter --> AdapterCapabilities
```

### Yamaha CSV Export

```mermaid
flowchart LR
    subgraph Input
        MIX[UniversalMix]
    end

    subgraph CSVFiles["CSV-filer"]
        IN[InName.csv<br/>Kanalnamn, färg, ikon]
        PATCH[InPatch.csv<br/>Input routing]
        OUT[OutPatch.csv<br/>Output routing]
        RACK[PortRackPatch.csv<br/>Dante/Stagebox]
        MIXN[MixName.csv<br/>Aux-bussar]
        MTX[MtxName.csv<br/>Matrix-bussar]
        DCAN[DCAName.csv<br/>DCA-namn]
    end

    subgraph Docs["Dokumentation"]
        README[README.md<br/>Importinstruktioner]
        EQ[EQ_Guide.md<br/>Per-kanal EQ]
        DYN[Dynamics_Guide.md<br/>Gate/Kompressor]
        FX[Effects_Rack.md<br/>Reverb/Delay]
        GAIN[GainSheet.md<br/>Föreslagna gains]
    end

    subgraph Output
        ZIP[ZIP-arkiv]
    end

    MIX --> IN & PATCH & OUT & RACK & MIXN & MTX & DCAN
    MIX --> README & EQ & DYN & FX & GAIN

    IN & PATCH & OUT & RACK & MIXN & MTX & DCAN --> ZIP
    README & EQ & DYN & FX & GAIN --> ZIP
```

### X32 Scene Export

```mermaid
flowchart TD
    MIX[UniversalMix] --> SCENE[Generera .scn]

    subgraph SceneStructure["Scene-filstruktur"]
        HEADER["#2.1# X32 Scene"]
        CONFIG["/config/*"]
        CHANNELS["/ch/01-32/*"]
        AUXIN["/auxin/01-08/*"]
        BUS["/bus/01-16/*"]
        MATRIX["/matrix/01-06/*"]
        DCA["/dca/01-08/*"]
        FX["/fx/01-08/*"]
        MAIN["/main/*"]
    end

    SCENE --> HEADER --> CONFIG --> CHANNELS --> AUXIN --> BUS --> MATRIX --> DCA --> FX --> MAIN

    subgraph ChannelData["Per kanal inkluderar"]
        NAME[Namn + Färg + Ikon]
        SOURCE[Input Source]
        EQFULL[Komplett EQ<br/>HPF + 4-band PEQ]
        GATEFULL[Gate Settings<br/>Threshold, Attack, Release]
        COMPFULL[Compressor<br/>Ratio, Threshold, Knee]
        ROUTING[Fader + Pan + Sends]
    end

    CHANNELS --> NAME & SOURCE & EQFULL & GATEFULL & COMPFULL & ROUTING
```

### Adapter-kapabiliteter

| Funktion | Yamaha CSV | X32 Scene |
|----------|:----------:|:---------:|
| Kanalnamn | ✅ | ✅ |
| Färger | ✅ | ✅ |
| Ikoner | ✅ | ✅ |
| Input Patching | ✅ | ✅ |
| EQ | ❌ (docs) | ✅ |
| Dynamics | ❌ (docs) | ✅ |
| Effects | ❌ (docs) | ✅ |
| DCA Assignments | ✅ | ✅ |
| Fader Levels | ❌ | ✅ |

---

## Streaming Chat

### SSE Event-flöde

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant A as Agent
    participant T as Tool

    C->>S: POST /api/chat/stream
    Note over S: Skapa ReadableStream

    S-->>C: event: session<br/>data: {provider, status: "starting"}

    S->>A: Initiera agent
    S-->>C: event: status<br/>data: {status: "thinking"}

    A->>A: LLM beslutar om verktyg

    alt Verktyg behövs
        S-->>C: event: tools<br/>data: {status: "executing", tools: ["parse_rider"]}

        A->>T: tool.invoke()
        S-->>C: event: tool<br/>data: {name: "parse_rider", status: "running"}

        T-->>A: Resultat
        S-->>C: event: tool<br/>data: {name: "parse_rider", status: "complete"}

        S-->>C: event: status<br/>data: {status: "summarizing"}
    end

    loop Stream text
        A-->>S: Text chunk
        S-->>C: data: {type: "text", content: "..."}
    end

    S-->>C: event: done<br/>data: {sessionId, toolsUsed, hasCurrentMix}

    Note over S: Stäng stream
```

### Client State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Loading: sendMessage()

    Loading --> Streaming: Första text chunk
    Loading --> ToolRunning: Tool event
    Loading --> Error: Fel

    ToolRunning --> Streaming: Tool klar
    ToolRunning --> Error: Tool fel

    Streaming --> Streaming: Ny text chunk
    Streaming --> Complete: done event
    Streaming --> Idle: stopStreaming()

    Complete --> Idle: Automatisk reset
    Error --> Idle: clearError()

    state Loading {
        [*] --> Connecting
        Connecting --> Connected: session event
    }

    state ToolRunning {
        [*] --> Executing
        Executing --> [*]: complete/error
    }
```

---

## Datamodeller

### UniversalMix struktur

```mermaid
classDiagram
    class UniversalMix {
        +version: "2.0"
        +id: string
        +createdAt: string
        +gig: GigInfo
        +console: ConsoleConfig
        +currentScene: Scene
        +aiNotes: AINotes
    }

    class GigInfo {
        +id: string
        +name: string
        +date: string
        +artist: Artist
        +venue: Venue
    }

    class ConsoleConfig {
        +manufacturer: string
        +model: string
        +inputChannelCount: number
        +mixBusCount: number
        +dcaCount: number
        +stageboxes: Stagebox[]
    }

    class Scene {
        +id: string
        +name: string
        +channels: Channel[]
        +buses: Bus[]
        +dcas: DCA[]
        +effects: EffectProcessor[]
    }

    class Channel {
        +id: string
        +number: number
        +name: string
        +shortName: string
        +color: ChannelColor
        +input: InputConfig
        +eq: EQSettings
        +dynamics: DynamicsSettings
        +fader: number
        +dcaAssignments: string[]
    }

    UniversalMix --> GigInfo
    UniversalMix --> ConsoleConfig
    UniversalMix --> Scene
    Scene --> Channel
```

### Session State

```mermaid
classDiagram
    class SessionManager {
        -sessions: Map
        -maxSessionAge: 24h
        +create(provider, language) Session
        +get(id) Session
        +addMessage(id, role, content)
        +setCurrentMix(id, mix)
        +updatePreferences(id, prefs)
    }

    class GigPrepperSession {
        +id: string
        +createdAt: Date
        +provider: ProviderType
        +currentMix: UniversalMix
        +uploadedFiles: UploadedFile[]
        +messages: ChatMessage[]
        +preferences: UserPreferences
    }

    class UserPreferences {
        +language: sv/en
        +console: ConsoleInfo
        +stagebox: StageboxInfo
        +defaultGenre: string
    }

    SessionManager --> GigPrepperSession
    GigPrepperSession --> UserPreferences
```

---

## Saknade funktioner

### Nuvarande status

```mermaid
pie title Funktionsstatus
    "Implementerat" : 75
    "Delvis klart" : 10
    "Ej påbörjat" : 15
```

### Prioriterad roadmap

```mermaid
gantt
    title Gig-Prepper Utvecklingsplan
    dateFormat YYYY-MM-DD

    section Klart ✅
    Vitest setup           :done, v1, 2024-01-01, 1d
    Unit tests (133 st)    :done, v2, after v1, 2d
    X32 Adapter            :done, v3, after v2, 3d
    Integration tests      :done, v4, after v3, 2d
    Rider parsing (9 patterns) :done, v5, after v4, 2d
    Streaming SSE          :done, v6, after v5, 2d
    Genre presets (30 st)  :done, v7, after v6, 1d

    section Prioritet 1 🔴
    Database persistence   :crit, p1a, 2024-02-01, 5d
    User authentication    :crit, p1b, after p1a, 4d

    section Prioritet 2 🟡
    Allen Heath adapter    :p2a, after p1b, 5d
    DiGiCo adapter         :p2b, after p2a, 5d
    Scene import           :p2c, after p2b, 4d

    section Prioritet 3 🟢
    Offline support        :p3a, after p2c, 3d
    ML rider parsing       :p3b, after p3a, 5d
    Multi-language UI      :p3c, after p3b, 3d
```

### Detaljerad lista

| Prio | Funktion | Beskrivning | Komplexitet |
|:----:|----------|-------------|:-----------:|
| **P1** | Database Persistence | PostgreSQL/SQLite för sessions | Medium |
| **P1** | User Authentication | NextAuth med OAuth | Medium |
| **P2** | Allen & Heath dLive | .showfile adapter | Hög |
| **P2** | DiGiCo SD-series | Session file adapter | Hög |
| **P2** | Scene Import | Läs in existerande konsolfiler | Hög |
| **P3** | Offline Support | Service worker + cached presets | Medium |
| **P3** | ML Rider Parsing | Tränad modell för komplexa riders | Hög |
| **P3** | OCR för handskrivna riders | Scannade dokument | Hög |

### Tekniska skulder

```mermaid
mindmap
  root((Teknisk Skuld))
    Persistence
      Sessions i RAM
      Inga backups
      Max 24h livstid
    Felhantering
      SSE reconnect saknas
      Timeout handling begränsad
      Retry logic minimal
    Validering
      Kanalantal vs konsol
      Stagebox input-gränser
      DCA-tilldelningar
    Testing
      E2E-tester saknas
      Mock providers behövs
      CI/CD pipeline saknas
    Säkerhet
      Ingen auth
      Rate limiting saknas
      Input sanitering
```

---

## Sammanfattning

### Styrkor

- ✅ **Komplett Yamaha CSV-export** med dokumentation
- ✅ **Full X32/M32 scene-export** med alla inställningar (EQ, dynamik, effekter)
- ✅ **Real-time streaming** med verktygsstatus
- ✅ **30+ genre presets** med svenska termer (dansband, schlager, etc.)
- ✅ **133 passerade tester**
- ✅ **9 rider-parsing mönster** med 60+ mikrofoner i databasen

### Svagheter

- ❌ Ingen persistent lagring (sessions försvinner vid omstart)
- ❌ Ingen användarautentisering
- ❌ Begränsat antal konsoladaptrar (2 av 4+)
- ❌ Ingen import-funktionalitet
- ❌ Ingen offline-support

### Filstruktur

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── chat/page.tsx         # Chat interface med streaming
│   └── api/
│       ├── chat/
│       │   ├── route.ts      # Standard chat endpoint
│       │   └── stream/route.ts # SSE streaming endpoint
│       ├── generate/route.ts # File generation
│       └── upload/route.ts   # File upload
├── hooks/
│   └── useStreamingChat.ts   # Streaming state hook
├── components/
│   └── chat/
│       ├── ChatMessage.tsx   # Message component
│       └── ChatInput.tsx     # Input with attachments
└── lib/
    ├── ai/
    │   ├── agents/index.ts   # Agent orchestration
    │   ├── tools/            # 4 AI tools
    │   ├── memory/index.ts   # Session management
    │   ├── prompts/system.ts # System prompts
    │   ├── providers/        # LLM abstraction
    │   └── config.ts         # Provider config
    ├── adapters/
    │   ├── yamaha/index.ts   # Yamaha CL/QL/TF
    │   └── x32/index.ts      # X32/M32
    └── models/
        └── universal-mix.ts  # Core data model + 30 genre presets
```

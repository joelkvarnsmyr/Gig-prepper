# Gig-Prepper Roadmap

> AI Sound Engineer - Projektplan och milstolpar

---

## Fas 1: Grundfunktioner ✅ KLAR

### 1.1 Data Model
- [x] Universal Mix Data Model v2.0
- [x] Stöd för EQ, Dynamics, Effects
- [x] Genre presets (22 genres)
- [x] Stagebox-konfiguration

### 1.2 Yamaha Adapter
- [x] CSV-generering (InName, InPatch, OutPatch, etc.)
- [x] MD-dokumentation för manuella inställningar
- [x] Stöd för CL/QL/TF-serien

### 1.3 AI System
- [x] Multi-provider (Gemini, Grok, Claude)
- [x] Tool system med 4 verktyg
- [x] Vision-stöd för bild-riders
- [x] Session management

### 1.4 Användargränssnitt
- [x] Landing page
- [x] Chat UI med fil-uppladdning
- [x] API endpoints (chat, upload, generate)

---

## Fas 2: Kvalitet & Stabilitet 🔄 PÅGÅENDE

### 2.1 Testning
- [ ] Vitest setup och konfiguration
- [ ] Unit tests för AI-verktyg
  - [ ] parse-rider.test.ts
  - [ ] build-mix.test.ts
  - [ ] generate-files.test.ts
  - [ ] suggest-settings.test.ts
- [ ] Integration tests för chat-flöde
- [ ] E2E tests för komplett workflow

### 2.2 Förbättrad Rider-parsing
- [ ] Fler mönster för olika rider-format
- [ ] Bättre hantering av svenska tecken
- [ ] Stage plot-detection
- [ ] Tabell-parsing från PDF

### 2.3 X32/M32 Adapter
- [ ] Reverse-engineer .scn filformat
- [ ] Implementera X32Adapter
- [ ] Testa med riktig X32-konsol
- [ ] Dokumentation för import

---

## Fas 3: Användarupplevelse 📋 PLANERAD

### 3.1 Streaming Responses
- [ ] Server-Sent Events (SSE) för chat
- [ ] Progressiv visning av AI-svar
- [ ] Tool execution feedback i realtid

### 3.2 Session Persistence
- [ ] SQLite/PostgreSQL integration
- [ ] Spara konversationer
- [ ] Ladda tidigare sessioner
- [ ] Export/import av sessioner

### 3.3 Användarautentisering
- [ ] NextAuth.js integration
- [ ] OAuth (Google, GitHub)
- [ ] Användarprofiler
- [ ] Sparade konsol-preferenser

### 3.4 Utökade Genre Presets
- [ ] Sub-genres (melodic metal, progressive rock, etc.)
- [ ] Venue-specifika presets
- [ ] Användardefinierade presets
- [ ] Import/export av presets

---

## Fas 4: Avancerade Features 🚀 FRAMTID

### 4.1 Fler Konsoler
- [ ] Allen & Heath dLive adapter
- [ ] DiGiCo SD-series adapter
- [ ] Soundcraft Vi adapter

### 4.2 AI-förbättringar
- [ ] Röstinput (Whisper API)
- [ ] Stage plot-analys med vision
- [ ] Automatisk gain-strukturing
- [ ] Mix-förslag baserat på inspelningar

### 4.3 Samarbete
- [ ] Dela setups med länk
- [ ] Real-time collaboration
- [ ] Kommentarer på kanaler
- [ ] Versionshantering av mixes

### 4.4 Integrationer
- [ ] Yamaha CL/QL Editor direct export
- [ ] Dropbox/Google Drive sync
- [ ] PDF rider-import från email
- [ ] Webhook-notifieringar

---

## Teknisk Skuld & Underhåll

### Pågående
- [ ] TypeScript strict mode
- [ ] Error boundary för React
- [ ] Rate limiting på API
- [ ] Logging och monitoring

### Framtida
- [ ] Migrera till monorepo (Turborepo)
- [ ] Docker-containerisering
- [ ] CI/CD pipeline
- [ ] Performance-optimering

---

## Release Plan

| Version | Milestone | Mål |
|---------|-----------|-----|
| v0.1.0 | Alpha | Grundläggande chat + Yamaha CSV |
| v0.2.0 | Beta | Tester + X32-adapter |
| v0.3.0 | RC1 | Auth + persistence |
| v1.0.0 | Release | Stabil produkt |

---

## Aktuellt Fokus

**Sprint: Fas 2.1-2.3**

```
Vecka 1: Testning
├── Vitest setup
├── Unit tests för tools
└── Integration tests

Vecka 2: X32 Adapter
├── Filformat-analys
├── Adapter implementation
└── Testning

Vecka 3: Streaming + Polish
├── SSE implementation
├── UI förbättringar
└── Bug fixes
```

---

*Senast uppdaterad: 2024-12-14*

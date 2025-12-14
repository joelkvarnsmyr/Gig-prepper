import Link from "next/link";

// Icons as simple SVG components
const MicrophoneIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <MicrophoneIcon />
            </div>
            <span className="font-semibold text-lg">Gig-Prepper</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#features" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Features
            </Link>
            <Link href="#consoles" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Konsoler
            </Link>
            <Link href="/app" className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-medium">
              Starta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 animated-gradient" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-zinc-300">AI-driven ljudteknik</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Din <span className="gradient-text">AI Sound Engineer</span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
            Prata med appen som en kollega. Ladda upp din rider, beskriv giget,
            och få en färdig setup-fil redo för din mixerkonsol.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/app"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all text-lg font-semibold flex items-center justify-center gap-2"
            >
              <ChatIcon />
              Börja prata med AI:n
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors text-lg font-medium text-zinc-300"
            >
              Se hur det fungerar
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <ClockIcon />
              <span>Spara 45 min per gig</span>
            </div>
            <div className="flex items-center gap-2">
              <DownloadIcon />
              <span>Export till USB</span>
            </div>
          </div>
        </div>

        {/* Demo Preview */}
        <div className="relative max-w-4xl mx-auto mt-16">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 glow-box">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-sm text-zinc-500">AI Sound Engineer</span>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0" />
                <div className="flex-1 p-4 rounded-xl bg-zinc-800 text-zinc-300">
                  Jag ska mixa John & Anna-Karin på en Yamaha QL1.
                  Det är akustisk folkmusik. Jag har en Tio1608 stagebox.
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="flex-1 max-w-xl p-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-zinc-200">
                  <p className="mb-3">Perfekt! Jag har analyserat upplägget:</p>
                  <ul className="space-y-1 text-sm text-zinc-300">
                    <li>✓ Konfigurerar Dante In 1-16 från Tio1608</li>
                    <li>✓ Sätter +48V på kondensatormickar</li>
                    <li>✓ Väljer Rev-X Hall för akustisk folkmusik</li>
                    <li>✓ Soft knee-kompression för dynamiskt ljud</li>
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">Redo för export</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Allt du behöver för <span className="gradient-text">snabbare gig-prep</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Från rider till färdig konsolsetup på minuter istället för timmar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                <ChatIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Prata naturligt</h3>
              <p className="text-zinc-400 text-sm">
                Beskriv ditt gig som till en kollega. AI:n förstår kontext, genre och tekniska krav.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                <DocumentIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Rider-parsing</h3>
              <p className="text-zinc-400 text-sm">
                Ladda upp en PDF-rider. AI:n extraherar kanallista, patchinfo och speciella krav automatiskt.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4 text-pink-400">
                <BoltIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Genre-intelligens</h3>
              <p className="text-zinc-400 text-sm">
                Akustisk folk? Jazz? Metal? AI:n väljer rätt reverb, kompression och EQ-approach.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4 text-green-400">
                <DownloadIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Console export</h3>
              <p className="text-zinc-400 text-sm">
                Exportera till Yamaha CSV, Midas/X32 .scn, eller Allen & Heath format. Redo för USB.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-4 text-yellow-400">
                <MicrophoneIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Stagebox-stöd</h3>
              <p className="text-zinc-400 text-sm">
                Förstår Dante/AES/MADI. Konfigurerar patch för Rio, Tio, DL-serien automatiskt.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                <ClockIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">45 min sparad tid</h3>
              <p className="text-zinc-400 text-sm">
                Kom till giget med 95% klart bord. Fokusera på line check och ljudkontroll.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-6 border-t border-zinc-800 bg-zinc-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Hur det fungerar
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Tre steg från rider till färdig konsolsetup.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div className="p-6 pt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 h-full">
                <h3 className="text-xl font-semibold mb-3">Beskriv giget</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Ladda upp rider (PDF), välj konsol och stagebox, beskriv artist och genre.
                </p>
                <div className="p-3 rounded-lg bg-zinc-800 text-sm text-zinc-300 font-mono">
                  &quot;Yamaha QL1 + Tio1608, akustisk folkduo, 2 sångmickar, 2 fiolmickar...&quot;
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div className="p-6 pt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 h-full">
                <h3 className="text-xl font-semibold mb-3">AI analyserar</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  AI:n bygger en universell mix-modell med namn, patch, processing-förslag.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span> Kanalnamn & färger
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span> Dante-patching
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span> +48V för kondensatorer
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span> Genre-baserad EQ/Dynamics
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-pink-600 flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div className="p-6 pt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 h-full">
                <h3 className="text-xl font-semibold mb-3">Exportera & ladda</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Ladda ner ZIP med konsolspecifika filer. Stoppa på USB, ladda in i bordet.
                </p>
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm flex items-center gap-2">
                    <DocumentIcon /> InName.csv
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm flex items-center gap-2">
                    <DocumentIcon /> DantePatch.csv
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm flex items-center gap-2">
                    <DocumentIcon /> ProcessingGuide.pdf
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Consoles */}
      <section id="consoles" className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Stöd för ledande <span className="gradient-text">mixerkonsoler</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Universell datamodell som översätts till varje tillverkares format.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Yamaha */}
            <div className="p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 transition-colors">
              <div className="text-2xl font-bold text-indigo-400 mb-2">Yamaha</div>
              <p className="text-sm text-zinc-400 mb-4">CL/QL/TF-serien</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>CSV för Editor-import</div>
                <div>Dante/Rio/Tio-stöd</div>
                <div>Premium Rack-guide</div>
              </div>
              <div className="mt-4 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs inline-block">
                Fullt stöd
              </div>
            </div>

            {/* Midas/Behringer */}
            <div className="p-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 transition-colors">
              <div className="text-2xl font-bold text-yellow-400 mb-2">Midas / Behringer</div>
              <p className="text-sm text-zinc-400 mb-4">M32/X32-serien</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>.scn scene-filer</div>
                <div>OSC-baserat format</div>
                <div>Full EQ/Dynamics</div>
              </div>
              <div className="mt-4 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs inline-block">
                Kommer snart
              </div>
            </div>

            {/* Allen & Heath */}
            <div className="p-6 rounded-2xl border border-green-500/30 bg-green-500/5 hover:border-green-500/50 transition-colors">
              <div className="text-2xl font-bold text-green-400 mb-2">Allen & Heath</div>
              <p className="text-sm text-zinc-400 mb-4">dLive/Avantis/SQ</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>CSV input-listor</div>
                <div>Director-integration</div>
                <div>DX-stagebox stöd</div>
              </div>
              <div className="mt-4 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs inline-block">
                Kommer snart
              </div>
            </div>

            {/* DiGiCo */}
            <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 hover:border-red-500/50 transition-colors">
              <div className="text-2xl font-bold text-red-400 mb-2">DiGiCo</div>
              <p className="text-sm text-zinc-400 mb-4">SD/Quantum-serien</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>Session-filer</div>
                <div>SD-Rack/D-Rack</div>
                <div>MADI-patching</div>
              </div>
              <div className="mt-4 px-3 py-1 rounded-full bg-zinc-500/20 text-zinc-400 text-xs inline-block">
                Planerat
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-20 px-6 border-t border-zinc-800 bg-zinc-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Byggt för <span className="gradient-text">professionella ljudtekniker</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="text-4xl mb-4">🎤</div>
              <h3 className="text-xl font-semibold mb-2">Freelancers</h3>
              <p className="text-zinc-400 text-sm">
                Nytt bord varje gig? Få en konsol-agnostisk prep som fungerar överallt.
              </p>
            </div>
            <div className="text-center p-8">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold mb-2">Rental-firmor</h3>
              <p className="text-zinc-400 text-sm">
                Nollställ och prep:a bord snabbt mellan hyresperioder.
              </p>
            </div>
            <div className="text-center p-8">
              <div className="text-4xl mb-4">⛪</div>
              <h3 className="text-xl font-semibold mb-2">Kyrkor & HoW</h3>
              <p className="text-zinc-400 text-sm">
                AI-guidning hjälper frivilliga tekniker att komma igång snabbt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Redo att spara tid på nästa gig?
          </h2>
          <p className="text-zinc-400 mb-8 text-lg">
            Börja använda AI Sound Engineer idag. Gratis att testa.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all text-lg font-semibold"
          >
            <ChatIcon />
            Starta din första setup
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <MicrophoneIcon />
            </div>
            <span className="font-medium">Gig-Prepper</span>
          </div>
          <p className="text-sm text-zinc-500">
            AI Sound Engineer for live audio professionals
          </p>
        </div>
      </footer>
    </div>
  );
}

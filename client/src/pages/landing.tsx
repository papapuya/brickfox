import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Zap, TrendingUp, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Hero Section - PromptPop Style */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Produktdaten-Management neu gedacht – <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Automatisiert, intelligent, zeitsparend</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Schluss mit manuellen Excel-Marathons und endlosen Copy-Paste-Aufgaben. Unser Produktdaten-Manager automatisiert deine Produkttexte, Mappings und Exporte – in Sekunden statt Stunden.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link href="/pricing">
                <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-lg">
                  Kostenlos starten
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-xl">
                  Mehr erfahren
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - PromptPop Style */}
      <section className="py-16 bg-white" id="features">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Produktdaten-Management in Zahlen</h2>
            <p className="text-lg text-gray-600">Erlebe echte Zeitersparnis und Effizienz bei deiner täglichen Arbeit</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 text-center border border-indigo-100">
              <div className="text-4xl font-bold text-indigo-600 mb-2">10.000+</div>
              <div className="text-sm text-gray-600">Produkte in Minuten verarbeitet</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 text-center border border-indigo-100">
              <div className="text-4xl font-bold text-indigo-600 mb-2">95%</div>
              <div className="text-sm text-gray-600">Weniger manuelle Arbeit</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 text-center border border-indigo-100">
              <div className="text-4xl font-bold text-indigo-600 mb-2">Alle</div>
              <div className="text-sm text-gray-600">MediaMarkt, Brickfox & mehr</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 text-center border border-indigo-100">
              <div className="text-4xl font-bold text-indigo-600 mb-2">2-5 Min</div>
              <div className="text-sm text-gray-600">Statt 4-8 Stunden pro Produkt</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-20 bg-gradient-to-b from-white to-indigo-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Kennst du diese Probleme?</h2>
            <p className="text-lg text-gray-600">Typische Herausforderungen im Produktdaten-Management</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-shadow border border-gray-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Endlose Excel-Arbeit</h3>
              <p className="text-gray-600">
                Stunden über Stunden mit Copy-Paste, Formatieren und manuellen Anpassungen. Deine wertvolle Zeit geht für repetitive Aufgaben drauf.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-shadow border border-gray-100">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Chaos bei Plattform-Mappings</h3>
              <p className="text-gray-600">
                Jede Plattform will andere Felder. MediaMarkt, Brickfox, Channel-Engine – alle haben ihre eigenen Anforderungen. Ein Alptraum ohne System.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-shadow border border-gray-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Inkonsistente Produkttexte</h3>
              <p className="text-gray-600">
                Mal gut, mal schlecht. Keine einheitliche Qualität. SEO-Optimierung? Fehlanzeige. Deine Produkte verschwinden in der Masse.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Individualization */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-8">
            <div className="inline-block bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full text-sm font-semibold">
              Individualisierung
            </div>
            <h2 className="text-4xl font-bold text-gray-900">
              Maßgeschneiderte Texte dank individuell trainierter Software
            </h2>
            <ul className="space-y-4 text-left max-w-2xl mx-auto">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-lg text-gray-700">Individuelle und CI-konforme Produktbeschreibungen</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-lg text-gray-700">Tonalität und Vokabular perfekt auf Ihre Zielgruppe abgestimmt</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-lg text-gray-700">Branchenunabhängige Anpassung</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-lg text-gray-700">Interner, persönlicher Kontakt für Support & Onboarding</p>
                </div>
              </li>
            </ul>
            <Link href="/pricing">
              <Button size="lg" className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                Mehr über Anpassungen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature 3: ROI / Results */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block bg-green-100 text-green-600 px-4 py-2 rounded-full text-sm font-semibold">
                Erfolg & ROI
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Mehr Sichtbarkeit & Conversions aus unserer 30-jährigen Erfahrung
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Sales-Steigerung von bis zu 28% durch Conversion Uplift</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Bis zu 10× höhere SEO-Sichtbarkeit</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Zeitersparnis von 500+ Stunden bei 2.000 Produkten</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Kostenersparnis von bis zu 97% gegenüber manueller Erstellung</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-8 shadow-xl">
                <div className="space-y-6">
                  <div className="bg-white rounded-lg p-6 shadow-md text-center">
                    <div className="text-5xl font-bold text-green-600 mb-2">+28%</div>
                    <div className="text-gray-600">mehr Conversions durch<br/>hervorragende Texte</div>
                  </div>
                  <div className="bg-white rounded-lg p-6 shadow-md text-center">
                    <div className="text-5xl font-bold text-indigo-600 mb-2">~1€</div>
                    <div className="text-gray-600">pro perfektem<br/>Text</div>
                  </div>
                  <div className="bg-white rounded-lg p-6 shadow-md text-center">
                    <div className="text-5xl font-bold text-violet-600 mb-2">+80%</div>
                    <div className="text-gray-600">mehr Traffic durch SEO-<br/>optimierte Inhalte</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-600 to-violet-700">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Sprechen wir über Ihren individuellen Anwendungsfall
          </h2>
          <p className="text-xl text-white">
            Vereinbaren Sie jetzt einen unverbindlichen 30-Minuten-Termin
          </p>
          <Link href="/pricing">
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-indigo-600 hover:bg-gray-100 rounded-lg shadow-xl">
              Jetzt 30-Minuten-Termin vereinbaren
            </Button>
          </Link>
        </div>
      </section>

      {/* Media Mentions */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm uppercase tracking-wide text-gray-500 font-semibold mb-8">
            Bekannt aus führenden Medien
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center opacity-50">
            <div className="flex items-center justify-center text-gray-400 font-bold">OMR</div>
            <div className="flex items-center justify-center text-gray-400 font-bold">T3N</div>
            <div className="flex items-center justify-center text-gray-400 font-bold">Horizont</div>
            <div className="flex items-center justify-center text-gray-400 font-bold">Hubspot</div>
            <div className="flex items-center justify-center text-gray-400 font-bold">Online Marketing</div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Zap, TrendingUp, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - ConversionMaker Style */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
              Ihr AI-Tool für <span className="text-blue-600">automatische</span><br/>
              PIM-Daten Generierung
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Mit PIMPilot generieren Sie in Sekunden hochwertige Produktbeschreibungen und PIM-Daten in über 40 Sprachen, die Ihre Zielgruppe überzeugen. Steigern Sie Ihre Conversion um bis zu 28% mit besseren Texten!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link href="/pricing">
                <Button size="lg" className="text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg">
                  Jetzt Demo anfragen
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 border-gray-300 hover:border-blue-600 rounded-lg">
                  Anmelden
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Logos Section */}
      <section className="py-12 bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm uppercase tracking-wide text-gray-500 font-semibold mb-8">
            Führende Unternehmen vertrauen bereits auf uns
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-400">MediaMarkt</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-400">Saturn</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-400">E-Commerce</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-400">Retail Pro</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Automation */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-semibold">
                Automatisierung
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Automatisieren Sie die Content-Erstellung Ihrer Shop-Seiten
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Erstellen Sie tausende Inhalte vollautomatisch in kürzester Zeit</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Nahtlose Integration in bestehende Systeme (PIM, Brickfox, Channel-Engine)</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Automatische Generierung in über 40 Sprachen - in Muttersprachler-Qualität!</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-lg text-gray-700">Kostenreduktion auf unter 1€ pro Text</p>
                  </div>
                </li>
              </ul>
              <Link href="/pricing">
                <Button size="lg" className="mt-4 bg-blue-600 hover:bg-blue-700">
                  Mehr über Automatisierung
                </Button>
              </Link>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl p-8 shadow-xl">
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-8 h-8 text-blue-600" />
                      <div>
                        <div className="text-sm text-gray-500">AI-Generation</div>
                        <div className="text-2xl font-bold text-gray-900">2.000+ Produkte/h</div>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-500 mb-2">Automatische Verarbeitung</div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="bg-blue-600 h-3 rounded-full" style={{ width: '97%' }}></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">97% schneller als manuell</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Individualization */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 md:order-1">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-8 shadow-xl">
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-purple-600">Produkt-Beschreibung</div>
                    <div className="text-lg font-bold text-gray-900">Nitecore 18650 Li-Ion Akku</div>
                    <p className="text-gray-700 leading-relaxed">
                      ✅ Hochleistungs-Lithium-Ionen-Akku für maximale Power<br/>
                      ✅ 3400mAh Kapazität für langanhaltende Energie<br/>
                      ✅ Perfekt für LED-Taschenlampen und E-Zigaretten
                    </p>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">Tonalität: Professionell & Überzeugend</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <div className="inline-block bg-purple-100 text-purple-600 px-4 py-2 rounded-full text-sm font-semibold">
                Individualisierung
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Maßgeschneiderte Texte dank individuell trainierter Software
              </h2>
              <ul className="space-y-4">
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
                <Button size="lg" className="mt-4 bg-purple-600 hover:bg-purple-700">
                  Mehr über Anpassungen
                </Button>
              </Link>
            </div>
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
                    <div className="text-5xl font-bold text-blue-600 mb-2">~1€</div>
                    <div className="text-gray-600">pro perfektem<br/>Text</div>
                  </div>
                  <div className="bg-white rounded-lg p-6 shadow-md text-center">
                    <div className="text-5xl font-bold text-purple-600 mb-2">+80%</div>
                    <div className="text-gray-600">mehr Traffic durch SEO-<br/>optimierte Inhalte</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Sprechen wir über Ihren individuellen Anwendungsfall
          </h2>
          <p className="text-xl text-white">
            Vereinbaren Sie jetzt einen unverbindlichen 30-Minuten-Termin
          </p>
          <Link href="/pricing">
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-blue-600 hover:bg-gray-100 rounded-lg shadow-xl">
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

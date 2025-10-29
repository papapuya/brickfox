import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, ImagePlus, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Produktmanagement Tools
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              <span className="text-primary">PIMPilot</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Automatische PIM-Daten Generierung • AI-gestützte Produktbeschreibungen • MediaMarkt-konforme Titel
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/csv-bulk-description">
                <Button size="lg" className="w-full sm:w-auto">
                  <Sparkles className="w-5 h-5 mr-2" />
                  PIMPilot starten
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Verfügbare Tools</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professionelle Tools für die Verwaltung und Anreicherung von Produktdaten
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto md:items-stretch">
            {/* PIMPilot CSV Bulk Tool */}
            <Card className="hover-elevate transition-all flex flex-col" data-testid="card-csv-bulk">
              <CardHeader className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">PIMPilot</CardTitle>
                  <CardDescription className="text-base">
                    Automatische PIM-Daten Generierung aus CSV-Dateien
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Vollautomatische Generierung</h4>
                      <p className="text-sm text-muted-foreground">AI generiert alle PIM-Felder automatisch aus CSV-Daten</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">MediaMarkt-konforme Titel</h4>
                      <p className="text-sm text-muted-foreground">Automatische Generierung von TTL/TTB Produktnamen</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Massenverarbeitung</h4>
                      <p className="text-sm text-muted-foreground">2000+ Produkte in wenigen Minuten verarbeiten</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Link href="/csv-bulk-description">
                    <Button className="w-full" data-testid="button-csv-bulk">
                      <Sparkles className="w-4 h-4 mr-2" />
                      PIMPilot starten
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Produktbeschreibungen Tool */}
            <Card className="hover-elevate transition-all flex flex-col" data-testid="card-product-creator">
              <CardHeader className="space-y-4">
                <div className="w-12 h-12 bg-chart-2/10 rounded-md flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-chart-2" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">Produktbeschreibungen</CardTitle>
                  <CardDescription className="text-base">
                    KI-gestützte Produktbeschreibungen aus Lieferantendaten generieren
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-chart-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Automatische Beschreibungen</h4>
                      <p className="text-sm text-muted-foreground">KI generiert professionelle Produktbeschreibungen</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-chart-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Bildanalyse</h4>
                      <p className="text-sm text-muted-foreground">Produktbilder werden automatisch analysiert</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-chart-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">HTML-Export</h4>
                      <p className="text-sm text-muted-foreground">Fertig formatierte HTML-Beschreibungen</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Link href="/product-creator">
                    <Button className="w-full" data-testid="button-product-creator">
                      <ImagePlus className="w-4 h-4 mr-2" />
                      Produktbeschreibungen erstellen
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>
    </div>
  );
}
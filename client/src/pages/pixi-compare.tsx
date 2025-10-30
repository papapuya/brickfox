import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ComparisonResult {
  artikelnummer: string;
  produktname: string;
  ean: string;
  hersteller: string;
  pixi_status: 'NEU' | 'VORHANDEN';
  pixi_ean: string | null;
}

interface ComparisonResponse {
  success: boolean;
  summary: {
    total: number;
    neu: number;
    vorhanden: number;
  };
  products: ComparisonResult[];
  error?: string;
}

export default function PixiComparePage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [supplNr, setSupplNr] = useState('7077');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Bitte wählen Sie eine CSV-Datei aus');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleCompare = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine CSV-Datei aus');
      return;
    }

    if (!supplNr) {
      setError('Bitte geben Sie eine Lieferantennummer ein');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('supabase_token');
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('supplNr', supplNr);

      const response = await fetch('/api/pixi/compare', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Vergleich fehlgeschlagen');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const csvContent = [
      ['Artikelnummer', 'Produktname', 'EAN', 'Hersteller', 'Pixi Status', 'Pixi EAN'].join(','),
      ...result.products.map(p => 
        [
          p.artikelnummer,
          `"${p.produktname}"`,
          p.ean,
          p.hersteller,
          p.pixi_status,
          p.pixi_ean || ''
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pixi-vergleich-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Pixi ERP Vergleich</h1>
          <p className="text-muted-foreground">
            Vergleichen Sie Ihre Produktdaten mit dem Pixi ERP-System um neue Artikel zu identifizieren
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>CSV-Upload & Vergleich</CardTitle>
            <CardDescription>
              Laden Sie eine CSV-Datei mit Produktdaten hoch und vergleichen Sie diese mit Pixi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplNr">Lieferantennummer</Label>
                <Input
                  id="supplNr"
                  value={supplNr}
                  onChange={(e) => setSupplNr(e.target.value)}
                  placeholder="z.B. 7077"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="csvFile">CSV-Datei</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={loading}
                    className="flex-1"
                  />
                  {file && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={loading}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCompare}
              disabled={!file || !supplNr || loading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? 'Vergleiche mit Pixi...' : 'Jetzt vergleichen'}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Vergleichsergebnis</CardTitle>
                <CardDescription>
                  Zusammenfassung des Pixi-Abgleichs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold">{result.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Gesamt</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {result.summary.neu}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">Neu</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {result.summary.vorhanden}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">Vorhanden</div>
                  </div>
                </div>

                <Button
                  onClick={downloadResults}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Ergebnisse als CSV herunterladen
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Produktliste ({result.products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Artikelnummer</TableHead>
                        <TableHead>Produktname</TableHead>
                        <TableHead>EAN</TableHead>
                        <TableHead>Hersteller</TableHead>
                        <TableHead>Pixi EAN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.products.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge
                              variant={product.pixi_status === 'NEU' ? 'default' : 'secondary'}
                              className={
                                product.pixi_status === 'NEU'
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }
                            >
                              {product.pixi_status === 'NEU' ? (
                                <CheckCircle className="mr-1 h-3 w-3" />
                              ) : (
                                <FileText className="mr-1 h-3 w-3" />
                              )}
                              {product.pixi_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {product.artikelnummer}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {product.produktname}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.ean}</TableCell>
                          <TableCell>{product.hersteller}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {product.pixi_ean || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

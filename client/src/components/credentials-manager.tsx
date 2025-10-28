import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Key, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Credentials {
  openaiApiKey: string;
  firecrawlApiKey: string;
}


export default function CredentialsManager() {
  const [credentials, setCredentials] = useState<Credentials>({
    openaiApiKey: '',
    firecrawlApiKey: '',
  });
  const [showKeys, setShowKeys] = useState({
    openai: false,
    firecrawl: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/api/credentials');
      const data = await response.json();
      
      if (data.success && data.credentials) {
        setCredentials({
          openaiApiKey: data.credentials.openaiApiKey || '',
          firecrawlApiKey: data.credentials.firecrawlApiKey || '',
        });
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      // Don't show error toast on load, just log it
    } finally {
      setIsLoading(false);
    }
  };


  const saveCredentials = async () => {
    console.log('Save button clicked!');
    try {
      setIsSaving(true);
      console.log('Saving credentials:', { 
        openai: credentials.openaiApiKey ? '***' + credentials.openaiApiKey.slice(-4) : 'empty',
        firecrawl: credentials.firecrawlApiKey ? '***' + credentials.firecrawlApiKey.slice(-4) : 'empty'
      });
      
      const response = await apiRequest('POST', '/api/saveKeys', {
        openaiKey: credentials.openaiApiKey,
        firecrawlKey: credentials.firecrawlApiKey,
      });
      console.log('Save response:', response);
      
      const data = await response.json();
      console.log('Parsed response data:', data);
      
      if (data.success) {
        toast({
          title: "Erfolg",
          description: data.message || "API-Schlüssel wurden gespeichert!",
        });
      } else {
        toast({
          title: "Fehler",
          description: data.message || "Fehler beim Speichern",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };



  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            API Credentials
          </CardTitle>
          <CardDescription>
            Verwalten Sie Ihre API-Schlüssel für OpenAI und Firecrawl
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          API Credentials
        </CardTitle>
        <CardDescription>
          Verwalten Sie Ihre API-Schlüssel für OpenAI und Firecrawl
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OpenAI API Key */}
        <div className="space-y-3">
          <Label htmlFor="openai-key" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            OpenAI API Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="openai-key"
              type={showKeys.openai ? "text" : "password"}
              placeholder="sk-..."
              value={credentials.openaiApiKey}
              onChange={(e) => setCredentials(prev => ({ ...prev, openaiApiKey: e.target.value }))}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
            >
              {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Firecrawl API Key */}
        <div className="space-y-3">
          <Label htmlFor="firecrawl-key" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Firecrawl API Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="firecrawl-key"
              type={showKeys.firecrawl ? "text" : "password"}
              placeholder="fc-..."
              value={credentials.firecrawlApiKey}
              onChange={(e) => setCredentials(prev => ({ ...prev, firecrawlApiKey: e.target.value }))}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeys(prev => ({ ...prev, firecrawl: !prev.firecrawl }))}
            >
              {showKeys.firecrawl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex justify-center">
          <Button
            onClick={saveCredentials}
            disabled={isSaving || (!credentials.openaiApiKey && !credentials.firecrawlApiKey)}
            className="w-full max-w-xs"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : null}
            Speichern
          </Button>
        </div>

        {/* Info */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>OpenAI:</strong> Für KI-Textgenerierung und Bildanalyse</p>
          <p><strong>Firecrawl:</strong> Für Website-Scraping und URL-Analyse</p>
          <p className="text-xs">Credentials werden sicher auf dem Server gespeichert</p>
        </div>
      </CardContent>
    </Card>
  );
}

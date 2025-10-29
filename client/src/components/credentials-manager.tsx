import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Key, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Credentials {
  openaiApiKey: string;
}

export default function CredentialsManager() {
  const [credentials, setCredentials] = useState<Credentials>({
    openaiApiKey: '',
  });
  const [showKey, setShowKey] = useState(false);
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
        });
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCredentials = async () => {
    try {
      setIsSaving(true);
      
      const response = await apiRequest('POST', '/api/saveKeys', {
        openaiKey: credentials.openaiApiKey,
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Erfolg",
          description: data.message || "API-Schlüssel wurde gespeichert!",
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
            Verwalten Sie Ihren OpenAI API-Schlüssel
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
          Verwalten Sie Ihren OpenAI API-Schlüssel für die AI-Generierung
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
              type={showKey ? "text" : "password"}
              placeholder="sk-..."
              value={credentials.openaiApiKey}
              onChange={(e) => setCredentials({ openaiApiKey: e.target.value })}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Benötigt für die AI-gestützte Produktbeschreibungs-Generierung
          </p>
        </div>

        <Button 
          onClick={saveCredentials}
          disabled={isSaving || !credentials.openaiApiKey}
          className="w-full"
        >
          {isSaving ? 'Speichern...' : 'API-Schlüssel speichern'}
        </Button>
      </CardContent>
    </Card>
  );
}

import { encryptApiKey, decryptApiKey } from './encryption';

interface SecureApiKeys {
  openai?: string;
  firecrawl?: string;
}

class ApiKeyManager {
  private encryptedKeys: SecureApiKeys = {};
  
  // API-Schlüssel verschlüsselt speichern
  setApiKey(service: keyof SecureApiKeys, apiKey: string): void {
    this.encryptedKeys[service] = encryptApiKey(apiKey);
    console.log(`API-Schlüssel für ${service} verschlüsselt gespeichert`);
  }
  
  // API-Schlüssel entschlüsselt abrufen
  getApiKey(service: keyof SecureApiKeys): string | null {
    const encryptedKey = this.encryptedKeys[service];
    if (!encryptedKey) {
      return null;
    }
    
    try {
      return decryptApiKey(encryptedKey);
    } catch (error) {
      console.error(`Fehler beim Entschlüsseln des ${service} API-Schlüssels:`, error);
      return null;
    }
  }
  
  // API-Schlüssel aus Umgebungsvariablen laden (falls verschlüsselt)
  loadFromEnvironment(): void {
    const encryptedOpenAI = process.env.ENCRYPTED_OPENAI_API_KEY;
    const encryptedFirecrawl = process.env.ENCRYPTED_FIRECRAWL_API_KEY;
    
    if (encryptedOpenAI) {
      try {
        const decrypted = decryptApiKey(encryptedOpenAI);
        this.encryptedKeys.openai = encryptedOpenAI;
        console.log('OpenAI API-Schlüssel aus verschlüsselter Umgebungsvariable geladen');
      } catch (error) {
        console.error('Fehler beim Laden des verschlüsselten OpenAI API-Schlüssels:', error);
      }
    }
    
    if (encryptedFirecrawl) {
      try {
        const decrypted = decryptApiKey(encryptedFirecrawl);
        this.encryptedKeys.firecrawl = encryptedFirecrawl;
        console.log('Firecrawl API-Schlüssel aus verschlüsselter Umgebungsvariable geladen');
      } catch (error) {
        console.error('Fehler beim Laden des verschlüsselten Firecrawl API-Schlüssels:', error);
      }
    }
  }
  
  // Alle API-Schlüssel löschen
  clearAllKeys(): void {
    this.encryptedKeys = {};
    console.log('Alle API-Schlüssel gelöscht');
  }
}

// Singleton-Instanz
export const apiKeyManager = new ApiKeyManager();

// Hilfsfunktionen für die bestehende AI-Service
export function getSecureOpenAIKey(): string | null {
  return apiKeyManager.getApiKey('openai') || process.env.OPENAI_API_KEY || null;
}

export function getSecureFirecrawlKey(): string | null {
  return apiKeyManager.getApiKey('firecrawl') || process.env.FIRECRAWL_API_KEY || null;
}

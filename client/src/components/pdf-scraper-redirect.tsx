import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
import { Loader } from './loader';

export function PDFScraperRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Warte bis Auth-Check abgeschlossen ist
    if (!isLoading && isAuthenticated) {
      // Automatisch zu /url-scraper weiterleiten
      setLocation('/url-scraper');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Zeige Loading während Auth-Check läuft
  return <Loader message="Weiterleitung..." />;
}




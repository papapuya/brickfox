import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
import { UpgradePrompt } from './upgrade-prompt';
import { Loader } from './loader';

interface ProtectedRouteProps {
  children: ReactNode;
  requireSubscription?: boolean;
}

export function ProtectedRoute({ children, requireSubscription = false }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // EINFACH: Prüfe sofort ob Tokens vorhanden sind (bei jedem Render)
  const hasToken = !!(localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token') ||
                      localStorage.getItem('supabase_refresh_token') || sessionStorage.getItem('supabase_refresh_token'));

  // EINFACH: Nur umleiten wenn definitiv keine Tokens vorhanden sind UND nicht mehr lädt
  useEffect(() => {
    if (!isLoading && !hasToken) {
      console.log('[ProtectedRoute] No tokens found after loading, redirecting to login');
      setLocation('/login');
    }
  }, [isLoading, hasToken, setLocation]);

  // Loading anzeigen während Authentifizierung geprüft wird
  if (isLoading) {
    return <Loader message="Lade..." />;
  }

  // Keine Tokens - wird via useEffect umgeleitet
  if (!hasToken) {
    return null;
  }

  // Tokens vorhanden aber noch nicht authentifiziert - zeige Loading (Session wird wiederhergestellt)
  if (!isAuthenticated) {
    return <Loader message="Session wird wiederhergestellt..." />;
  }

  if (requireSubscription) {
    if (!user?.subscriptionStatus || user.subscriptionStatus === 'canceled') {
      return <UpgradePrompt reason="no_subscription" />;
    }

    if (user.subscriptionStatus === 'past_due') {
      return <UpgradePrompt reason="past_due" />;
    }
  }

  return <>{children}</>;
}

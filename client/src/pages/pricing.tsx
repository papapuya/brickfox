import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  apiCallsLimit: number;
  features: string[];
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: plansData } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/stripe/plans'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/plans');
      if (!res.ok) throw new Error('Failed to load plans');
      return res.json();
    },
  });

  const { data: userData } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Checkout fehlgeschlagen');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
      setSelectedPlan(null);
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!userData?.user) {
      setLocation('/register');
      return;
    }

    setSelectedPlan(planId);
    checkoutMutation.mutate(planId);
  };

  const plans = plansData?.plans || [];
  const currentPlanId = userData?.user?.planId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Wählen Sie Ihren Plan
          </h1>
          <p className="text-xl text-gray-600">
            Professionelle PIM-Beschreibungen für jedes Team
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.id === 'pro'
                  ? 'border-2 border-blue-500 shadow-xl'
                  : ''
              } ${
                currentPlanId === plan.id
                  ? 'ring-2 ring-green-500'
                  : ''
              }`}
            >
              {plan.id === 'pro' && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                  Beliebt
                </Badge>
              )}
              
              {currentPlanId === plan.id && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  Aktueller Plan
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      €{plan.price}
                    </span>
                    <span className="text-gray-600">/Monat</span>
                  </div>
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.id === 'pro' ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={selectedPlan === plan.id || currentPlanId === plan.id}
                >
                  {currentPlanId === plan.id
                    ? 'Aktueller Plan'
                    : selectedPlan === plan.id
                    ? 'Wird geladen...'
                    : userData?.user
                    ? 'Plan wählen'
                    : 'Jetzt starten'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p>Alle Pläne beinhalten 7 Tage Geld-zurück-Garantie</p>
          <p className="mt-2">Monatlich kündbar • Keine versteckten Kosten</p>
        </div>
      </div>
    </div>
  );
}

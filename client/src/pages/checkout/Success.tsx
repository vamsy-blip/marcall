import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MarcallWordmark } from '@/components/Brand';

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [planName, setPlanName] = useState<string>('');

  useEffect(() => {
    const hash = window.location.hash; // e.g. #/checkout/success?tenant_id=...&plan=crece&mock_session=1
    const queryStart = hash.indexOf('?');
    const params = new URLSearchParams(queryStart >= 0 ? hash.slice(queryStart + 1) : '');
    const tenantId = params.get('tenant_id');
    const plan = params.get('plan') || '';
    const mock = params.get('mock_session');
    setPlanName(plan);

    if (mock === '1' && tenantId && plan) {
      apiRequest('POST', '/api/checkout/complete', { tenantId, planSlug: plan })
        .then(() => {
          queryClient.invalidateQueries();
          setStatus('done');
        })
        .catch(() => setStatus('error'));
    } else {
      // Live Stripe redirect — backend will eventually flip via webhook. Just confirm success.
      setStatus('done');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center marcall-grain bg-background px-6 py-12">
      <div className="absolute top-6 left-6">
        <Link href="/" data-testid="link-home">
          <MarcallWordmark className="h-7" />
        </Link>
      </div>
      <Card className="max-w-lg w-full border-2">
        <CardContent className="p-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold" data-testid="text-success-title">
              {status === 'loading' ? 'Confirmando tu suscripción…' : '¡Listo! Tu plan está activo'}
            </h1>
            <p className="text-muted-foreground">
              {status === 'loading'
                ? 'Estamos activando tu cuenta de MARCALL.'
                : `Bienvenido al plan ${planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : ''}. Tu prueba de 7 días empieza ahora.`}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => navigate('/onboarding')}
              data-testid="button-start-onboarding"
              disabled={status === 'loading'}
            >
              Configurar mi recepcionista
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/app')} data-testid="button-go-dashboard">
              Ir al panel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

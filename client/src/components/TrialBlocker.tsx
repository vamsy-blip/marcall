import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';

/**
 * Paths that remain accessible even when the tenant's trial expired or status === 'past_due'.
 * - ARCO endpoints live under /api/me/* on the server side; on the client they are surfaced
 *   inside /app/configuracion (DatosTab).
 * - /app/facturacion always passes through so the tenant can pay.
 */
const ALLOWED_PREFIXES = [
  '/app/configuracion',
  '/app/facturacion',
  '/legal',
];

function isAllowedPath(pathname: string) {
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

type TenantLike = {
  status?: string | null;
  trialEndsAt?: string | number | null;
};

type SubscriptionLike = {
  status?: string | null;
  trialEndsAt?: string | number | null;
};

function isBlocked(tenant: TenantLike | undefined, subscription: SubscriptionLike | undefined): boolean {
  if (!tenant && !subscription) return false;
  const status = tenant?.status || subscription?.status;
  if (status === 'past_due' || status === 'unpaid' || status === 'canceled') return true;

  const trialEndsAt = (tenant?.trialEndsAt ?? subscription?.trialEndsAt) as any;
  if (status === 'trial' || status === 'trialing') {
    if (!trialEndsAt) return false;
    const t = new Date(trialEndsAt).getTime();
    if (!isFinite(t)) return false;
    return t < Date.now();
  }
  return false;
}

export function TrialBlocker({
  tenant,
  subscription,
  children,
}: {
  tenant?: TenantLike;
  subscription?: SubscriptionLike;
  children: ReactNode;
}) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const blocked = isBlocked(tenant, subscription);
  const allow = isAllowedPath(location);

  const portal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/portal', { returnUrl: window.location.href });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
      else toast({ title: t('common.error', 'Error'), variant: 'destructive' });
    },
    onError: () => toast({ title: t('common.error', 'Error'), variant: 'destructive' }),
  });

  if (!blocked || allow) {
    return <>{children}</>;
  }

  const status = tenant?.status || subscription?.status;
  const isPastDue = status === 'past_due' || status === 'unpaid' || status === 'canceled';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-5 md:p-8" data-testid="trial-blocker">
      <Card className="border-amber-500/40 bg-amber-500/5 max-w-lg w-full">
        <CardContent className="p-6 md:p-8 text-center space-y-5">
          <div className="mx-auto size-12 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="size-6 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold" data-testid="text-blocker-title">
              {isPastDue
                ? t('tenant.blocker.pastDueTitle', 'Pago pendiente')
                : t('auth.trialExpiredTitle', 'Tu prueba terminó')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isPastDue
                ? t('tenant.blocker.pastDueBody', 'Tu última factura no se pudo cobrar. Actualiza tu método de pago para reactivar el servicio.')
                : t('auth.trialExpiredBody', 'Activa tu plan para seguir recibiendo llamadas.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button
              onClick={() => (window.location.hash = '#/app/facturacion')}
              data-testid="button-blocker-upgrade"
            >
              <CreditCard className="size-4 mr-1.5" />
              {t('auth.trialUpgradeCta', 'Activar plan')}
            </Button>
            <Button
              variant="outline"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
              data-testid="button-blocker-portal"
            >
              <ExternalLink className="size-4 mr-1.5" />
              {t('tenant.facturacion.manageStripe', 'Administrar en Stripe')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground pt-3">
            {t('tenant.blocker.allowedPaths', 'Aún puedes acceder a Facturación, Configuración (incluido borrado y exportación de datos ARCO) y avisos legales.')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export { isBlocked as __isBlocked };

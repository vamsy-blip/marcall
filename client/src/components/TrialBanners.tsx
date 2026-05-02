import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from 'react-i18next';
import { Mail, AlertTriangle, Clock } from 'lucide-react';

/**
 * Two stacked banners shown above the dashboard main content:
 *
 *  1. Email-verify banner — appears when user.emailVerifiedAt is null AND
 *     the account was created more than 1 hour ago.
 *  2. Trial banner — appears when subscription.status === 'trialing' (live
 *     count of days remaining) or 'trial_expired' (paywall blocker).
 */
export function TrialBanners() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = user?.currentTenantId ?? null;

  const { data: tenantData } = useQuery<any>({
    queryKey: ['/api/tenants', tenantId],
    enabled: !!tenantId,
  });
  const subscription = tenantData?.subscription as
    | { status?: string; trialEndsAt?: string | number | null }
    | undefined;

  const resendMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/resend-verification', {});
      return res.json();
    },
    onSuccess: () =>
      toast({
        title: t('auth.verifyResentTitle', { defaultValue: 'Enlace enviado' }),
        description: t('auth.verifyResentBody', { defaultValue: 'Revisa tu bandeja de entrada en los próximos minutos.' }),
      }),
    onError: (e: any) =>
      toast({
        title: t('auth.verifyResentFail', { defaultValue: 'No pudimos reenviar el enlace' }),
        description: e?.message,
        variant: 'destructive',
      }),
  });

  // --- Email verify banner ---
  const createdAt = user?.createdAt ? new Date(user.createdAt as any) : null;
  const accountAgeMs = createdAt ? Date.now() - createdAt.getTime() : 0;
  const showVerifyBanner =
    !!user && !user.emailVerifiedAt && accountAgeMs > 60 * 60 * 1000;

  // --- Trial banner ---
  const status = subscription?.status;
  const trialEndsAt = subscription?.trialEndsAt
    ? new Date(subscription.trialEndsAt as any)
    : null;
  const msRemaining = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  const showTrialBanner = status === 'trialing' || status === 'trial' ;
  const showTrialExpired = status === 'trial_expired' || (showTrialBanner && msRemaining <= 0);

  if (!showVerifyBanner && !showTrialBanner && !showTrialExpired) return null;

  return (
    <div className="space-y-2 px-5 md:px-8 pt-4">
      {showVerifyBanner && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-4 py-2.5 text-sm"
          data-testid="banner-verify-email"
        >
          <Mail className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="flex-1 text-amber-900 dark:text-amber-100">
            {t('auth.verifyBanner', {
              defaultValue: 'Verifica tu correo para activar todas las funciones.',
            })}
          </div>
          <button
            onClick={() => resendMut.mutate()}
            disabled={resendMut.isPending}
            className="text-sm font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline disabled:opacity-50"
            data-testid="button-resend-verify"
          >
            {resendMut.isPending
              ? t('auth.verifyResending', { defaultValue: 'Enviando…' })
              : t('auth.verifyResendCta', { defaultValue: 'Reenviar enlace' })}
          </button>
        </div>
      )}

      {showTrialExpired ? (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm"
          data-testid="banner-trial-expired"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <div className="flex-1 text-destructive-foreground">
            <strong className="text-destructive">
              {t('auth.trialExpiredTitle', { defaultValue: 'Tu prueba terminó' })}
            </strong>{' '}
            <span className="text-foreground/80">
              {t('auth.trialExpiredBody', {
                defaultValue: 'Activa tu plan para seguir recibiendo llamadas.',
              })}
            </span>
          </div>
          <a
            href="/#/app/facturacion"
            className="text-sm font-semibold underline hover:no-underline"
            data-testid="button-trial-upgrade"
          >
            {t('auth.trialUpgradeCta', { defaultValue: 'Activar plan' })}
          </a>
        </div>
      ) : showTrialBanner ? (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm"
          data-testid="banner-trial-active"
        >
          <Clock className="size-4 shrink-0 text-primary" />
          <div className="flex-1 text-foreground/85">
            {t('auth.trialBanner', {
              count: daysRemaining,
              defaultValue:
                daysRemaining === 1
                  ? 'Te queda 1 día de prueba gratis.'
                  : `Te quedan ${daysRemaining} días de prueba gratis.`,
            })}
          </div>
          <a
            href="/#/app/facturacion"
            className="text-sm font-semibold text-primary underline hover:no-underline"
            data-testid="button-trial-cta"
          >
            {t('auth.trialCta', { defaultValue: 'Activar plan' })}
          </a>
        </div>
      ) : null}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, FileText, ExternalLink, Receipt, Sparkles, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function formatMxn(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Facturacion() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const { theme } = useTheme();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const { data: tenant } = useQuery<any>({ queryKey: ['/api/tenants', tid], enabled: !!tid });
  const { data: subscription } = useQuery<any>({ queryKey: ['/api/tenants', tid, 'subscription'], enabled: !!tid });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ['/api/plans'] });
  const { data: usage } = useQuery<any>({ queryKey: ['/api/tenants', tid, 'usage'], enabled: !!tid });
  const { data: invoices = [], isLoading: invLoading } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'invoices'], enabled: !!tid });
  const { data: calls = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'calls'], enabled: !!tid });

  const currentPlan = useMemo(() => plans.find((p: any) => p.id === tenant?.planId), [plans, tenant]);
  const [pendingPlanSlug, setPendingPlanSlug] = useState<string | null>(null);

  // Last 30 days usage chart from real call data
  const usageData = useMemo(() => {
    const days: { date: string; minutes: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: format(d, 'd MMM', { locale: dateLocale }), minutes: 0 });
    }
    calls.forEach((c: any) => {
      const cd = new Date(c.startedAt);
      cd.setHours(0, 0, 0, 0);
      const diff = Math.floor((Date.now() - cd.getTime()) / 86400000);
      const idx = 29 - diff;
      if (idx >= 0 && idx < 30) {
        days[idx].minutes += Math.ceil((c.durationSec || 0) / 60);
      }
    });
    return days;
  }, [calls, dateLocale]);

  const portal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/portal', { returnUrl: window.location.href });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
      else toast({ title: t('common.saveError'), variant: 'destructive' });
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const upgradeCheckout = useMutation({
    mutationFn: async (planSlug: string) => {
      const res = await apiRequest('POST', '/api/checkout/create', { planSlug, email: user?.email, name: user?.name });
      return res.json();
    },
    onSuccess: (data: any) => { if (data?.url) window.location.href = data.url; },
  });

  const retryCfdi = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await apiRequest('POST', `/api/tenants/${tid}/invoices/${invoiceId}/cfdi`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'invoices'] });
      toast({ title: t('tenant.facturacion.requestSent') });
    },
    onError: (err: any) => toast({
      title: t('tenant.facturacion.cfdiEmitError'),
      description: err?.message || '',
      variant: 'destructive',
    }),
  });

  return (
    <TenantLayout title={t('tenant.facturacion.title')}>
      <div className="max-w-5xl space-y-6">
        <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.facturacion.title')}</h1>

        {/* Current plan card */}
        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t('tenant.facturacion.currentPlan')}</div>
                <div className="font-display font-bold text-2xl mt-1" data-testid="text-current-plan">{currentPlan?.name || '—'}</div>
                {currentPlan && (
                  <div className="text-sm text-muted-foreground mt-1 tabular-nums">
                    {formatMxn(currentPlan.priceMxnCents)} <span className="text-xs">{t('tenant.facturacion.perMonth')}</span>
                  </div>
                )}
                {subscription?.currentPeriodEnd && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('tenant.facturacion.renewsOn', { date: format(new Date(subscription.currentPeriodEnd), 'd MMM yyyy', { locale: dateLocale }) })}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => portal.mutate()} disabled={portal.isPending} data-testid="button-portal">
                  <ExternalLink className="size-4 mr-1.5" /> {t('tenant.facturacion.manageStripe')}
                </Button>
              </div>
            </div>

            {/* Usage bar */}
            {usage && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t('tenant.facturacion.minutesThisMonth')}</div>
                  <div className="text-sm tabular-nums">
                    <span className="font-display font-bold">{usage.minutesUsed || 0}</span>
                    <span className="text-muted-foreground"> / {usage.minutesIncluded || 0} {t('common.min')}</span>
                  </div>
                </div>
                {(() => {
                  const used = usage.minutesUsed || 0;
                  const inc = Math.max(1, usage.minutesIncluded || 1);
                  const pct = (used / inc) * 100;
                  const fillCls = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
                  return (
                    <>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${fillCls} rounded-full transition-all`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                          data-testid="progress-usage"
                        />
                      </div>
                      {pct >= 80 && (
                        <div className={`mt-2 text-xs ${pct >= 100 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`} data-testid="text-usage-warning">
                          <AlertTriangle className="size-3 inline mr-1" />
                          {pct >= 100
                            ? t('tenant.facturacion.overageWarning', 'Has superado tu cuota incluida. Los minutos extra se facturarán al cierre del ciclo.')
                            : t('tenant.facturacion.nearLimitWarning', 'Estás cerca del límite de tu plan. Considera cambiar de plan.')}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan switcher */}
        {plans.length > 0 && (
          <Card className="border-card-border">
            <CardContent className="p-6">
              <div className="text-sm font-semibold mb-1">{t('tenant.facturacion.upgrade')}</div>
              <p className="text-xs text-muted-foreground mb-4">{t('tenant.facturacion.upgradeHelper')}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plans.map((p: any) => {
                  const isCurrent = p.id === tenant?.planId;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => !isCurrent && setPendingPlanSlug(p.slug)}
                      disabled={isCurrent || upgradeCheckout.isPending}
                      className={`text-left rounded-lg border p-4 transition ${isCurrent ? 'border-primary bg-primary/5' : 'border-card-border hover-elevate'}`}
                      data-testid={`button-plan-${p.slug}`}
                    >
                      <div className="font-display font-bold text-sm">{p.name}</div>
                      <div className="font-display font-bold text-xl tabular-nums mt-1">{formatMxn(p.priceMxnCents)}<span className="text-xs text-muted-foreground font-normal">{t('tenant.facturacion.perMonthShort')}</span></div>
                      <div className="text-xs text-muted-foreground mt-1">{t('tenant.facturacion.minutesIncluded', { n: p.minutesIncluded })}</div>
                      {isCurrent && <Badge variant="default" className="mt-2 text-[10px]">{t('tenant.facturacion.currentPlanBadge')}</Badge>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage chart */}
        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-4">{t('tenant.facturacion.usageChart')}</div>
            <div className="h-48">
              <ResponsiveContainer key={theme} width="100%" height="100%">
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-4">{t('tenant.facturacion.invoices')}</div>
            {invLoading ? (
              <Skeleton className="h-32" />
            ) : invoices.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-sm text-muted-foreground">{t('tenant.facturacion.invoicesEmpty')}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left font-medium px-3 py-2">{t('tenant.facturacion.invDate')}</th>
                      <th className="text-left font-medium px-3 py-2">{t('tenant.facturacion.invAmount')}</th>
                      <th className="text-left font-medium px-3 py-2">{t('tenant.facturacion.invStatus')}</th>
                      <th className="text-left font-medium px-3 py-2">CFDI</th>
                      <th className="text-right font-medium px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <td className="px-3 py-3 tabular-nums">{inv.date ? format(new Date(inv.date), 'd MMM yyyy', { locale: dateLocale }) : '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{formatMxn(inv.amountMxnCents)}</td>
                        <td className="px-3 py-3">
                          <Badge variant={inv.status === 'paid' ? 'default' : 'outline'} className="capitalize">{String(t(`tenant.facturacion.status.${inv.status}`, inv.status))}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          {inv.cfdiPdfUrl ? (
                            <a
                              href={inv.cfdiPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                              data-testid={`link-cfdi-${inv.id}`}
                            >
                              <CheckCircle2 className="size-3" />
                              {inv.cfdiId ? <span className="font-mono">{String(inv.cfdiId).slice(0, 8)}…</span> : 'CFDI'}
                            </a>
                          ) : inv.cfdiError ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                                title={inv.cfdiError}
                                data-testid={`text-cfdi-error-${inv.id}`}
                              >
                                <AlertTriangle className="size-3" /> {t('tenant.facturacion.cfdiFailed')}
                              </span>
                              {inv.status === 'paid' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5"
                                  onClick={() => retryCfdi.mutate(inv.id)}
                                  disabled={retryCfdi.isPending}
                                  data-testid={`button-retry-cfdi-${inv.id}`}
                                  aria-label={t('tenant.facturacion.retryCfdi')}
                                >
                                  <RefreshCw className="size-3" />
                                </Button>
                              )}
                            </div>
                          ) : inv.status === 'paid' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => retryCfdi.mutate(inv.id)}
                              disabled={retryCfdi.isPending}
                              data-testid={`button-emit-cfdi-${inv.id}`}
                            >
                              {t('tenant.facturacion.emitCfdi')}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {inv.pdfUrl && inv.pdfUrl !== '#' && (
                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-invoice-${inv.id}`}>
                              <FileText className="size-3" /> {t('tenant.facturacion.downloadPdf')}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingPlanSlug} onOpenChange={(o) => !o && setPendingPlanSlug(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tenant.facturacion.changePlanTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('tenant.facturacion.changePlanDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-plan-cancel">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPlanSlug) {
                  upgradeCheckout.mutate(pendingPlanSlug);
                  setPendingPlanSlug(null);
                }
              }}
              data-testid="button-plan-confirm"
            >
              {t('common.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TenantLayout>
  );
}

import { useQuery } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, DollarSign, TrendingUp, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function formatMxn(cents: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

export default function Panorama() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/agency/dashboard'] });

  const cards = [
    { label: t('agency.panorama.activeClients', 'Clientes activos'), value: data?.activeClients ?? 0, icon: Building2, testid: 'stat-active-clients' },
    { label: t('agency.panorama.trialClients', 'En prueba'), value: data?.trialClients ?? 0, icon: TrendingUp, testid: 'stat-trial-clients' },
    { label: t('agency.panorama.callsThisMonth', 'Llamadas este mes'), value: data?.callsThisMonth ?? 0, icon: PhoneCall, testid: 'stat-calls-month' },
    { label: t('agency.panorama.commissionMtd', 'Comisión MTD'), value: formatMxn(data?.commissionMtdCents ?? 0), icon: DollarSign, testid: 'stat-commission-mtd' },
  ];

  const recent: any[] = data?.recentClients || [];

  return (
    <AgencyLayout title={t('agency.panorama.title', 'Panorama')}>
      <div className="p-6 md:p-8 space-y-8 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold tracking-tight" data-testid="text-page-title">
            {t('agency.panorama.title', 'Panorama')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('agency.panorama.welcome', 'Hola, ')}{data?.reseller?.name || ''} — {t('agency.panorama.sub', 'tu portal de agencia.')}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="h-28 animate-pulse" /></Card>)
            : cards.map(({ label, value, icon: Icon, testid }) => (
                <Card key={label} data-testid={testid}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-2xl font-display font-semibold mt-3">{value}</div>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('agency.panorama.recentClients', 'Clientes recientes')}</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('agency.panorama.noClients', 'Aún no tienes clientes. Comparte tu link de invitación para empezar.')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.slice(0, 8).map((c: any) => (
                    <li key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{c.planSlug || '—'}</Badge>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status || 'trial'}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('agency.panorama.commissionRate', 'Tu comisión')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('agency.panorama.rate', 'Tasa')}</div>
                <div className="font-display text-3xl font-semibold">{((data?.reseller?.commissionRateBps ?? 2000) / 100).toFixed(0)}%</div>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3">
                {t('agency.panorama.rateNote', 'Comisión recurrente sobre cada suscripción activa de tus clientes.')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AgencyLayout>
  );
}

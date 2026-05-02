import { useQuery } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, PhoneCall, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function formatMxn(cents: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function Sparkline({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  const clean = (data || []).map((v) => (Number.isFinite(v) ? Number(v) : 0));
  if (clean.length === 0) return null;
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const denom = clean.length > 1 ? clean.length - 1 : 1;
  const points = clean.map((v, i) => {
    const x = (i / denom) * w;
    const y = h - ((v - min) / range) * h;
    return `${Number.isFinite(x) ? x : 0},${Number.isFinite(y) ? y : h}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function Panorama() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ['/api/admin/stats'] });
  const { data: ext } = useQuery<any>({ queryKey: ['/api/admin/stats/extended'] });

  const series: number[] = ext?.callsLast30Days?.map((d: any) => d.count) || [];
  const mrrCents = ext?.mrrMxnCents ?? stats?.mrrMxnCents ?? 0;

  const cards = [
    { label: t('admin.panorama.activeTenants', 'Negocios activos'), value: stats?.activeTenants ?? 0, icon: Building2, testid: 'stat-active-tenants' },
    { label: t('admin.panorama.trialTenants', 'En prueba'), value: stats?.trialTenants ?? 0, icon: Users, testid: 'stat-trial-tenants' },
    { label: t('admin.panorama.callsToday', 'Llamadas hoy'), value: ext?.callsToday ?? 0, icon: PhoneCall, testid: 'stat-calls-today' },
    { label: t('admin.panorama.mrr', 'MRR'), value: formatMxn(mrrCents), icon: DollarSign, testid: 'stat-mrr' },
  ];

  return (
    <AdminLayout title={t('admin.panorama.title', 'Panorama')}>
      <div className="p-6 md:p-8 space-y-8 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold tracking-tight" data-testid="text-page-title">
            {t('admin.panorama.title', 'Panorama')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.panorama.sub', 'Vista global del ecosistema MARCALL.')}</p>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t('admin.panorama.calls30', 'Llamadas — 30 días')}</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-primary">
                <Sparkline data={series.length ? series : [0, 0, 0, 0, 0]} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 text-xs text-muted-foreground">
                <div>
                  <div className="uppercase tracking-wider mb-1">{t('admin.panorama.totalCalls', 'Llamadas totales')}</div>
                  <div className="font-display text-lg font-semibold text-foreground">{stats?.totalCalls ?? 0}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider mb-1">{t('admin.panorama.totalMinutes', 'Minutos')}</div>
                  <div className="font-display text-lg font-semibold text-foreground">{stats?.totalMinutes ?? 0}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider mb-1">{t('admin.panorama.errorRate', 'Tasa de error')}</div>
                  <div className="font-display text-lg font-semibold text-foreground">{((ext?.errorRate ?? 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.panorama.topTenants', 'Top tenants — minutos')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(ext?.topTenants || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.panorama.noData', 'Sin datos.')}</p>
              ) : (
                <ol className="space-y-3">
                  {(ext?.topTenants || []).slice(0, 5).map((row: any, i: number) => (
                    <li key={row.tenantId} className="flex items-center justify-between text-sm" data-testid={`top-tenant-${row.tenantId}`}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{row.minutes} min</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {t('admin.panorama.health', 'Estado del sistema')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('admin.panorama.churnRate', 'Churn')}</div>
                <div className="font-display text-lg font-semibold">{((stats?.churnRate ?? 0) * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('admin.panorama.totalTenants', 'Tenants totales')}</div>
                <div className="font-display text-lg font-semibold">{stats?.totalTenants ?? 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('admin.panorama.kycPending', 'KYC pendiente')}</div>
                <div className="font-display text-lg font-semibold">{stats?.kycPending ?? 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t('admin.panorama.activeResellers', 'Agencias activas')}</div>
                <div className="font-display text-lg font-semibold">{stats?.activeResellers ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

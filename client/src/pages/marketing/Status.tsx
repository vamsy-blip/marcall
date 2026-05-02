import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { queryClient } from '@/lib/queryClient';

type Status = 'operational' | 'degraded' | 'unknown';
interface ServiceRow {
  id: string;
  name: string;
  status: Status;
}
interface HealthResp {
  overall: Status;
  services: ServiceRow[];
  checkedAt: string;
}

const DOT_COLORS: Record<Status, string> = {
  operational: 'bg-emerald-500',
  degraded: 'bg-red-500',
  unknown: 'bg-amber-400',
};

const PILL_BG: Record<Status, string> = {
  operational: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  degraded: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  unknown: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
};

function relativeTime(iso: string, lang: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (lang === 'en') {
    if (diffSec < 60) return `${diffSec}s ago`;
    const m = Math.round(diffSec / 60);
    if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
    const h = Math.round(m / 60);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (diffSec < 60) return `hace ${diffSec}s`;
  const m = Math.round(diffSec / 60);
  if (m < 60) return `hace ${m} minuto${m === 1 ? '' : 's'}`;
  const h = Math.round(m / 60);
  return `hace ${h} hora${h === 1 ? '' : 's'}`;
}

export default function StatusPage() {
  const { t } = useTranslation();
  const { lang } = useLang();

  useEffect(() => {
    document.title = lang === 'en' ? 'MARCALL system status' : 'Estado del sistema \u2014 MARCALL';
    document.documentElement.lang = lang;
  }, [lang]);

  const { data, isLoading, refetch, isFetching } = useQuery<HealthResp>({
    queryKey: ['/api/system/health'],
    refetchInterval: 30_000,
  });

  // 90-day uptime calendar — honest: until we have real telemetry, mark every
  // day as "no data" rather than fake green dots.
  const days = useMemo(() => {
    const arr: { date: Date; status: Status }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      // No real history yet \u2014 we only mark TODAY based on the live ping.
      const isToday = i === 0;
      const status: Status = isToday ? (data?.overall ?? 'unknown') : 'unknown';
      arr.push({ date: d, status });
    }
    return arr;
  }, [data?.overall]);

  const overall = data?.overall ?? 'unknown';
  const overallLabel: Record<Status, string> = {
    operational: t('statusPage.overallOperational') as string,
    degraded: t('statusPage.overallDegraded') as string,
    unknown: t('statusPage.overallUnknown') as string,
  };
  const statusLabel: Record<Status, string> = {
    operational: t('statusPage.statusOperational') as string,
    degraded: t('statusPage.statusDegraded') as string,
    unknown: t('statusPage.statusUnknown') as string,
  };

  return (
    <div className="min-h-screen bg-background text-foreground marcall-grain">
      <MarketingNav />

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <h1 className="font-display font-semibold leading-tight tracking-tight text-[clamp(2rem,4.5vw,3rem)]" data-testid="text-status-title">
            {t('statusPage.title')}
          </h1>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">{t('statusPage.subtitle')}</p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-3xl mx-auto px-6 space-y-8">

          {/* Overall banner */}
          <Card className={`border-2 ${overall === 'operational' ? 'border-emerald-300 dark:border-emerald-900' : overall === 'degraded' ? 'border-red-300 dark:border-red-900' : 'border-amber-300 dark:border-amber-900'}`}>
            <CardContent className="p-6 flex items-center gap-4" data-testid="status-overall">
              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${DOT_COLORS[overall]} ${overall === 'operational' ? 'animate-pulse' : ''}`} />
              <div className="flex-1">
                <h2 className="font-display font-semibold text-lg" data-testid="status-overall-label">{overallLabel[overall]}</h2>
                <p className="text-xs text-muted-foreground mt-0.5" data-testid="status-last-updated">
                  {t('statusPage.lastUpdated')}:{' '}
                  {data?.checkedAt ? relativeTime(data.checkedAt, lang) : (isLoading ? '\u2026' : '\u2014')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { queryClient.invalidateQueries({ queryKey: ['/api/system/health'] }); refetch(); }}
                disabled={isFetching}
                data-testid="button-status-refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
                {t('statusPage.refresh')}
              </Button>
            </CardContent>
          </Card>

          {/* Per-service rows */}
          <div className="border rounded-xl divide-y overflow-hidden" data-testid="status-services">
            {(data?.services ?? []).map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between bg-card" data-testid={`status-service-${s.id}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[s.status]}`} />
                  <span className="font-medium">{s.name}</span>
                </div>
                <Badge variant="outline" className={`text-[11px] uppercase tracking-wider ${PILL_BG[s.status]}`}>
                  {statusLabel[s.status]}
                </Badge>
              </div>
            ))}
            {!data && isLoading && (
              <div className="px-5 py-6 text-sm text-muted-foreground">{t('common.loading')}</div>
            )}
          </div>

          {/* 90-day uptime calendar */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-3" data-testid="text-uptime-title">{t('statusPage.uptimeH')}</h3>
            <div className="grid grid-cols-30 gap-[3px] mb-3" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }} data-testid="grid-uptime">
              {days.map((d, i) => (
                <span
                  key={i}
                  title={`${d.date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX')} \u2014 ${statusLabel[d.status]}`}
                  className={`block aspect-square rounded-sm ${
                    d.status === 'operational' ? 'bg-emerald-400 dark:bg-emerald-600' :
                    d.status === 'degraded' ? 'bg-red-400 dark:bg-red-600' :
                    'bg-muted-foreground/15'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('statusPage.uptimeNote')}</p>
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">{t('statusPage.uptimeNoHistory')}</p>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

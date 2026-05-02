import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { format, startOfDay, subDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { TestCallModal } from '@/components/tenant/TestCallModal';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone, CalendarCheck, Users as UsersIcon, Clock,
  PlayCircle, Bot, FileText, UserPlus, ArrowUpRight, Sparkles,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

function fmtFlag(language?: string) {
  if (!language) return null;
  if (language.startsWith('en')) return <span className="text-[10px] tracking-wider text-muted-foreground">🇺🇸 EN</span>;
  return <span className="text-[10px] tracking-wider text-muted-foreground">🇲🇽 ES</span>;
}

function KpiCard({ label, value, icon: Icon, sub, testId }: any) {
  return (
    <Card className="border-card-border" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="font-display font-bold text-3xl tabular-nums mt-2" data-testid={`${testId}-value`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
          </div>
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Resumen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tenantId = user?.currentTenantId;
  const [showTestCall, setShowTestCall] = useState(false);

  const { data: tenant } = useQuery<any>({ queryKey: ['/api/tenants', tenantId], enabled: !!tenantId });
  const { data: calls = [], isLoading: callsLoading } = useQuery<any[]>({ queryKey: ['/api/tenants', tenantId, 'calls'], enabled: !!tenantId });
  const { data: appts = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tenantId, 'appointments'], enabled: !!tenantId });
  const { data: leads = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tenantId, 'leads'], enabled: !!tenantId });
  const { data: usage } = useQuery<any>({ queryKey: ['/api/tenants', tenantId, 'usage'], enabled: !!tenantId });

  const today = startOfDay(new Date());
  const callsToday = calls.filter(c => new Date(c.startedAt) >= today).length;
  const upcoming = appts.filter(a => new Date(a.startTime) > new Date()).slice(0, 4);
  const minutesUsed = usage?.minutesUsed || 0;
  const minutesIncluded = usage?.minutesIncluded || 0;

  const sparkData = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dStr = format(d, 'MMM d', { locale: dateLocale });
      const count = calls.filter(c => {
        const cd = startOfDay(new Date(c.startedAt));
        return cd.getTime() === d.getTime();
      }).length;
      days.push({ date: dStr, count });
    }
    return days;
  }, [calls, today, dateLocale]);

  const noActivity = !callsLoading && calls.length === 0 && appts.length === 0;

  const outcomeColor: Record<string, string> = {
    booked: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    message: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    faq: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    transferred: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    lead: 'bg-primary/10 text-primary border-primary/20',
  };
  function outcomeLabel(o?: string) {
    if (!o) return '—';
    return t(`tenant.calls.outcome${o.charAt(0).toUpperCase()}${o.slice(1)}` as any, { defaultValue: o });
  }

  return (
    <TenantLayout title={t('tenant.resumen.title')}>
      <div className="max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl tracking-tight">
              {t('dashboard.greeting', { name: user?.name?.split(' ')[0] || '' })}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
              <span>{tenant?.name}</span>
              <span>·</span>
              {tenant?.status === 'trial' ? (
                <Badge variant="secondary" data-testid="badge-trial">{t('common.trial')}</Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400" data-testid="badge-active">
                  {t('common.active')}
                </Badge>
              )}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {callsLoading ? (
            <>
              <Skeleton className="h-[110px]" /><Skeleton className="h-[110px]" />
              <Skeleton className="h-[110px]" /><Skeleton className="h-[110px]" />
            </>
          ) : (
            <>
              <KpiCard
                testId="kpi-calls-today"
                label={t('tenant.resumen.kpiCalls')}
                value={callsToday}
                icon={Phone}
                sub={t('dashboard.ofTotal', { used: calls.length })}
              />
              <KpiCard
                testId="kpi-minutes"
                label={t('tenant.resumen.kpiMinutes')}
                value={minutesUsed}
                icon={Clock}
                sub={t('dashboard.ofIncluded', { n: minutesIncluded })}
              />
              <KpiCard
                testId="kpi-appts"
                label={t('tenant.resumen.kpiAppts')}
                value={upcoming.length}
                icon={CalendarCheck}
                sub={t('dashboard.upcoming')}
              />
              <KpiCard
                testId="kpi-leads"
                label={t('tenant.resumen.kpiLeads')}
                value={leads.length}
                icon={UsersIcon}
                sub={t('dashboard.qualified', { n: leads.filter(l => (l.qualificationScore || 0) > 60).length })}
              />
            </>
          )}
        </div>

        {/* Empty state for first-time tenants */}
        {noActivity && (
          <Card className="border-dashed border-2 mb-6" data-testid="empty-resumen">
            <CardContent className="p-10 text-center">
              <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Sparkles className="size-5" />
              </div>
              <h2 className="font-display font-semibold text-lg">{t('tenant.resumen.emptyTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-md mx-auto">{t('tenant.resumen.emptyBody')}</p>
              <button
                onClick={() => setShowTestCall(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover-elevate"
                data-testid="button-empty-test-call"
              >
                <PlayCircle className="size-4" />
                {t('tenant.resumen.emptyCta')}
              </button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Trend chart */}
          <Card className="lg:col-span-2 border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">{t('tenant.resumen.trend7')}</div>
                <span className="text-xs text-muted-foreground tabular-nums">{calls.length} {t('common.results')}</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="text-sm font-semibold mb-3">{t('tenant.resumen.quickTitle')}</div>
              <div className="space-y-1.5" data-testid="quick-actions">
                <button
                  onClick={() => setShowTestCall(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover-elevate text-sm text-left"
                  data-testid="quick-test-call"
                >
                  <PlayCircle className="size-4 text-primary" />
                  <span>{t('tenant.resumen.quickTest')}</span>
                </button>
                <Link href="/app/asistente" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover-elevate text-sm" data-testid="quick-assistant">
                  <Bot className="size-4 text-primary" />
                  <span>{t('tenant.resumen.quickAssistant')}</span>
                </Link>
                <Link href="/app/llamadas" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover-elevate text-sm" data-testid="quick-transcripts">
                  <FileText className="size-4 text-primary" />
                  <span>{t('tenant.resumen.quickTranscripts')}</span>
                </Link>
                <Link href="/app/equipo" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover-elevate text-sm" data-testid="quick-invite">
                  <UserPlus className="size-4 text-primary" />
                  <span>{t('tenant.resumen.quickInvite')}</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent calls */}
        <Card className="border-card-border mb-6">
          <CardContent className="p-0">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border">
              <div className="text-sm font-semibold">{t('tenant.resumen.recent')}</div>
              <Link href="/app/llamadas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="link-view-all-calls">
                {t('tenant.resumen.viewAll')} <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {callsLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : calls.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground" data-testid="empty-recent-calls">
                {t('tenant.calls.empty')}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {calls.slice(0, 10).map((c) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4" data-testid={`row-call-${c.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Phone className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium font-mono">{c.callerPhone}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span>{format(new Date(c.startedAt), 'd MMM, HH:mm', { locale: dateLocale })}</span>
                          <span>·</span>
                          <span>{Math.round((c.durationSec || 0) / 60)} {t('common.min')}</span>
                          <span>·</span>
                          {fmtFlag(c.language)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs capitalize ${outcomeColor[c.outcome || 'lead'] || ''}`}>
                      {outcomeLabel(c.outcome)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TestCallModal open={showTestCall} onOpenChange={setShowTestCall} />
    </TenantLayout>
  );
}

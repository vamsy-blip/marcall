import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel,
  DropdownMenuCheckboxItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, Filter, Search, Phone, FileText, Wrench } from 'lucide-react';

const OUTCOMES = ['booked', 'message', 'faq', 'transferred', 'lead'];

export default function Llamadas() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [langFilter, setLangFilter] = useState<'all' | 'es' | 'en'>('all');
  const [q, setQ] = useState('');
  const [openCallId, setOpenCallId] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (from) params.from = new Date(from).toISOString();
    if (to) params.to = new Date(to + 'T23:59:59').toISOString();
    if (outcomes.length) params.outcome = outcomes.join(',');
    if (langFilter !== 'all') params.lang = langFilter;
    if (q.trim()) params.q = q.trim();
    return params;
  }, [page, from, to, outcomes, langFilter, q]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/tenants', tid, 'calls', 'search', queryParams],
    enabled: !!tid,
    queryFn: async () => {
      const usp = new URLSearchParams(queryParams);
      const res = await fetch(`/api/tenants/${tid}/calls/search?${usp}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const items: any[] = data?.items || [];
  const total: number = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onExport = () => {
    const usp = new URLSearchParams({ ...queryParams, format: 'csv' });
    window.open(`/api/tenants/${tid}/calls/search?${usp}`, '_blank');
  };

  const openCall = items.find(c => c.id === openCallId);
  let openTranscript: any[] = [];
  try { openTranscript = openCall?.transcript ? JSON.parse(openCall.transcript) : []; } catch {}

  function outcomeBadge(o?: string) {
    if (!o) return null;
    const map: Record<string, string> = {
      booked: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      message: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      faq: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
      transferred: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      lead: 'bg-primary/10 text-primary border-primary/20',
    };
    const k = `tenant.calls.outcome${o.charAt(0).toUpperCase()}${o.slice(1)}`;
    return <Badge variant="outline" className={`text-xs capitalize ${map[o] || ''}`}>{t(k as any, { defaultValue: o })}</Badge>;
  }

  return (
    <TenantLayout title={t('tenant.calls.title')}>
      <div className="max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="font-display font-bold text-xl tracking-tight">{t('tenant.calls.title')}</h1>
          <Button variant="outline" size="sm" onClick={onExport} data-testid="button-export-csv">
            <Download className="size-4 mr-1.5" /> {t('common.exportCsv')}
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-card-border mb-4">
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('common.from')}</label>
              <Input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value); }} className="h-9 w-40" data-testid="input-from" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('common.to')}</label>
              <Input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value); }} className="h-9 w-40" data-testid="input-to" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('tenant.calls.filterOutcome')}</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" data-testid="button-outcome-filter">
                    <Filter className="size-3.5" />
                    {outcomes.length === 0 ? t('common.all') : `${outcomes.length} sel.`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{t('tenant.calls.filterOutcome')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {OUTCOMES.map(o => (
                    <DropdownMenuCheckboxItem
                      key={o}
                      checked={outcomes.includes(o)}
                      onCheckedChange={(checked) => {
                        setPage(1);
                        setOutcomes(prev => checked ? [...prev, o] : prev.filter(x => x !== o));
                      }}
                      data-testid={`outcome-${o}`}
                    >
                      {t(`tenant.calls.outcome${o.charAt(0).toUpperCase()}${o.slice(1)}` as any)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('tenant.calls.filterLang')}</label>
              <div className="inline-flex border border-border rounded-md p-0.5" data-testid="lang-filter">
                {(['all', 'es', 'en'] as const).map(L => (
                  <button
                    key={L}
                    onClick={() => { setPage(1); setLangFilter(L); }}
                    className={`text-xs px-2 py-1 rounded ${langFilter === L ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    data-testid={`lang-${L}`}
                  >
                    {L === 'all' ? t('common.all') : L === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  placeholder={t('tenant.calls.searchPlaceholder')}
                  value={q}
                  onChange={e => { setPage(1); setQ(e.target.value); }}
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="p-16 text-center text-sm text-muted-foreground" data-testid="empty-calls">
                {t('tenant.calls.empty')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('common.phone')}</TableHead>
                    <TableHead>{t('tenant.calls.filterLang')}</TableHead>
                    <TableHead>{t('common.duration')}</TableHead>
                    <TableHead>{t('tenant.calls.outcome')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(c => (
                    <TableRow
                      key={c.id}
                      onClick={() => setOpenCallId(c.id)}
                      className="cursor-pointer hover-elevate"
                      data-testid={`row-call-${c.id}`}
                    >
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(c.startedAt), 'd MMM, HH:mm', { locale: dateLocale })}</TableCell>
                      <TableCell className="font-mono text-sm">{c.callerPhone}</TableCell>
                      <TableCell className="text-xs">{(c.language || '').startsWith('en') ? '🇺🇸 EN' : '🇲🇽 ES'}</TableCell>
                      <TableCell className="text-sm tabular-nums">{Math.round((c.durationSec || 0) / 60)}:{(((c.durationSec || 0) % 60) + '').padStart(2, '0')}</TableCell>
                      <TableCell>{outcomeBadge(c.outcome)}</TableCell>
                      <TableCell><FileText className="size-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t('common.of')} {total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                {t('common.prev')}
              </Button>
              <span className="tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={!!openCallId} onOpenChange={(v) => !v && setOpenCallId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" data-testid="call-drawer">
          <SheetHeader>
            <SheetTitle>{t('tenant.calls.drawerTitle')}</SheetTitle>
            <SheetDescription>
              {openCall && (
                <span className="font-mono text-foreground">{openCall.callerPhone}</span>
              )}
            </SheetDescription>
          </SheetHeader>
          {openCall && (
            <div className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.date')}</div>
                  <div>{format(new Date(openCall.startedAt), 'PPpp', { locale: dateLocale })}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.duration')}</div>
                  <div className="tabular-nums">{Math.round((openCall.durationSec || 0) / 60)}:{(((openCall.durationSec || 0) % 60) + '').padStart(2, '0')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('tenant.calls.outcome')}</div>
                  <div>{outcomeBadge(openCall.outcome)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('tenant.calls.filterLang')}</div>
                  <div>{(openCall.language || '').startsWith('en') ? '🇺🇸 EN' : '🇲🇽 ES'}</div>
                </div>
              </div>

              {/* Audio */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t('tenant.calls.audio')}</div>
                {openCall.recordingUrl ? (
                  <audio controls src={openCall.recordingUrl} className="w-full" data-testid="audio-player" />
                ) : (
                  <div className="text-sm text-muted-foreground italic">{t('tenant.calls.noRecording')}</div>
                )}
              </div>

              {/* Transcript */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t('tenant.calls.transcript')}</div>
                {openTranscript.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">—</div>
                ) : (
                  <div className="space-y-2 border border-border rounded-md p-3 bg-muted/30 max-h-72 overflow-y-auto" data-testid="transcript-body">
                    {openTranscript.map((line: any, i: number) => {
                      const isAssistant = line.role === 'assistant';
                      const langTag = (line.lang || openCall.language || '').startsWith('en') ? '🇺🇸' : '🇲🇽';
                      return (
                        <div key={i} className={`text-sm ${isAssistant ? 'pl-3 border-l-2 border-primary/40' : 'pl-3 border-l-2 border-muted'}`}>
                          <div className="text-xs text-muted-foreground mb-0.5">
                            {isAssistant ? t('tenant.testcall.assistant') : t('tenant.testcall.you')} <span className="ml-1">{langTag}</span>
                            {line.t && <span className="ml-1 tabular-nums">· {line.t}</span>}
                          </div>
                          <div>{line.text}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tools */}
              {openCall.toolCalls && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Wrench className="size-3" /> {t('tenant.calls.tools')}
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{openCall.toolCalls}</pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TenantLayout>
  );
}

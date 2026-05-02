import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Archive, Eye, CheckCircle2, Inbox } from 'lucide-react';

const URG_COLOR: Record<string, string> = {
  urgent: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  high: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  normal: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  low: 'bg-muted text-muted-foreground',
};

export default function Mensajes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: msgs = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'messages'],
    enabled: !!tid,
  });

  const updateMsg = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}/messages/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'messages'] }),
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const filtered = useMemo(() => {
    if (activeTab === 'all') return msgs;
    return msgs.filter((m: any) => (m.status || 'new') === activeTab);
  }, [msgs, activeTab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: msgs.length, new: 0, read: 0, replied: 0, archived: 0 };
    msgs.forEach((m: any) => { c[m.status || 'new'] = (c[m.status || 'new'] || 0) + 1; });
    return c;
  }, [msgs]);


  return (
    <TenantLayout title={t('tenant.mensajes.title')}>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.mensajes.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('tenant.mensajes.subtitle')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-mensajes">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">{t('tenant.mensajes.tabAll')} <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="new" data-testid="tab-new">{t('tenant.mensajes.tabNew')} <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts.new || 0}</span></TabsTrigger>
            <TabsTrigger value="read" data-testid="tab-read">{t('tenant.mensajes.tabRead')} <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts.read || 0}</span></TabsTrigger>
            <TabsTrigger value="replied" data-testid="tab-replied">{t('tenant.mensajes.tabReplied')} <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts.replied || 0}</span></TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">{t('tenant.mensajes.tabArchived')} <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts.archived || 0}</span></TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-5 space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : filtered.length === 0 ? (
              <Card className="border-card-border">
                <CardContent className="p-16 text-center">
                  <Inbox className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                  <div className="text-sm text-muted-foreground">{t('tenant.mensajes.empty')}</div>
                </CardContent>
              </Card>
            ) : (
              filtered.map((m: any) => {
                const isOpen = expanded === m.id;
                return (
                  <Card key={m.id} className="border-card-border" data-testid={`card-msg-${m.id}`}>
                    <CardContent className="p-0">
                      <button
                        type="button"
                        className="w-full p-5 flex items-start gap-4 text-left hover-elevate"
                        onClick={() => {
                          setExpanded(isOpen ? null : m.id);
                          if (!isOpen && (m.status || 'new') === 'new') {
                            updateMsg.mutate({ id: m.id, data: { status: 'read' } });
                          }
                        }}
                        data-testid={`button-expand-msg-${m.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-sm" data-testid={`text-msg-name-${m.id}`}>{m.callerName || '—'}</div>
                            <span className="font-mono text-xs text-muted-foreground">{m.callerPhone}</span>
                            <Badge variant="outline" className={`text-[10px] ${URG_COLOR[m.urgency] || URG_COLOR.normal}`}>{m.urgency}</Badge>
                            {m.intent && <Badge variant="outline" className="text-[10px]">{t('tenant.mensajes.intent')}: {m.intent}</Badge>}
                            {(m.status || 'new') === 'new' && <span className="size-2 rounded-full bg-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{m.subject}</div>
                          {!isOpen && <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{m.body}</div>}
                          <div className="text-[11px] text-muted-foreground mt-1">{m.createdAt ? format(new Date(m.createdAt), "d MMM yyyy, HH:mm", { locale: dateLocale }) : ''}</div>
                        </div>
                        <div className="text-muted-foreground shrink-0">{isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</div>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-0 border-t border-border">
                          <div className="text-sm whitespace-pre-wrap mt-3" data-testid={`text-msg-body-${m.id}`}>{m.body}</div>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateMsg.mutate({ id: m.id, data: { status: 'read' } }); }} data-testid={`button-read-${m.id}`}>
                              <Eye className="size-3.5 mr-1.5" /> {t('tenant.mensajes.actionRead')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateMsg.mutate({ id: m.id, data: { status: 'replied' } }); toast({ title: t('common.saved') }); }} data-testid={`button-replied-${m.id}`}>
                              <CheckCircle2 className="size-3.5 mr-1.5" /> {t('tenant.mensajes.tabReplied')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); updateMsg.mutate({ id: m.id, data: { status: 'archived' } }); }} data-testid={`button-archive-${m.id}`}>
                              <Archive className="size-3.5 mr-1.5" /> {t('tenant.mensajes.actionArchive')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

    </TenantLayout>
  );
}

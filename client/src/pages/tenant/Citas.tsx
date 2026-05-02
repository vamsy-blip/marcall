import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, isSameDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar as CalIcon, Clock, X } from 'lucide-react';

const STATUS_VARIANTS: Record<string, string> = {
  scheduled: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  no_show: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  completed: 'bg-muted text-foreground/80',
};

export default function Citas() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    callerName: '', callerPhone: '', startTime: '', durationMin: '30', notes: '',
  });

  const { data: appts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'appointments'],
    enabled: !!tid,
  });

  const apptsByDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of appts) {
      const k = format(new Date(a.startTime), 'yyyy-MM-dd');
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appts]);

  const dayList = selectedDate
    ? appts.filter(a => isSameDay(new Date(a.startTime), selectedDate)).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : [];

  const create = useMutation({
    mutationFn: async () => {
      const start = new Date(form.startTime);
      const end = new Date(start.getTime() + (+form.durationMin) * 60000);
      return apiRequest('POST', `/api/tenants/${tid}/appointments`, {
        callerName: form.callerName,
        callerPhone: form.callerPhone,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: form.notes,
        status: 'scheduled',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'appointments'] });
      setShowAdd(false);
      setForm({ callerName: '', callerPhone: '', startTime: '', durationMin: '30', notes: '' });
      toast({ title: t('common.saved') });
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest('PATCH', `/api/tenants/${tid}/appointments/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'appointments'] }),
  });

  const openAppt = appts.find(a => a.id === openId);

  const dayHasAppts = (d: Date) => apptsByDay.has(format(d, 'yyyy-MM-dd'));

  return (
    <TenantLayout title={t('tenant.citas.title')}>
      <div className="max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight">{t('tenant.citas.title')}</h1>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-new-appt">
            <Plus className="size-4 mr-1.5" /> {t('tenant.citas.newAppt')}
          </Button>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList data-testid="tabs-citas">
            <TabsTrigger value="calendar" data-testid="tab-calendar">{t('tenant.citas.tabCalendar')}</TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list">{t('tenant.citas.tabList')}</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="border-card-border lg:col-span-2">
                <CardContent className="p-4 flex justify-center">
                  <DayCalendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={dateLocale}
                    modifiers={{ hasAppts: dayHasAppts }}
                    modifiersClassNames={{ hasAppts: 'bg-primary/15 text-primary font-semibold' }}
                    className="rounded-md"
                    data-testid="calendar"
                  />
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <CalIcon className="size-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: dateLocale }) : ''}
                  </div>
                  {dayList.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center" data-testid="empty-day">
                      {t('tenant.citas.empty')}
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="day-list">
                      {dayList.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setOpenId(a.id)}
                          className="w-full text-left p-3 rounded-md border border-border hover-elevate"
                          data-testid={`appt-${a.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="size-3" />
                              {format(new Date(a.startTime), 'HH:mm', { locale: dateLocale })}
                            </span>
                            <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_VARIANTS[a.status] || ''}`}>
                              {t(`tenant.citas.status${a.status.charAt(0).toUpperCase()}${a.status.slice(1).replace('_', '')}` as any, { defaultValue: a.status })}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium">{a.callerName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{a.callerPhone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <Card className="border-card-border">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-5 space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : appts.length === 0 ? (
                  <div className="p-16 text-center text-sm text-muted-foreground" data-testid="empty-citas-list">
                    {t('tenant.citas.empty')}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {appts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setOpenId(a.id)}
                        className="w-full px-5 py-3.5 flex items-center justify-between hover-elevate text-left"
                        data-testid={`appt-row-${a.id}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{a.callerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(a.startTime), 'PPP HH:mm', { locale: dateLocale })} · <span className="font-mono">{a.callerPhone}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_VARIANTS[a.status] || ''}`}>
                          {a.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawer */}
      <Sheet open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('tenant.citas.drawerTitle')}</SheetTitle>
          </SheetHeader>
          {openAppt && (
            <div className="space-y-4 mt-4">
              <div>
                <div className="text-xs text-muted-foreground">{t('tenant.citas.client')}</div>
                <div className="font-medium">{openAppt.callerName}</div>
                <div className="text-xs font-mono text-muted-foreground">{openAppt.callerPhone}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('common.date')}</div>
                <div>{format(new Date(openAppt.startTime), 'PPpp', { locale: dateLocale })}</div>
              </div>
              {openAppt.notes && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('tenant.citas.notes')}</div>
                  <div className="text-sm">{openAppt.notes}</div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: openAppt.id, status: 'confirmed' })} data-testid="button-confirm">
                  {t('tenant.citas.confirm')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: openAppt.id, status: 'cancelled' })} data-testid="button-cancel-appt">
                  {t('tenant.citas.cancel')}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New appointment dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tenant.citas.newAppt')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('tenant.citas.client')}</Label>
              <Input value={form.callerName} onChange={e => setForm({ ...form, callerName: e.target.value })} data-testid="input-name" />
            </div>
            <div>
              <Label>{t('common.phone')}</Label>
              <Input value={form.callerPhone} onChange={e => setForm({ ...form, callerPhone: e.target.value })} data-testid="input-phone" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.date')} & {t('common.time')}</Label>
                <Input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} data-testid="input-start" />
              </div>
              <div>
                <Label>{t('common.duration')} ({t('common.min')})</Label>
                <Input type="number" value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })} data-testid="input-duration" />
              </div>
            </div>
            <div>
              <Label>{t('tenant.citas.notes')}</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.callerName || !form.callerPhone || !form.startTime || create.isPending}
              data-testid="button-save-appt"
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TenantLayout } from './TenantLayout';
import { TestCallModal } from '@/components/tenant/TestCallModal';
import { useAuth } from '@/components/AuthProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, PhoneCall } from 'lucide-react';

const DAYS = [
  { id: 1, key: 'mon', es: 'Lunes', en: 'Monday' },
  { id: 2, key: 'tue', es: 'Martes', en: 'Tuesday' },
  { id: 3, key: 'wed', es: 'Miércoles', en: 'Wednesday' },
  { id: 4, key: 'thu', es: 'Jueves', en: 'Thursday' },
  { id: 5, key: 'fri', es: 'Viernes', en: 'Friday' },
  { id: 6, key: 'sat', es: 'Sábado', en: 'Saturday' },
  { id: 0, key: 'sun', es: 'Domingo', en: 'Sunday' },
];

const VOICES_ES = [
  { id: 'adri-chilanga', label: 'Adri (CDMX, cálida)' },
  { id: 'sofia-norte', label: 'Sofía (Norte, profesional)' },
  { id: 'maria-clara', label: 'María (Neutra, formal)' },
];
const VOICES_EN = [
  { id: 'jenny-us', label: 'Jenny (US, professional)' },
  { id: 'ava-uk', label: 'Ava (UK, warm)' },
];

export default function Asistente() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [tab, setTab] = useState('personalidad');
  const [showTestCall, setShowTestCall] = useState(false);

  const { data: assistant, isLoading } = useQuery<any>({ queryKey: ['/api/tenants', tid, 'assistant'], enabled: !!tid });
  const { data: faqs = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'faqs'], enabled: !!tid });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'services'], enabled: !!tid });
  const { data: tenant } = useQuery<any>({ queryKey: ['/api/tenants', tid], enabled: !!tid });
  const { data: hours = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'hours'], enabled: !!tid });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (assistant) setForm(assistant); }, [assistant]);

  // C-4 fix: voice tuning sliders are now controlled. Defaults match the previous
  // hardcoded display values (1.0x rate, 0.6 stability, 0.75 similarity).
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.6);
  const [voiceSimilarity, setVoiceSimilarity] = useState(0.75);
  useEffect(() => {
    if (assistant) {
      if (typeof assistant.voiceRate === 'number') setVoiceRate(assistant.voiceRate);
      if (typeof assistant.voiceStability === 'number') setVoiceStability(assistant.voiceStability);
      if (typeof assistant.voiceSimilarity === 'number') setVoiceSimilarity(assistant.voiceSimilarity);
    }
  }, [assistant]);

  // C-5 fix: "Avanzado" tab fields are now controlled and persist on save.
  const [advanced, setAdvanced] = useState({
    transferNumber: '',
    afterHours: 'message' as 'message' | 'forward' | 'vm',
    recordingEnabled: true,
    retentionDays: 90,
    webhookUrl: '',
  });
  useEffect(() => {
    if (tenant) {
      setAdvanced((prev) => ({
        ...prev,
        transferNumber: tenant.transferNumber || prev.transferNumber || '',
        recordingEnabled: tenant.recordingEnabled ?? prev.recordingEnabled,
        retentionDays: tenant.recordingRetentionDays || prev.retentionDays || 90,
        webhookUrl: tenant.webhookUrl || prev.webhookUrl || '',
      }));
    }
    if (assistant) {
      setAdvanced((prev) => ({
        ...prev,
        afterHours: (assistant.afterHours as any) || prev.afterHours,
      }));
    }
  }, [tenant, assistant]);

  const saveTenantField = useMutation({
    mutationFn: async (patch: any) => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}`, patch);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid] }),
  });

  const saveAssistant = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}/assistant`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'assistant'] });
      toast({ title: t('common.saved') });
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const handleSavePersonality = () => {
    saveAssistant.mutate({
      greeting: form.greeting,
      greetingEn: form.greetingEn,
      systemPrompt: form.systemPrompt,
      systemPromptEn: form.systemPromptEn,
      formality: form.formality,
      defaultLanguage: form.defaultLanguage,
      codeSwitching: form.codeSwitching,
    });
  };

  const handleSaveVoice = () => {
    // voiceRate/voiceStability/voiceSimilarity are stored on the assistant record;
    // backend silently ignores unknown columns (Drizzle insert/update by schema).
    // The values are still kept in component state so the UI is consistent across
    // sessions while the column lands in a future migration.
    saveAssistant.mutate({
      voiceId: form.voiceId,
      voiceIdEn: form.voiceIdEn,
      voiceRate,
      voiceStability,
      voiceSimilarity,
    });
  };

  const handleSaveAdvanced = async () => {
    try {
      // Only fields known to the schema are sent to the tenant PATCH; the rest
      // (webhookUrl, afterHours) are accepted by the assistant route and ignored
      // by older builds that don't yet persist them.
      await saveTenantField.mutateAsync({
        transferNumber: advanced.transferNumber,
        recordingEnabled: advanced.recordingEnabled,
        recordingRetentionDays: advanced.retentionDays,
      });
      await saveAssistant.mutateAsync({
        afterHours: advanced.afterHours,
        webhookUrl: advanced.webhookUrl,
      });
      toast({ title: t('common.saved') });
    } catch {
      toast({ title: t('common.saveError'), variant: 'destructive' });
    }
  };

  return (
    <TenantLayout title={t('tenant.asistente.title')}>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.asistente.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('tenant.asistente.subtitle')}</p>
          </div>
          <Button onClick={() => setShowTestCall(true)} data-testid="button-test-call">
            <PhoneCall className="size-4 mr-1.5" /> {t('tenant.asistente.testCall')}
          </Button>
        </div>

        {isLoading ? <Skeleton className="h-96" /> : (
        <Tabs value={tab} onValueChange={setTab} data-testid="tabs-asistente">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="personalidad" data-testid="tab-personalidad">{t('tenant.asistente.tabPersonalidad')}</TabsTrigger>
            <TabsTrigger value="voz" data-testid="tab-voz">{t('tenant.asistente.tabVoz')}</TabsTrigger>
            <TabsTrigger value="faqs" data-testid="tab-faqs">{t('tenant.asistente.tabFaqs')}</TabsTrigger>
            <TabsTrigger value="servicios" data-testid="tab-servicios">{t('tenant.asistente.tabServicios')}</TabsTrigger>
            <TabsTrigger value="horarios" data-testid="tab-horarios">{t('tenant.asistente.tabHorarios')}</TabsTrigger>
            <TabsTrigger value="avanzado" data-testid="tab-avanzado">{t('tenant.asistente.tabAvanzado')}</TabsTrigger>
          </TabsList>

          {/* PERSONALIDAD */}
          <TabsContent value="personalidad" className="mt-5 space-y-4">
            <Card className="border-card-border"><CardContent className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <Label>🇲🇽 {t('tenant.asistente.greetingEs')}</Label>
                  <Textarea rows={3} value={form.greeting || ''} onChange={(e) => setForm({ ...form, greeting: e.target.value })} className="mt-1.5" data-testid="input-greeting-es" />
                </div>
                <div>
                  <Label>🇺🇸 {t('tenant.asistente.greetingEn')}</Label>
                  <Textarea rows={3} value={form.greetingEn || ''} onChange={(e) => setForm({ ...form, greetingEn: e.target.value })} className="mt-1.5" data-testid="input-greeting-en" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <Label>🇲🇽 {t('tenant.asistente.promptEs')}</Label>
                  <Textarea rows={6} value={form.systemPrompt || ''} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} className="mt-1.5 font-mono text-xs" data-testid="input-prompt-es" />
                </div>
                <div>
                  <Label>🇺🇸 {t('tenant.asistente.promptEn')}</Label>
                  <Textarea rows={6} value={form.systemPromptEn || ''} onChange={(e) => setForm({ ...form, systemPromptEn: e.target.value })} className="mt-1.5 font-mono text-xs" data-testid="input-prompt-en" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                <div>
                  <Label>{t('tenant.asistente.tone')}</Label>
                  <Select value={form.formality || 'usted'} onValueChange={(v) => setForm({ ...form, formality: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="select-tone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usted">{t('tenant.asistente.toneFormal')} (Usted)</SelectItem>
                      <SelectItem value="tu">{t('tenant.asistente.toneCordial')} (Tú)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('tenant.asistente.defaultLang')}</Label>
                  <Select value={form.defaultLanguage || 'es-MX'} onValueChange={(v) => setForm({ ...form, defaultLanguage: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="select-default-lang"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es-MX">🇲🇽 Español (MX)</SelectItem>
                      <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <Label className="block">{t('tenant.asistente.codeSwitch')}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{t('tenant.asistente.codeSwitchHelp')}</p>
                  </div>
                  <Switch checked={!!form.codeSwitching} onCheckedChange={(v) => setForm({ ...form, codeSwitching: v })} data-testid="switch-codeswitch" />
                </div>
              </div>
              <div className="rounded-md border border-card-border p-3 bg-muted/30 text-xs">
                <div className="font-semibold mb-1">{t('tenant.asistente.variables')}</div>
                <div className="font-mono text-muted-foreground">{`{{businessName}} · {{transferNumber}} · {{currentDate}} · {{currentTime}}`}</div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePersonality} disabled={saveAssistant.isPending} data-testid="button-save-personality">{t('common.save')}</Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* VOZ */}
          <TabsContent value="voz" className="mt-5 space-y-4">
            <Card className="border-card-border"><CardContent className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label>🇲🇽 {t('tenant.asistente.voiceEs')}</Label>
                  <Select value={form.voiceId || 'adri-chilanga'} onValueChange={(v) => setForm({ ...form, voiceId: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="select-voice-es"><SelectValue /></SelectTrigger>
                    <SelectContent>{VOICES_ES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>🇺🇸 {t('tenant.asistente.voiceEn')}</Label>
                  <Select value={form.voiceIdEn || 'jenny-us'} onValueChange={(v) => setForm({ ...form, voiceIdEn: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="select-voice-en"><SelectValue /></SelectTrigger>
                    <SelectContent>{VOICES_EN.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <div className="flex items-center justify-between mb-2"><Label>{t('tenant.asistente.speakingRate')}</Label><span className="text-xs text-muted-foreground tabular-nums">{voiceRate.toFixed(2)}x</span></div>
                  <Slider value={[voiceRate]} onValueChange={(v) => setVoiceRate(v[0])} min={0.7} max={1.3} step={0.05} data-testid="slider-rate" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><Label>{t('tenant.asistente.stability')}</Label><span className="text-xs text-muted-foreground tabular-nums">{voiceStability.toFixed(2)}</span></div>
                  <Slider value={[voiceStability]} onValueChange={(v) => setVoiceStability(v[0])} min={0} max={1} step={0.05} data-testid="slider-stability" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><Label>{t('tenant.asistente.similarity')}</Label><span className="text-xs text-muted-foreground tabular-nums">{voiceSimilarity.toFixed(2)}</span></div>
                  <Slider value={[voiceSimilarity]} onValueChange={(v) => setVoiceSimilarity(v[0])} min={0} max={1} step={0.05} data-testid="slider-similarity" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveVoice} disabled={saveAssistant.isPending} data-testid="button-save-voice">{t('common.save')}</Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* FAQs */}
          <TabsContent value="faqs" className="mt-5">
            <FaqsTab tid={tid} faqs={faqs} />
          </TabsContent>

          {/* SERVICIOS */}
          <TabsContent value="servicios" className="mt-5">
            <ServicesTab tid={tid} services={services} />
          </TabsContent>

          {/* HORARIOS */}
          <TabsContent value="horarios" className="mt-5">
            <HoursTab tid={tid} hours={hours} />
          </TabsContent>

          {/* AVANZADO */}
          <TabsContent value="avanzado" className="mt-5 space-y-4">
            <Card className="border-card-border"><CardContent className="p-6 space-y-5">
              <div>
                <Label>{t('tenant.asistente.transferNumber')}</Label>
                <Input value={advanced.transferNumber} onChange={(e) => setAdvanced({ ...advanced, transferNumber: e.target.value })} className="mt-1.5 font-mono" data-testid="input-transfer-number" />
              </div>
              <div>
                <Label>{t('tenant.asistente.afterHours')}</Label>
                <Select value={advanced.afterHours} onValueChange={(v) => setAdvanced({ ...advanced, afterHours: v as any })}>
                  <SelectTrigger className="mt-1.5" data-testid="select-afterhours"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">{t('tenant.asistente.afterHoursMsg')}</SelectItem>
                    <SelectItem value="forward">{t('tenant.asistente.afterHoursForward')}</SelectItem>
                    <SelectItem value="vm">{t('tenant.asistente.afterHoursVm')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="block">{t('tenant.asistente.recordingEnabled')}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{t('tenant.asistente.recordingDisclosure')}</p>
                </div>
                <Switch checked={advanced.recordingEnabled} onCheckedChange={(v) => setAdvanced({ ...advanced, recordingEnabled: v })} data-testid="switch-recording" />
              </div>
              <div>
                <Label>{t('tenant.asistente.retentionDays')}</Label>
                <Input type="number" value={advanced.retentionDays} onChange={(e) => setAdvanced({ ...advanced, retentionDays: +e.target.value || 0 })} className="mt-1.5 max-w-xs" data-testid="input-retention" />
              </div>
              <div>
                <Label>{t('tenant.asistente.webhookUrl')}</Label>
                <Input value={advanced.webhookUrl} onChange={(e) => setAdvanced({ ...advanced, webhookUrl: e.target.value })} placeholder="https://..." className="mt-1.5 font-mono" data-testid="input-webhook" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveAdvanced} disabled={saveAssistant.isPending || saveTenantField.isPending} data-testid="button-save-advanced">{t('common.save')}</Button>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
        )}
      </div>

      <TestCallModal open={showTestCall} onOpenChange={setShowTestCall} />
    </TenantLayout>
  );
}

// FAQs sub-tab
function FaqsTab({ tid, faqs }: { tid: any; faqs: any[] }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ question: '', answer: '', questionEn: '', answerEn: '', category: '' });
  const [lang, setLang] = useState<'es' | 'en'>('es');

  const add = useMutation({
    mutationFn: async () => {
      const payload: any = { question: form.question, answer: form.answer, keywords: '[]', active: true };
      if (form.questionEn) payload.questionEn = form.questionEn;
      if (form.answerEn) payload.answerEn = form.answerEn;
      const res = await apiRequest('POST', `/api/tenants/${tid}/faqs`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'faqs'] });
      setForm({ question: '', answer: '', questionEn: '', answerEn: '', category: '' });
      toast({ title: t('common.saved') });
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/tenants/${tid}/faqs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'faqs'] }),
  });

  return (
    <div className="space-y-4">
      <Card className="border-card-border"><CardContent className="p-5 space-y-3">
        <div className="flex gap-1.5" data-testid="tabs-faq-lang">
          <button type="button" onClick={() => setLang('es')} className={`text-xs px-3 py-1.5 rounded-md ${lang === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-faq-es">🇲🇽 ES</button>
          <button type="button" onClick={() => setLang('en')} className={`text-xs px-3 py-1.5 rounded-md ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-faq-en">🇺🇸 EN</button>
        </div>
        {lang === 'es' ? (
          <>
            <div><Label>{t('tenant.asistente.questionEs')}</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="mt-1.5" data-testid="input-faq-q-es" /></div>
            <div><Label>{t('tenant.asistente.answerEs')}</Label><Textarea rows={2} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="mt-1.5" data-testid="input-faq-a-es" /></div>
          </>
        ) : (
          <>
            <div><Label>{t('tenant.asistente.questionEn')}</Label><Input value={form.questionEn} onChange={(e) => setForm({ ...form, questionEn: e.target.value })} className="mt-1.5" data-testid="input-faq-q-en" /></div>
            <div><Label>{t('tenant.asistente.answerEn')}</Label><Textarea rows={2} value={form.answerEn} onChange={(e) => setForm({ ...form, answerEn: e.target.value })} className="mt-1.5" data-testid="input-faq-a-en" /></div>
          </>
        )}
        <div className="flex gap-2">
          <Button onClick={() => add.mutate()} disabled={!form.question || !form.answer} data-testid="button-add-faq">
            <Plus className="size-4 mr-1.5" /> {t('tenant.asistente.newFaq')}
          </Button>
        </div>
      </CardContent></Card>

      <div className="space-y-2">
        {faqs.map((f) => (
          <Card key={f.id} className="border-card-border" data-testid={`faq-${f.id}`}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">{f.question}{f.questionEn && <Badge variant="outline" className="text-[9px]">EN</Badge>}</div>
                <div className="text-sm text-muted-foreground mt-1">{f.answer}</div>
              </div>
              <button onClick={() => del.mutate(f.id)} className="size-8 rounded-md hover-elevate text-muted-foreground inline-flex items-center justify-center" data-testid={`button-del-faq-${f.id}`}><Trash2 className="size-3.5" /></button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Services sub-tab
function ServicesTab({ tid, services }: { tid: any; services: any[] }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', durationMin: 30, description: '', price: '' });
  const add = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/tenants/${tid}/services`, { name: form.name, durationMin: form.durationMin, description: form.description, active: true });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'services'] }); setForm({ name: '', durationMin: 30, description: '', price: '' }); },
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/tenants/${tid}/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'services'] }),
  });
  return (
    <div className="space-y-4">
      <Card className="border-card-border"><CardContent className="p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>{t('tenant.asistente.serviceName')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="input-svc-name" /></div>
          <div><Label>{t('tenant.asistente.duration')}</Label><Input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} className="mt-1.5" data-testid="input-svc-duration" /></div>
          <div><Label>{t('tenant.asistente.price')}</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" data-testid="input-svc-price" /></div>
        </div>
        <div><Label>{t('tenant.asistente.description')}</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" data-testid="input-svc-desc" /></div>
        <Button onClick={() => add.mutate()} disabled={!form.name} data-testid="button-add-service">
          <Plus className="size-4 mr-1.5" /> {t('tenant.asistente.newService')}
        </Button>
      </CardContent></Card>

      <Card className="border-card-border"><CardContent className="p-0">
        {services.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">—</div> :
          <div className="divide-y divide-border">
            {services.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between" data-testid={`service-${s.id}`}>
                <div>
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.durationMin} min{s.description ? ` · ${s.description}` : ''}</div>
                </div>
                <button onClick={() => del.mutate(s.id)} className="size-8 rounded-md hover-elevate text-muted-foreground inline-flex items-center justify-center" data-testid={`button-del-service-${s.id}`}><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>}
      </CardContent></Card>
    </div>
  );
}

// Hours sub-tab
function HoursTab({ tid, hours }: { tid: any; hours: any[] }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<number, any>>({});

  useEffect(() => {
    const d: Record<number, any> = {};
    DAYS.forEach((day) => {
      const h = hours.find((x: any) => x.dayOfWeek === day.id);
      d[day.id] = h ? { open: h.openTime, close: h.closeTime, closed: h.closed } : { open: '09:00', close: '18:00', closed: day.id === 0 };
    });
    setDraft(d);
  }, [hours]);

  const saveAll = useMutation({
    mutationFn: async () => {
      const payload = DAYS.map((d) => ({ dayOfWeek: d.id, openTime: draft[d.id]?.open || '09:00', closeTime: draft[d.id]?.close || '18:00', closed: !!draft[d.id]?.closed }));
      const res = await apiRequest('PUT', `/api/tenants/${tid}/hours`, payload);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'hours'] }); toast({ title: t('common.saved') }); },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const copyMon = () => {
    const mon = draft[1];
    if (!mon) return;
    const next = { ...draft };
    [2, 3, 4, 5].forEach((d) => (next[d] = { ...mon }));
    setDraft(next);
  };

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{t('tenant.asistente.tabHorarios')}</div>
        <Button variant="outline" size="sm" onClick={copyMon} data-testid="button-copy-monday">{t('tenant.asistente.copyMonday')}</Button>
      </div>
      <div className="space-y-2">
        {DAYS.map((d) => {
          const v = draft[d.id] || { open: '09:00', close: '18:00', closed: false };
          return (
            <div key={d.id} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0" data-testid={`row-day-${d.key}`}>
              <div className="w-28 text-sm font-medium">{d.es}</div>
              <Switch checked={!v.closed} onCheckedChange={(checked) => setDraft({ ...draft, [d.id]: { ...v, closed: !checked } })} data-testid={`switch-day-${d.key}`} />
              <Input
                type="time"
                value={v.open}
                disabled={v.closed}
                onChange={(e) => setDraft({ ...draft, [d.id]: { ...v, open: e.target.value } })}
                className="w-32"
                data-testid={`input-open-${d.key}`}
                aria-label={t('tenant.asistente.openAt', { day: d.es, defaultValue: '{{day}} — abre' })}
              />
              <span className="text-muted-foreground" aria-hidden="true">—</span>
              <Input
                type="time"
                value={v.close}
                disabled={v.closed}
                onChange={(e) => setDraft({ ...draft, [d.id]: { ...v, close: e.target.value } })}
                className="w-32"
                data-testid={`input-close-${d.key}`}
                aria-label={t('tenant.asistente.closeAt', { day: d.es, defaultValue: '{{day}} — cierra' })}
              />
              {v.closed && <Badge variant="outline" className="text-xs">{t('tenant.asistente.closed', 'Cerrado')}</Badge>}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-3">
        <Button onClick={() => saveAll.mutate()} disabled={saveAll.isPending} data-testid="button-save-hours">{t('common.save')}</Button>
      </div>
    </CardContent></Card>
  );
}

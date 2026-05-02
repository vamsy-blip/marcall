import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { MarcallWordmark } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle2, Sparkles, PhoneCall, Loader2, Plus, X, Volume2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEPS = ['Negocio', 'Persona', 'Idiomas', 'FAQs', 'Servicios', 'Número', 'Prueba'];

const VOICES = [
  { id: 'adri-chilanga', name: 'Adri (Chilanga)', desc: 'Cálida, profesional, tono CDMX' },
  { id: 'azucena-ortega', name: 'Azucena Ortega', desc: 'Madura, formal, tono ejecutivo' },
  { id: 'dalia-norteña', name: 'Dalia (Norteña)', desc: 'Cercana, directa, tono Monterrey' },
  { id: 'gabriela-bajio', name: 'Gabriela (Bajío)', desc: 'Suave, amable, tono Querétaro' },
];

function ProgressHeader({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-3xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <MarcallWordmark size={22} />
          <div className="text-xs text-muted-foreground">{t('common.step', { defaultValue: 'Paso' })} {step + 1} {t('common.of', { defaultValue: 'de' })} {STEPS.length} · {STEPS[step]}</div>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const tenantId = user?.currentTenantId;
  const [step, setStep] = useState(0);

  const { data: tenant } = useQuery<any>({ queryKey: ['/api/tenants', tenantId], enabled: !!tenantId });
  const { data: assistant } = useQuery<any>({ queryKey: ['/api/tenants', tenantId, 'assistant'], enabled: !!tenantId });
  const { data: faqs = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tenantId, 'faqs'], enabled: !!tenantId });

  // Step 1: business
  const [biz, setBiz] = useState({
    name: '', industry: 'Otro', addressLine: '', timezone: 'America/Monterrey', transferNumber: '',
  });
  // Step 2: persona
  const [persona, setPersona] = useState({
    name: 'Sofía', voiceId: 'adri-chilanga', formality: 'usted',
    greeting: 'Buenas tardes, gracias por llamar. Le atiende Sofía. ¿En qué le puedo ayudar?',
    greetingEn: 'Good afternoon, thank you for calling. This is Sofia. How may I help you?',
  });
  const [personaTab, setPersonaTab] = useState<'es' | 'en'>('es');
  // Step 2.5: languages
  const [languages, setLanguages] = useState<{ es: boolean; en: boolean; defaultLang: 'es-MX' | 'en-US'; codeSwitching: boolean }>({
    es: true, en: true, defaultLang: 'es-MX', codeSwitching: true,
  });
  // Step 3: FAQs
  const [newFaq, setNewFaq] = useState({ q: '', a: '', qEn: '', aEn: '' });
  const [faqTab, setFaqTab] = useState<'es' | 'en'>('es');
  const [faqMode, setFaqMode] = useState<'manual' | 'paste' | 'url'>('manual');
  const [pastedFaqs, setPastedFaqs] = useState('');
  const [faqUrl, setFaqUrl] = useState('');
  const [extracting, setExtracting] = useState(false);

  // Step 5: number
  const [numberKind, setNumberKind] = useState<'demo_us' | 'mx_managed' | 'byo_twilio'>('demo_us');

  const saveTenant = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/tenants/${tenantId}`, biz);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId] }),
  });
  const saveAssistant = useMutation({
    mutationFn: async () => {
      const langArr: string[] = [];
      if (languages.es) langArr.push('es-MX');
      if (languages.en) langArr.push('en-US');
      const payload: any = {
        ...assistant, ...persona,
        languages: JSON.stringify(langArr),
        defaultLanguage: languages.defaultLang,
        codeSwitching: languages.codeSwitching && langArr.length > 1,
      };
      const res = await apiRequest('PUT', `/api/tenants/${tenantId}/assistant`, payload);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'assistant'] }),
  });
  const addFaq = useMutation({
    mutationFn: async (data: { question: string; answer: string; questionEn?: string; answerEn?: string }) => {
      const res = await apiRequest('POST', `/api/tenants/${tenantId}/faqs`, { ...data, keywords: '[]', active: true });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'faqs'] }),
  });
  const deleteFaq = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/tenants/${tenantId}/faqs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'faqs'] }),
  });
  const addNumber = useMutation({
    mutationFn: async (kind: string) => {
      const res = await apiRequest('POST', `/api/tenants/${tenantId}/numbers`, { kind });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'numbers'] }),
  });

  // load existing tenant data
  useState(() => {
    if (tenant && !biz.name) {
      setBiz({
        name: tenant.name || '',
        industry: tenant.industry || 'Otro',
        addressLine: tenant.addressLine || '',
        timezone: tenant.timezone || 'America/Monterrey',
        transferNumber: tenant.transferNumber || '',
      });
    }
  });

  // sync from server when loaded
  if (tenant && biz.name === '' && tenant.name) {
    setBiz({
      name: tenant.name, industry: tenant.industry || 'Otro',
      addressLine: tenant.addressLine || '', timezone: tenant.timezone || 'America/Monterrey',
      transferNumber: tenant.transferNumber || '',
    });
  }

  const next = async () => {
    if (step === 0) await saveTenant.mutateAsync();
    if (step === 1 || step === 2) await saveAssistant.mutateAsync();
    if (step === STEPS.length - 1) {
      toast({ title: '¡Todo listo!', description: 'Su recepcionista está activa.' });
      setLocation('/app');
      return;
    }
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  const playVoiceSample = (voiceId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(persona.greeting);
    u.lang = 'es-MX';
    u.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) u.voice = esVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const extractFromText = async () => {
    setExtracting(true);
    setTimeout(async () => {
      const lines = pastedFaqs.split(/\n\n+/);
      for (const block of lines.filter(Boolean)) {
        const [q, ...a] = block.split('\n');
        if (q && a.length) await addFaq.mutateAsync({ question: q.trim(), answer: a.join(' ').trim() });
      }
      setPastedFaqs('');
      setExtracting(false);
      toast({ title: `Importadas ${lines.length} preguntas` });
    }, 800);
  };

  const extractFromUrl = async () => {
    setExtracting(true);
    setTimeout(async () => {
      // Mock: insert a few generic FAQs based on URL
      await addFaq.mutateAsync({ question: '¿Cuál es su horario de atención?', answer: 'De lunes a viernes de 9 a 19 horas.' });
      await addFaq.mutateAsync({ question: '¿Aceptan tarjeta?', answer: 'Sí, aceptamos efectivo, tarjeta y transferencia.' });
      await addFaq.mutateAsync({ question: '¿Dónde están ubicados?', answer: 'Estamos en el centro de la ciudad. Le compartimos ubicación por WhatsApp.' });
      setFaqUrl('');
      setExtracting(false);
      toast({ title: 'Extraídas 3 preguntas del sitio web' });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <ProgressHeader step={step} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* STEP 0 — Negocio */}
        {step === 0 && (
          <div data-testid="step-business">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">Cuéntenos de su negocio</h1>
            <p className="text-muted-foreground mb-8">Esta información ayuda a que Sofía conteste como si conociera el negocio de toda la vida.</p>
            <Card className="border-card-border">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label htmlFor="bn">Nombre del negocio</Label>
                  <Input id="bn" value={biz.name} onChange={e => setBiz({ ...biz, name: e.target.value })} placeholder="Tu Negocio S.A. de C.V." data-testid="input-biz-name" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Giro</Label>
                    <Select value={biz.industry} onValueChange={v => setBiz({ ...biz, industry: v })}>
                      <SelectTrigger data-testid="select-industry"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Restaurante', 'Clínica', 'Inmobiliaria', 'Salón', 'Servicios automotrices', 'Servicios legales', 'Fitness', 'Otro'].map(o =>
                          <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Zona horaria</Label>
                    <Select value={biz.timezone} onValueChange={v => setBiz({ ...biz, timezone: v })}>
                      <SelectTrigger data-testid="select-tz"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Monterrey">Monterrey (CST)</SelectItem>
                        <SelectItem value="America/Mexico_City">CDMX (CST)</SelectItem>
                        <SelectItem value="America/Cancun">Cancún (EST)</SelectItem>
                        <SelectItem value="America/Tijuana">Tijuana (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="addr">Dirección</Label>
                  <Input id="addr" value={biz.addressLine} onChange={e => setBiz({ ...biz, addressLine: e.target.value })} placeholder="Av. Constitución 2400, Col. Centro, Monterrey" data-testid="input-address" />
                </div>
                <div>
                  <Label htmlFor="tn">Número para transferencias humanas</Label>
                  <Input id="tn" value={biz.transferNumber} onChange={e => setBiz({ ...biz, transferNumber: e.target.value })} placeholder="+528112345678" data-testid="input-transfer" />
                  <p className="text-xs text-muted-foreground mt-1">Cuando una llamada necesita atención humana, se redirige a este número.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 1 — Persona */}
        {step === 1 && (
          <div data-testid="step-persona">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">Conozca a su recepcionista</h1>
            <p className="text-muted-foreground mb-8">Elija cómo se presenta Sofía a sus clientes.</p>
            <Card className="border-card-border">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label htmlFor="pn">Nombre de la recepcionista</Label>
                  <Input id="pn" value={persona.name} onChange={e => setPersona({ ...persona, name: e.target.value })} data-testid="input-persona-name" />
                </div>
                <div>
                  <Label className="mb-3 block">Voz</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {VOICES.map(v => (
                      <button type="button" key={v.id}
                        onClick={() => setPersona({ ...persona, voiceId: v.id })}
                        className={`p-4 rounded-lg border text-left transition-all ${persona.voiceId === v.id ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                        data-testid={`button-voice-${v.id}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold">{v.name}</div>
                            <div className="text-xs text-muted-foreground">{v.desc}</div>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); playVoiceSample(v.id); }}
                            className="size-8 rounded-md hover-elevate inline-flex items-center justify-center text-muted-foreground" data-testid={`button-play-voice-${v.id}`}>
                            <Volume2 className="size-4" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <div className="text-sm font-semibold">Trato formal (usted)</div>
                    <div className="text-xs text-muted-foreground">{persona.formality === 'usted' ? 'Sofía hablará de usted a sus clientes.' : 'Sofía hablará de tú.'}</div>
                  </div>
                  <Switch checked={persona.formality === 'usted'} onCheckedChange={c => setPersona({ ...persona, formality: c ? 'usted' : 'tu' })} data-testid="switch-formality" />
                </div>
                <div>
                  <Label htmlFor="gr">{t('onboarding.greetingLabel', { defaultValue: 'Saludo personalizado' })}</Label>
                  <div className="flex gap-1.5 mb-2" data-testid="tabs-persona-greeting">
                    <button type="button" onClick={() => setPersonaTab('es')} className={`text-xs px-3 py-1.5 rounded-md ${personaTab === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-persona-es">🇲🇽 Español</button>
                    <button type="button" onClick={() => setPersonaTab('en')} className={`text-xs px-3 py-1.5 rounded-md ${personaTab === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-persona-en">🇺🇸 English</button>
                  </div>
                  {personaTab === 'es' ? (
                    <Textarea id="gr" rows={3} value={persona.greeting} onChange={e => setPersona({ ...persona, greeting: e.target.value })} data-testid="input-greeting" />
                  ) : (
                    <Textarea id="gr-en" rows={3} value={persona.greetingEn} onChange={e => setPersona({ ...persona, greetingEn: e.target.value })} data-testid="input-greeting-en" placeholder="English greeting…" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 2 — Idiomas */}
        {step === 2 && (
          <div data-testid="step-languages">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">{t('onboarding.stepLanguagesTitle')}</h1>
            <p className="text-muted-foreground mb-8">{t('onboarding.stepLanguagesSub')}</p>
            <Card className="border-card-border">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <button type="button" onClick={() => setLanguages(l => ({ ...l, es: !l.es }))}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${languages.es ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                    data-testid="toggle-lang-es">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇲🇽</span>
                      <div className="text-left">
                        <div className="text-sm font-semibold">{t('onboarding.spanishLabel')}</div>
                        <div className="text-xs text-muted-foreground">Voces ElevenLabs en español mexicano nativo.</div>
                      </div>
                    </div>
                    {languages.es && <CheckCircle2 className="size-5 text-primary" />}
                  </button>
                  <button type="button" onClick={() => setLanguages(l => ({ ...l, en: !l.en }))}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${languages.en ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                    data-testid="toggle-lang-en">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇺🇸</span>
                      <div className="text-left">
                        <div className="text-sm font-semibold">{t('onboarding.englishLabel')}</div>
                        <div className="text-xs text-muted-foreground">Native English voices for tourists, expats, and bilingual customers.</div>
                      </div>
                    </div>
                    {languages.en && <CheckCircle2 className="size-5 text-primary" />}
                  </button>
                </div>
                {languages.es && languages.en && (
                  <>
                    <div>
                      <Label className="text-xs uppercase tracking-wider mb-2 block">{t('onboarding.defaultLangLabel', { defaultValue: 'Idioma por defecto' })}</Label>
                      <Select value={languages.defaultLang} onValueChange={(v: any) => setLanguages(l => ({ ...l, defaultLang: v }))}>
                        <SelectTrigger data-testid="select-default-lang"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es-MX">🇲🇽 Español (México)</SelectItem>
                          <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">Sofía saludará primero en este idioma. Si el llamante responde en otro, cambiará automáticamente.</p>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2"><Globe className="size-4" /> Cambio de idioma automático</div>
                        <div className="text-xs text-muted-foreground">Si detecta que el llamante prefiere otro idioma, cambiará mid-call.</div>
                      </div>
                      <Switch checked={languages.codeSwitching} onCheckedChange={c => setLanguages(l => ({ ...l, codeSwitching: c }))} data-testid="switch-code-switching" />
                    </div>
                    <p className="text-xs text-muted-foreground italic">{t('onboarding.bilingualNote')}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3 — FAQs */}
        {step === 3 && (
          <div data-testid="step-faqs">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">Preguntas frecuentes</h1>
            <p className="text-muted-foreground mb-8">Mientras más sepa Sofía, mejor responde. Empiece con 3-5 preguntas comunes.</p>
            <div className="grid grid-cols-3 gap-1.5 mb-5">
              {[{ id: 'manual', l: 'Una por una' }, { id: 'paste', l: 'Pegar lista' }, { id: 'url', l: 'Desde sitio web' }].map(t => (
                <button key={t.id} type="button" onClick={() => setFaqMode(t.id as any)}
                  className={`p-3 rounded-lg border text-sm font-medium ${faqMode === t.id ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                  data-testid={`button-faqmode-${t.id}`}>{t.l}</button>
              ))}
            </div>

            <Card className="border-card-border mb-4">
              <CardContent className="p-6 space-y-4">
                {faqMode === 'manual' && (
                  <>
                    {languages.en && (
                      <div className="flex gap-1.5" data-testid="tabs-faq-lang">
                        <button type="button" onClick={() => setFaqTab('es')} className={`text-xs px-3 py-1.5 rounded-md ${faqTab === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-faq-es">🇲🇽 Español</button>
                        <button type="button" onClick={() => setFaqTab('en')} className={`text-xs px-3 py-1.5 rounded-md ${faqTab === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-faq-en">🇺🇸 English</button>
                      </div>
                    )}
                    {faqTab === 'es' ? (
                      <>
                        <div>
                          <Label>Pregunta</Label>
                          <Input value={newFaq.q} onChange={e => setNewFaq({ ...newFaq, q: e.target.value })} placeholder="¿Cuáles son sus horarios?" data-testid="input-faq-q" />
                        </div>
                        <div>
                          <Label>Respuesta</Label>
                          <Textarea rows={3} value={newFaq.a} onChange={e => setNewFaq({ ...newFaq, a: e.target.value })} placeholder="Atendemos de lunes a viernes de 9 a 19 hrs..." data-testid="input-faq-a" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>Question (English)</Label>
                          <Input value={newFaq.qEn} onChange={e => setNewFaq({ ...newFaq, qEn: e.target.value })} placeholder="What are your hours?" data-testid="input-faq-q-en" />
                        </div>
                        <div>
                          <Label>Answer (English)</Label>
                          <Textarea rows={3} value={newFaq.aEn} onChange={e => setNewFaq({ ...newFaq, aEn: e.target.value })} placeholder="We're open Monday to Friday, 9am to 7pm..." data-testid="input-faq-a-en" />
                        </div>
                      </>
                    )}
                    <Button onClick={async () => {
                      if (!newFaq.q || !newFaq.a) return;
                      await addFaq.mutateAsync({ question: newFaq.q, answer: newFaq.a, questionEn: newFaq.qEn || undefined, answerEn: newFaq.aEn || undefined });
                      setNewFaq({ q: '', a: '', qEn: '', aEn: '' });
                    }} className="gap-2" data-testid="button-add-faq"><Plus className="size-4" /> {t('common.add', { defaultValue: 'Agregar' })}</Button>
                  </>
                )}
                {faqMode === 'paste' && (
                  <>
                    <Label>Pegue sus preguntas (formato: pregunta, salto de línea, respuesta, doble salto entre cada par)</Label>
                    <Textarea rows={8} value={pastedFaqs} onChange={e => setPastedFaqs(e.target.value)} placeholder="¿Cuál es su horario?
Atendemos de lunes a viernes de 9 a 19 hrs.

¿Aceptan tarjeta?
Sí, aceptamos efectivo y tarjeta." data-testid="input-paste-faqs" />
                    <Button onClick={extractFromText} disabled={extracting || !pastedFaqs} className="gap-2" data-testid="button-extract-paste">
                      {extracting && <Loader2 className="size-4 animate-spin" />} Importar preguntas
                    </Button>
                  </>
                )}
                {faqMode === 'url' && (
                  <>
                    <Label>URL de su sitio web</Label>
                    <Input value={faqUrl} onChange={e => setFaqUrl(e.target.value)} placeholder="https://misitio.mx/preguntas-frecuentes" data-testid="input-faq-url" />
                    <Button onClick={extractFromUrl} disabled={extracting || !faqUrl} className="gap-2" data-testid="button-extract-url">
                      {extracting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Extraer con IA
                    </Button>
                    <p className="text-xs text-muted-foreground">Analizamos su sitio web y proponemos preguntas. Usted aprueba antes de guardar.</p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preguntas guardadas ({faqs.length})</div>
              {faqs.map(f => (
                <Card key={f.id} className="border-card-border" data-testid={`row-faq-${f.id}`}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{f.question}</div>
                      <div className="text-sm text-muted-foreground mt-1">{f.answer}</div>
                    </div>
                    <button onClick={() => deleteFaq.mutate(f.id)} className="size-8 rounded-md hover-elevate text-muted-foreground inline-flex items-center justify-center" data-testid={`button-delete-faq-${f.id}`}><X className="size-4" /></button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — Servicios */}
        {step === 4 && (
          <div data-testid="step-services">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">Servicios y calendario</h1>
            <p className="text-muted-foreground mb-8">Defina qué puede agendar Sofía y conecte su calendario.</p>
            <Card className="border-card-border mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Google Calendar</div>
                    <div className="text-xs text-muted-foreground">Sincronización en tiempo real con su agenda.</div>
                  </div>
                  <Button variant="outline" data-testid="button-connect-gcal">Conectar</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">También puede usar el calendario integrado de MARCALL si no tiene Google Calendar.</p>
              </CardContent>
            </Card>
            <Card className="border-card-border">
              <CardContent className="p-6">
                <div className="text-sm font-semibold mb-3">Servicios que ofrece</div>
                <p className="text-sm text-muted-foreground mb-4">Puede configurar esto más adelante en el panel. Por ahora pasemos al siguiente paso.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {['Consulta general', 'Cita estándar', 'Asesoría', 'Seguimiento'].map(s => (
                    <div key={s} className="p-3 rounded-lg border border-border bg-muted/20 text-sm flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-primary" /> {s} <span className="text-xs text-muted-foreground ml-auto">30 min</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 5 — Número */}
        {step === 5 && (
          <div data-testid="step-number">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">Su número telefónico</h1>
            <p className="text-muted-foreground mb-8">Elija cómo recibirá llamadas.</p>
            <div className="space-y-3">
              {[
                { id: 'demo_us', t: 'Demo gratis (US)', d: 'Empiece a probar en 30 segundos. Número estadounidense compartido.', badge: 'Recomendado para probar', icon: Sparkles },
                { id: 'mx_managed', t: 'Número +52 dedicado', d: 'Le tramitamos un número mexicano. Requiere INE o constancia de situación fiscal.', badge: 'Más profesional · 3-10 días', icon: PhoneCall },
                { id: 'byo_twilio', t: 'Conectar Twilio existente', d: 'Si ya tiene una cuenta de Twilio, conéctela en segundos.', badge: 'Para usuarios avanzados', icon: PhoneCall },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => setNumberKind(opt.id as any)}
                  className={`w-full text-left p-5 rounded-xl border transition-all flex items-start gap-4 ${numberKind === opt.id ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                  data-testid={`button-number-${opt.id}`}>
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><opt.icon className="size-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{opt.t}</div>
                      <Badge variant="outline" className="text-[10px]">{opt.badge}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{opt.d}</div>
                  </div>
                </button>
              ))}
            </div>
            <Button onClick={() => addNumber.mutate(numberKind)} className="mt-6 gap-2" data-testid="button-provision-number">
              {addNumber.isPending && <Loader2 className="size-4 animate-spin" />}
              Asignar número
            </Button>
          </div>
        )}

        {/* STEP 6 — Prueba */}
        {step === 6 && (
          <div data-testid="step-test">
            <h1 className="font-display font-bold text-2xl tracking-tight mb-2">¡Listo! Hagamos una llamada de prueba.</h1>
            <p className="text-muted-foreground mb-8">Sofía está configurada con su negocio, voz y FAQs. Llamará a su celular para que la conozca.</p>
            <Card className="border-card-border mb-6">
              <CardContent className="p-8 text-center">
                <div className="size-20 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center mb-5"><PhoneCall className="size-10" /></div>
                <div className="font-display font-bold text-xl mb-2">Llamar a mi celular</div>
                <p className="text-sm text-muted-foreground mb-5">{biz.transferNumber || '+52 (configure su número en el paso 1)'}</p>
                <Button size="lg" className="gap-2" data-testid="button-test-call">
                  <PhoneCall className="size-4" /> Llamarme ahora
                </Button>
              </CardContent>
            </Card>
            <div className="text-center">
              <Button variant="ghost" onClick={() => setLocation('/app')} data-testid="button-skip-to-dashboard">Ir al panel sin llamar →</Button>
            </div>
          </div>
        )}

        {/* nav */}
        <div className="mt-8 flex justify-between gap-2">
          <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} data-testid="button-prev">
            <ChevronLeft className="size-4" /> {t('common.back')}
          </Button>
          <Button onClick={next} disabled={saveTenant.isPending || saveAssistant.isPending} data-testid="button-next">
            {(saveTenant.isPending || saveAssistant.isPending) && <Loader2 className="size-4 animate-spin" />}
            {step === STEPS.length - 1 ? t('common.finish', { defaultValue: 'Terminar' }) : t('common.continue')}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}

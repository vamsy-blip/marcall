import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

export function Citas() {
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: appts = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'appointments'], enabled: !!tid });
  return (
    <TenantLayout title="Citas">
      <div className="max-w-5xl">
        <h1 className="font-display font-bold text-xl tracking-tight mb-6">Próximas citas</h1>
        <Card className="border-card-border"><CardContent className="p-0">
          {appts.length === 0 ? <div className="p-16 text-center text-muted-foreground">Sin citas agendadas.</div> :
            <div className="divide-y divide-border">
              {appts.map((a: any) => (
                <div key={a.id} className="px-5 py-4 flex items-center justify-between" data-testid={`appt-${a.id}`}>
                  <div>
                    <div className="font-semibold text-sm">{a.callerName}</div>
                    <div className="text-xs text-muted-foreground">{a.callerPhone} · {format(new Date(a.startTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}</div>
                    {a.notes && <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>}
                  </div>
                  <Badge variant="outline" className="capitalize">{a.status}</Badge>
                </div>
              ))}
            </div>}
        </CardContent></Card>
      </div>
    </TenantLayout>
  );
}

export function Recados() {
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: msgs = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'messages'], enabled: !!tid });
  const URG: Record<string, string> = { urgent: 'destructive', high: 'destructive', normal: 'secondary', low: 'outline' };
  return (
    <TenantLayout title="Recados">
      <div className="max-w-5xl">
        <h1 className="font-display font-bold text-xl tracking-tight mb-6">Bandeja de recados</h1>
        <div className="space-y-3">
          {msgs.length === 0 ? <Card className="border-card-border"><CardContent className="p-16 text-center text-muted-foreground">Sin recados.</CardContent></Card> :
            msgs.map((m: any) => (
              <Card key={m.id} className="border-card-border" data-testid={`msg-${m.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{m.callerName} · <span className="font-mono text-muted-foreground font-normal">{m.callerPhone}</span></div>
                    <Badge variant={URG[m.urgency] as any}>{m.urgency}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{m.subject}</div>
                  <div className="text-sm">{m.body}</div>
                  <div className="text-xs text-muted-foreground mt-2">{m.createdAt ? format(new Date(m.createdAt), "d MMM, HH:mm", { locale: es }) : ''}</div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </TenantLayout>
  );
}

export function Leads() {
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: leads = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'leads'], enabled: !!tid });
  return (
    <TenantLayout title="Leads">
      <div className="max-w-6xl">
        <h1 className="font-display font-bold text-xl tracking-tight mb-6">Leads</h1>
        <Card className="border-card-border"><CardContent className="p-0">
          {leads.length === 0 ? <div className="p-16 text-center text-muted-foreground">Aún no hay leads.</div> :
            <div className="divide-y divide-border">
              {leads.map((l: any) => (
                <div key={l.id} className="px-5 py-4" data-testid={`lead-${l.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{l.name || 'Sin nombre'} <span className="text-muted-foreground text-sm font-normal">· {l.company || '—'}</span></div>
                    <Badge variant={l.qualificationScore > 60 ? 'default' : 'outline'} className="tabular-nums">{l.qualificationScore}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{l.phone || l.email || '—'} · {l.interest}</div>
                  {l.transcriptExcerpt && <div className="text-sm text-muted-foreground mt-2 italic">"{l.transcriptExcerpt}"</div>}
                </div>
              ))}
            </div>}
        </CardContent></Card>
      </div>
    </TenantLayout>
  );
}

export function FAQs() {
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: faqs = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'faqs'], enabled: !!tid });
  const [form, setForm] = useState({ question: '', answer: '', questionEn: '', answerEn: '' });
  const [tab, setTab] = useState<'es' | 'en'>('es');
  const add = useMutation({
    mutationFn: async () => {
      const payload: any = { question: form.question, answer: form.answer, keywords: '[]', active: true };
      if (form.questionEn) payload.questionEn = form.questionEn;
      if (form.answerEn) payload.answerEn = form.answerEn;
      const res = await apiRequest('POST', `/api/tenants/${tid}/faqs`, payload);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'faqs'] }); setForm({ question: '', answer: '', questionEn: '', answerEn: '' }); },
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/tenants/${tid}/faqs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'faqs'] }),
  });
  return (
    <TenantLayout title="FAQs">
      <div className="max-w-4xl">
        <h1 className="font-display font-bold text-xl tracking-tight mb-6">Preguntas frecuentes</h1>
        <Card className="border-card-border mb-6">
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-1.5" data-testid="tabs-faq-lang">
              <button type="button" onClick={() => setTab('es')} className={`text-xs px-3 py-1.5 rounded-md ${tab === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-es">🇲🇽 Español</button>
              <button type="button" onClick={() => setTab('en')} className={`text-xs px-3 py-1.5 rounded-md ${tab === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover-elevate'}`} data-testid="tab-en">🇺🇸 English</button>
            </div>
            {tab === 'es' ? (
              <>
                <div><Label>Pregunta</Label><Input value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} data-testid="input-q" /></div>
                <div><Label>Respuesta</Label><Textarea rows={2} value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} data-testid="input-a" /></div>
              </>
            ) : (
              <>
                <div><Label>Question (English)</Label><Input value={form.questionEn} onChange={e => setForm({ ...form, questionEn: e.target.value })} data-testid="input-q-en" /></div>
                <div><Label>Answer (English)</Label><Textarea rows={2} value={form.answerEn} onChange={e => setForm({ ...form, answerEn: e.target.value })} data-testid="input-a-en" /></div>
              </>
            )}
            <Button onClick={() => add.mutate()} disabled={!form.question || !form.answer} className="gap-2" data-testid="button-add"><Plus className="size-4" /> Agregar</Button>
            <p className="text-xs text-muted-foreground">Recomendado: agregar la versión en inglés para mejor cobertura bilingüe.</p>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {faqs.map((f: any) => (
            <Card key={f.id} className="border-card-border" data-testid={`faq-${f.id}`}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm flex items-center gap-2">{f.question} {f.questionEn && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">EN</span>}</div>
                  <div className="text-sm text-muted-foreground mt-1">{f.answer}</div>
                  {f.questionEn && <div className="mt-2 pt-2 border-t border-border/50"><div className="text-xs font-semibold text-muted-foreground">🇺🇸 {f.questionEn}</div><div className="text-xs text-muted-foreground mt-0.5">{f.answerEn}</div></div>}
                </div>
                <button onClick={() => del.mutate(f.id)} className="size-8 rounded-md hover-elevate text-muted-foreground inline-flex items-center justify-center" data-testid={`button-del-${f.id}`}><X className="size-4" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TenantLayout>
  );
}

export function Configuracion() {
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: tenant } = useQuery<any>({ queryKey: ['/api/tenants', tid], enabled: !!tid });
  const { data: assistant } = useQuery<any>({ queryKey: ['/api/tenants', tid, 'assistant'], enabled: !!tid });
  const { data: numbers = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'numbers'], enabled: !!tid });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ['/api/plans'] });
  const { data: usage } = useQuery<any>({ queryKey: ['/api/tenants', tid, 'usage'], enabled: !!tid });

  const upgrade = useMutation({
    mutationFn: async (planSlug: string) => {
      const res = await apiRequest('POST', '/api/checkout/create', { planSlug, email: user?.email, name: user?.name });
      return res.json();
    },
    onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
  });

  const currentPlan = plans.find((p: any) => p.id === tenant?.planId);

  return (
    <TenantLayout title="Configuración">
      <div className="max-w-4xl space-y-6">
        <h1 className="font-display font-bold text-xl tracking-tight">Configuración</h1>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-1">Negocio</div>
            <div className="text-xs text-muted-foreground mb-4">{tenant?.name} · {tenant?.industry}</div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Zona horaria</div><div>{tenant?.timezone}</div></div>
              <div><div className="text-xs text-muted-foreground">Transferencia humana</div><div className="font-mono">{tenant?.transferNumber || '—'}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-1">Asistente</div>
            <div className="text-xs text-muted-foreground mb-4">{assistant?.name} · {assistant?.voiceId} · {assistant?.formality}</div>
            <Textarea readOnly rows={4} value={assistant?.systemPrompt || ''} className="font-mono text-xs" />
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-3">Números telefónicos</div>
            {numbers.length === 0 ? <div className="text-sm text-muted-foreground">Sin números asignados.</div> :
              numbers.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between py-2 border-t border-border first:border-t-0">
                  <div className="font-mono text-sm">{n.e164}</div>
                  <Badge variant="outline" className="capitalize">{n.kind.replace('_', ' ')} · {n.kycStatus}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-1">Plan y facturación</div>
            <div className="text-xs text-muted-foreground mb-4">Plan actual: <span className="font-semibold">{currentPlan?.name}</span></div>
            <div className="text-2xl font-display font-bold tabular-nums">{usage?.minutesUsed || 0} <span className="text-base text-muted-foreground font-normal">/ {usage?.minutesIncluded || 0} min</span></div>
            <div className="grid sm:grid-cols-4 gap-2 mt-5">
              {plans.map((p: any) => (
                <Button key={p.slug} variant={p.id === tenant?.planId ? 'default' : 'outline'} size="sm" onClick={() => p.id !== tenant?.planId && upgrade.mutate(p.slug)} data-testid={`button-plan-${p.slug}`}>
                  {p.name} · ${(p.priceMxnCents / 100).toLocaleString('es-MX')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}

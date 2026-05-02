import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, ArrowRight, MessageCircle } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: number;
  slug: string;
  name: string;
  priceMxnCents: number;
  includedMinutes: number;
  maxNumbers: number;
  overagePerMinMxnCents: number;
  features: string[];
}

function ContactSalesModal({
  open, onOpenChange, defaultPlan,
}: { open: boolean; onOpenChange: (v: boolean) => void; defaultPlan?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', businessName: '', plan: defaultPlan || '', message: '' });

  useEffect(() => {
    if (defaultPlan) setForm(f => ({ ...f, plan: defaultPlan }));
  }, [defaultPlan]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contact-sales', { ...form, source: 'pricing_page' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'send_failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('contactSales.successTitle'), description: t('contactSales.successBody') });
      onOpenChange(false);
      setForm({ name: '', email: '', phone: '', businessName: '', plan: defaultPlan || '', message: '' });
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('contactSales.errorBody') as string, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-contact-sales">
        <DialogHeader>
          <DialogTitle className="font-display">{t('contactSales.title')}</DialogTitle>
          <DialogDescription>{t('contactSales.subtitle')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        >
          <div>
            <Label htmlFor="cs-name">{t('contactSales.name')}*</Label>
            <Input id="cs-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-cs-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cs-email">{t('contactSales.email')}*</Label>
              <Input id="cs-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-cs-email" />
            </div>
            <div>
              <Label htmlFor="cs-phone">{t('contactSales.phone')}</Label>
              <Input id="cs-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-cs-phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cs-biz">{t('contactSales.businessName')}</Label>
              <Input id="cs-biz" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} data-testid="input-cs-biz" />
            </div>
            <div>
              <Label htmlFor="cs-plan">{t('contactSales.plan')}</Label>
              <Input id="cs-plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} data-testid="input-cs-plan" />
            </div>
          </div>
          <div>
            <Label htmlFor="cs-msg">{t('contactSales.message')}</Label>
            <Textarea id="cs-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="input-cs-message" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-cs-submit">
              {mutation.isPending ? t('contactSales.submitting') : t('contactSales.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Pricing() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ['/api/plans'] });
  const [contactOpen, setContactOpen] = useState(false);
  const [contactPlan, setContactPlan] = useState<string | undefined>();

  useEffect(() => {
    document.title = lang === 'en' ? 'MARCALL pricing \u2014 plans from MX$799/month' : 'Precios MARCALL \u2014 desde MX$799/mes';
    document.documentElement.lang = lang;
  }, [lang]);

  const formatMxn = (cents: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
    }).format(cents / 100);

  const openContact = (plan?: string) => {
    setContactPlan(plan);
    setContactOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground marcall-grain">
      <MarketingNav />

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <h1 className="font-display font-semibold leading-tight tracking-tight text-[clamp(2.25rem,5vw,3.5rem)]" data-testid="text-pricing-page-title">
            {t('marketing.pricingH')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{t('marketing.pricingSub')}</p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p) => {
              const popular = p.slug === 'crece';
              const isEnterprise = p.slug === 'empresa' || p.slug === 'agencia';
              return (
                <Card key={p.id} className={`relative border-2 ${popular ? 'border-primary shadow-xl' : ''}`} data-testid={`card-plan-${p.slug}`}>
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest rounded-full font-semibold">
                      {t('marketing.mostPopular')}
                    </div>
                  )}
                  <CardContent className="p-6 space-y-5 flex flex-col h-full">
                    <div>
                      <Badge variant="outline" className="mb-2 capitalize text-[10px]">{p.slug}</Badge>
                      <h3 className="font-display font-semibold text-lg">{p.name}</h3>
                    </div>
                    <div>
                      <span className="font-display text-3xl font-semibold">{formatMxn(p.priceMxnCents)}</span>
                      <span className="text-sm text-muted-foreground ml-1">{t('marketing.perMonth')}</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.minutesIncluded', { count: p.includedMinutes })}</li>
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.numbersInc', { count: p.maxNumbers })}</li>
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.extraMin', { rate: (p.overagePerMinMxnCents / 100).toFixed(2) })}</li>
                      {(p.features || []).slice(0, 4).map((f, i) => {
                        // Features may be stored as translation keys (preferred,
                        // e.g. "voice_azure_standard") or as legacy literal
                        // strings. We try the translation first; if the key is
                        // missing, react-i18next returns the key unchanged —
                        // detect that and fall back to the raw string so older
                        // seeds keep working without a migration.
                        const tKey = `marketing.planFeatures.${f}`;
                        const translated = t(tKey);
                        const label = translated === tKey ? f : translated;
                        return (
                          <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {label}</li>
                        );
                      })}
                    </ul>
                    <div className="space-y-2 pt-2">
                      <Link href={`/signup?plan=${p.slug}`} data-testid={`link-choose-${p.slug}`}>
                        <Button variant={popular ? 'default' : 'outline'} className="w-full">
                          {t('marketing.choosePlan', { plan: p.name })}
                        </Button>
                      </Link>
                      {isEnterprise && (
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => openContact(p.slug)}
                          data-testid={`button-contact-sales-${p.slug}`}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          {t('contactSales.buttonOpen')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {plans.length === 0 && (
            <div className="text-center text-muted-foreground py-12" data-testid="empty-plans">
              {t('common.loading')}
            </div>
          )}
        </div>
      </section>

      {/* Trust band */}
      <section className="border-t bg-muted/30 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === 'en'
              ? '7-day free trial. No card required. Cancel anytime. CFDI billing coming soon via Facturapi.'
              : 'Prueba gratis 7 d\u00edas. Sin tarjeta. Cancela cuando quieras. Factura CFDI pr\u00f3ximamente v\u00eda Facturapi.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/signup" data-testid="link-pricing-cta">
              <Button size="lg">{t('marketing.heroCtaPrimary')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
            <Button size="lg" variant="outline" onClick={() => openContact()} data-testid="button-pricing-contact-sales">
              {t('contactSales.buttonOpen')}
            </Button>
          </div>
        </div>
      </section>

      <ContactSalesModal open={contactOpen} onOpenChange={setContactOpen} defaultPlan={contactPlan} />

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

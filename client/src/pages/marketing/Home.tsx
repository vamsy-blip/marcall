import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, PhoneCall, Calendar, MessageSquare, Users, Target, ArrowRight, Sparkles, Globe, Headphones, Languages } from 'lucide-react';
import { MarcallLogo } from '@/components/Brand';
import { MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLang } from '@/components/LanguageProvider';
import heroImg from '@/assets/hero-receptionist.png';
import wavesImg from '@/assets/hero-soundwaves.png';
import ownerImg from '@/assets/hero-business-owner.png';

// Bilingual demo transcripts ─────────────────────────────────────────────
const DEMO_ES = [
  { role: 'caller', text: 'Buenas, ¿tienen cita disponible para mañana?' },
  { role: 'sofia', text: 'Buenas tardes, gracias por llamar a Clínica Norte. Tengo mañana a las 4:00 PM o 5:30 PM, ¿cuál le acomoda?' },
  { role: 'caller', text: 'A las 5:30 PM, perfecto. Soy Roberto Silva.' },
  { role: 'sofia', text: 'Listo Sr. Silva. Le confirmo: mañana 5:30 PM, consulta general. Le envío recordatorio por WhatsApp.' },
];
const DEMO_EN = [
  { role: 'caller', text: 'Hi, do you have any appointments available tomorrow?' },
  { role: 'sofia', text: 'Good afternoon, thank you for calling Clínica Norte. I have tomorrow at 4:00 PM or 5:30 PM. Which works better?' },
  { role: 'caller', text: '5:30 PM, perfect. My name is Robert Silva.' },
  { role: 'sofia', text: 'Got it, Mr. Silva. Confirmed: tomorrow 5:30 PM, general consultation. I\'ll send you a WhatsApp reminder.' },
];

function CallSimulator({ lang }: { lang: 'es' | 'en' }) {
  const [step, setStep] = useState(0);
  const transcript = lang === 'en' ? DEMO_EN : DEMO_ES;

  useEffect(() => {
    setStep(0);
    const timer = setInterval(() => {
      setStep((s) => (s + 1 > transcript.length ? 0 : s + 1));
    }, 2400);
    return () => clearInterval(timer);
  }, [lang]);

  const liveLabel = lang === 'en' ? 'DEMO' : 'DEMO';

  return (
    <Card className="bg-card/80 backdrop-blur border-2 shadow-2xl overflow-hidden" data-testid="card-call-simulator">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-medium">{liveLabel}</span>
          </div>
        </div>
        <div className="p-5 space-y-3 min-h-[260px]">
          {transcript.slice(0, step).map((line, i) => (
            <div
              key={i}
              className={`flex gap-2 animate-in slide-in-from-bottom-2 duration-500 ${line.role === 'sofia' ? 'flex-row-reverse text-right' : ''}`}
              data-testid={`transcript-line-${i}`}
            >
              <div className={`max-w-[80%] px-3.5 py-2 text-sm leading-relaxed ${line.role === 'sofia' ? 'bg-card text-foreground border-l-2 border-primary pl-4 rounded-r-md' : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'}`}>
                {line.text}
              </div>
            </div>
          ))}
          {step < transcript.length && step > 0 && (
            <div className="flex gap-1 px-3.5 text-muted-foreground" aria-label="typing">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ['/api/plans'] });
  const [demoLang, setDemoLang] = useState<'es' | 'en'>(lang);

  // Sync demo language with UI language by default; user can override
  useEffect(() => { setDemoLang(lang); }, [lang]);

  // Update document title/lang/meta on language change
  useEffect(() => {
    const titles: Record<string, string> = {
      es: 'MARCALL — Recepcionista IA bilingüe para México',
      en: 'MARCALL — Bilingual AI receptionist for Mexico',
    };
    const descs: Record<string, string> = {
      es: 'Recepcionista IA en español mexicano e inglés. Atiende cada llamada 24/7, agenda citas, toma recados y califica leads.',
      en: 'AI receptionist in Mexican Spanish and English. Answers every call 24/7, books appointments, takes messages, qualifies leads.',
    };
    document.title = titles[lang];
    document.documentElement.lang = lang;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', descs[lang]);
    // hreflang alternates
    document.querySelectorAll('link[rel="alternate"][data-marcall-hreflang]').forEach((el) => el.remove());
    [['es-MX', 'es'], ['en', 'en']].forEach(([hl]) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.setAttribute('hreflang', hl);
      link.href = window.location.href;
      link.setAttribute('data-marcall-hreflang', '1');
      document.head.appendChild(link);
    });
  }, [lang]);

  const formatMxn = (cents: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const planCopy: Record<string, { tag?: string }> = {
    crece: { tag: t('marketing.mostPopular') },
  };

  const faqs = (t('marketing.faqs', { returnObjects: true }) as { q: string; a: string }[]) || [];

  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background marcall-grain text-foreground">
      {/* ───── NAV ───── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" data-testid="link-nav-home" className="flex items-center gap-2">
            <MarcallLogo className="w-7 h-7 text-primary" />
            <span className="font-display font-semibold text-base">MARCALL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <button onClick={scrollTo('how')} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how">{t('nav.howItWorks')}</button>
            <button onClick={scrollTo('features')} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">{t('nav.features')}</button>
            <button onClick={scrollTo('pricing')} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">{t('nav.pricing')}</button>
            <button onClick={scrollTo('agency')} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-agencies">{t('nav.forAgencies')}</button>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/login" data-testid="link-login">
              <Button variant="ghost" size="sm">{t('nav.login')}</Button>
            </Link>
            <Link href="/signup" data-testid="link-signup-nav">
              <Button size="sm">{t('nav.tryFree')}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 marcall-mesh opacity-60 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-10 items-center relative">
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5 py-1 px-3" data-testid="badge-tagline">
                <Sparkles className="w-3 h-3" /> {t('marketing.tagline')}
              </Badge>
              <Badge variant="secondary" className="gap-1.5 py-1 px-3" data-testid="badge-dev">
                {t('marketing.activeDev')}
              </Badge>
            </div>
            <h1 className="font-display font-semibold leading-[1.05] tracking-tight text-[clamp(2.75rem,6.5vw,5rem)]" data-testid="text-hero-title">
              {t('marketing.heroTitleA')}{' '}
              <span className="block">{t('marketing.heroTitleB')}</span>
              <span className="text-primary">{t('marketing.heroTitleC')}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed" data-testid="text-hero-sub">
              {t('marketing.heroSub')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" data-testid="link-hero-cta">
                <Button size="lg" className="gap-2">
                  {t('marketing.heroCtaPrimary')} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/demo" data-testid="link-hero-demo">
                <Button size="lg" variant="outline">
                  <PhoneCall className="w-4 h-4 mr-2" /> {t('marketing.heroCtaDemoListen')}
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> {t('marketing.noCard')}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> {t('marketing.fastSetup')}</span>
            </div>
          </div>
          <div className="relative">
            <img src={heroImg} alt="Sofía la recepcionista IA de MARCALL" className="rounded-2xl w-full object-cover aspect-[4/3] border" style={{ filter: 'grayscale(1) contrast(1.05)' }} data-testid="img-hero" />
          </div>
        </div>
      </section>

      {/* ───── DEMO SIMULATOR ───── */}
      <section id="demo" className="py-20 md:py-28 border-t bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1.5"><Headphones className="w-3 h-3" /> Demo</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-3" data-testid="text-demo-title">
              {t('marketing.demoTitle')}
            </h2>
            <p className="text-muted-foreground text-lg mb-6">{t('marketing.demoSub')}</p>
            <div className="mb-6">
              <Link href="/demo" data-testid="link-demo-live">
                <Button size="sm" className="gap-2">
                  <Headphones className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Try the live voice demo' : 'Probar la voz en vivo'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="inline-flex border rounded-full p-1 bg-background">
              <button
                onClick={() => setDemoLang('es')}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${demoLang === 'es' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid="button-demo-es"
              >
                <Languages className="w-3.5 h-3.5" /> {t('marketing.listenSpanish')}
              </button>
              <button
                onClick={() => setDemoLang('en')}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${demoLang === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid="button-demo-en"
              >
                <Languages className="w-3.5 h-3.5" /> {t('marketing.listenEnglish')}
              </button>
            </div>
          </div>
          <CallSimulator lang={demoLang} />
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how" className="py-20 md:py-28 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight" data-testid="text-how-title">
              {t('marketing.howH')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="border-2 hover-elevate">
                <CardContent className="p-6 space-y-3">
                  <div className="font-display text-3xl font-semibold text-primary">0{n}</div>
                  <h3 className="font-display font-semibold text-lg">{t(`marketing.how${n}Title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`marketing.how${n}Body`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-20 md:py-28 border-t bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight" data-testid="text-features-title">
              {t('marketing.featuresH')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { i: 1, icon: Globe },
              { i: 2, icon: Calendar },
              { i: 3, icon: MessageSquare },
              { i: 4, icon: Target },
              { i: 5, icon: PhoneCall },
              { i: 6, icon: Headphones },
            ].map(({ i, icon: Icon }) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl bg-background border">
                <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold mb-1">{t(`marketing.f${i}Title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`marketing.f${i}Body`)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl overflow-hidden border max-w-5xl mx-auto">
            <img src={wavesImg} alt="" className="w-full h-32 object-cover" style={{ filter: 'grayscale(1) contrast(1.05)' }} />
          </div>
        </div>
      </section>

      {/* ───── PRICING ───── */}
      <section id="pricing" className="py-20 md:py-28 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-3" data-testid="text-pricing-title">
              {t('marketing.pricingH')}
            </h2>
            <p className="text-muted-foreground text-lg">{t('marketing.pricingSub')}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p) => {
              const popular = p.slug === 'crece';
              return (
                <Card key={p.id} className={`relative border-2 ${popular ? 'border-primary shadow-xl' : ''}`} data-testid={`card-plan-${p.slug}`}>
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest rounded-full font-semibold">
                      {planCopy.crece.tag}
                    </div>
                  )}
                  <CardContent className="p-6 space-y-5">
                    <div>
                      <Badge variant="outline" className="mb-2 capitalize text-[10px]">{p.slug}</Badge>
                      <h3 className="font-display font-semibold text-lg">{p.name}</h3>
                    </div>
                    <div>
                      <span className="font-display text-3xl font-semibold">{formatMxn(p.priceMxnCents)}</span>
                      <span className="text-sm text-muted-foreground ml-1">{t('marketing.perMonth')}</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.minutesIncluded', { count: p.includedMinutes })}</li>
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.numbersInc', { count: p.maxNumbers })}</li>
                      <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {t('marketing.extraMin', { rate: (p.overagePerMinMxnCents / 100).toFixed(2) })}</li>
                      {(p.features ? (Array.isArray(p.features) ? p.features : []) : []).slice(0, 3).map((f: string, i: number) => (
                        <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {f}</li>
                      ))}
                    </ul>
                    <Link href={`/signup?plan=${p.slug}`} data-testid={`link-choose-${p.slug}`}>
                      <Button variant={popular ? 'default' : 'outline'} className="w-full">
                        {t('marketing.choosePlan', { plan: p.name })}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───── HOW-IT-WORKS ANCHOR ───── */}
      <section className="py-16 md:py-20 border-t">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[1fr,auto] gap-6 items-center">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2" data-testid="text-how-anchor-title">
              {t('marketing.howAnchorH')}
            </h2>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-how-anchor-body">{t('marketing.howAnchorBody')}</p>
          </div>
          <Link href={lang === 'en' ? '/how-it-works' : '/como-funciona'} data-testid="link-how-anchor-cta">
            <Button variant="outline" className="gap-2">{t('marketing.howAnchorCta')} <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* ───── TESTIMONIALS PLACEHOLDER ───── */}
      <section className="py-16 md:py-20 border-t bg-muted/20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-3" data-testid="text-testimonials-title">
            {t('marketing.testimonialsPlaceholderH')}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6" data-testid="text-testimonials-body">
            {t('marketing.testimonialsPlaceholderBody')}
          </p>
          <Link href="/signup" data-testid="link-testimonials-cta">
            <Button size="lg" className="gap-2">{t('marketing.testimonialsPlaceholderCta')} <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* ───── AGENCY ───── */}
      <section id="agency" className="py-20 md:py-28 border-t bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <Badge variant="outline" className="mb-4 border-background/30 text-background/90 gap-1.5"><Users className="w-3 h-3" /> {t('nav.forAgencies')}</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-4" data-testid="text-agency-title">
              {t('marketing.agencyH')}
            </h2>
            <p className="text-lg opacity-80 mb-7 leading-relaxed">{t('marketing.agencySub')}</p>
            <Link href="/signup?role=reseller&type=agency" data-testid="link-reseller-cta">
              <Button size="lg" variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
                {t('marketing.agencyCta')} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
          <img src={ownerImg} alt="" className="rounded-2xl w-full object-cover aspect-[4/3] border border-border" style={{ filter: 'grayscale(1) contrast(1.05)' }} />
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="py-20 md:py-28 border-t">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-center mb-10" data-testid="text-faq-title">
            {t('marketing.faqH')}
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border rounded-xl px-4 bg-card" data-testid={`faq-${i}`}>
                <AccordionTrigger className="text-left font-display font-semibold hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="py-20 md:py-28 border-t bg-foreground text-background">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight mb-5" data-testid="text-cta-final">
            {t('marketing.ctaFinalH')}
          </h2>
          <p className="text-lg opacity-90 mb-8">{t('marketing.ctaFinalBody')}</p>
          <Link href="/signup" data-testid="link-cta-final">
            <Button size="lg" variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              {t('marketing.ctaFinalBtn')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ───── TRUST CENTER BANNER ───── */}
      <section className="border-t bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{t('marketing.footerTrustCenter')}</div>
            <p className="text-sm text-foreground/80 max-w-2xl">{t('marketing.footerTrustCenterTagline')}</p>
          </div>
          <Link href="/security" data-testid="link-trust-center">
            <Button variant="outline" size="sm">
              {t('marketing.footerSecurity')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

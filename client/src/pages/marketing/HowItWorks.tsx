import { useEffect } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, Languages, Sparkles, MessageSquare, GraduationCap, ArrowRight } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';

const ICONS = [Phone, Languages, Sparkles, MessageSquare, GraduationCap];

export default function HowItWorks() {
  const { t } = useTranslation();
  const { lang } = useLang();

  useEffect(() => {
    document.title = lang === 'en' ? 'How MARCALL works \u2014 5-step bilingual receptionist flow' : 'C\u00f3mo funciona MARCALL \u2014 flujo de 5 pasos';
    document.documentElement.lang = lang;
  }, [lang]);

  const steps = [1, 2, 3, 4, 5].map(n => ({
    n,
    title: t(`howItWorks.s${n}Title`) as string,
    body: t(`howItWorks.s${n}Body`) as string,
    Icon: ICONS[n - 1],
  }));

  return (
    <div className="min-h-screen bg-background text-foreground marcall-grain">
      <MarketingNav />

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <h1
            className="font-display font-semibold leading-[1.05] tracking-tight text-[clamp(2.25rem,5vw,3.75rem)]"
            data-testid="text-how-title"
          >
            {t('howItWorks.title')}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{t('howItWorks.subtitle')}</p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 space-y-10 md:space-y-14">
          {steps.map(({ n, title, body, Icon }) => (
            <div key={n} className="grid md:grid-cols-[120px_1fr] gap-6 md:gap-10 items-start" data-testid={`station-${n}`}>
              <div className="flex md:flex-col md:items-start items-center gap-4">
                <div className="font-display text-5xl md:text-6xl font-semibold text-primary tabular-nums leading-none">
                  {String(n).padStart(2, '0')}
                </div>
                <div className="hidden md:block">
                  <Icon className="w-7 h-7 text-muted-foreground" />
                </div>
              </div>
              <Card className="p-6 md:p-8 border-2">
                <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-3" data-testid={`station-title-${n}`}>
                  {title}
                </h2>
                <p className="text-muted-foreground leading-relaxed text-base md:text-lg">{body}</p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-foreground text-background py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            {t('howItWorks.endCtaH')}
          </h2>
          <p className="opacity-80 text-lg mb-7">{t('howItWorks.endCtaBody')}</p>
          <Link href="/signup" data-testid="link-cta-end">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              {t('howItWorks.endCtaBtn')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

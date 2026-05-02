import { useEffect } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';

interface FaqItem {
  q: string;
  a: string;
  linkText?: string;
  linkHref?: string;
}

export default function Faq() {
  const { t } = useTranslation();
  const { lang } = useLang();

  useEffect(() => {
    document.title = lang === 'en'
      ? 'MARCALL FAQ \u2014 Bilingual AI receptionist questions answered'
      : 'Preguntas frecuentes \u2014 MARCALL recepcionista IA bilingue';
    document.documentElement.lang = lang;
  }, [lang]);

  const items = (t('faqPage.items', { returnObjects: true }) as FaqItem[]) || [];

  return (
    <div className="min-h-screen bg-background text-foreground marcall-grain">
      <MarketingNav />

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <h1 className="font-display font-semibold leading-tight tracking-tight text-[clamp(2.25rem,5vw,3.5rem)]" data-testid="text-faq-page-title">
            {t('faqPage.title')}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{t('faqPage.subtitle')}</p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-5 bg-card" data-testid={`faq-item-${i}`}>
                <AccordionTrigger className="text-left font-display font-semibold hover:no-underline text-base md:text-lg py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pb-5">
                  <p>{item.a}</p>
                  {item.linkText && item.linkHref && (
                    <p className="mt-3">
                      <Link href={item.linkHref} className="text-primary hover:underline inline-flex items-center gap-1" data-testid={`faq-link-${i}`}>
                        {item.linkText} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-lg mb-5">
            {lang === 'en'
              ? 'Still have questions? Email us at '
              : '\u00bfM\u00e1s dudas? Escr\u00edbenos a '}
            <a href="mailto:hello@careofaddress.com" className="text-primary hover:underline">
              hello@careofaddress.com
            </a>
            .
          </p>
          <Link href="/signup" data-testid="link-faq-cta">
            <Button size="lg">
              {t('marketing.heroCtaPrimary')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

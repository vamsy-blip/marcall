import { useEffect } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/MarketingChrome';
import { WhatsAppButton } from '@/components/WhatsAppButton';

const ROW_KEYS = ['Availability', 'Response', 'Concurrent', 'Languages', 'Cost', 'Training', 'Accuracy', 'Reports', 'Scale'] as const;

export default function VsHumano() {
  const { t } = useTranslation();
  const { lang } = useLang();

  useEffect(() => {
    document.title = lang === 'en'
      ? 'MARCALL vs human receptionist \u2014 honest cost & capability comparison'
      : 'MARCALL vs recepcionista humano \u2014 comparaci\u00f3n honesta de costo y capacidades';
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="min-h-screen bg-background text-foreground marcall-grain">
      <MarketingNav />

      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <h1 className="font-display font-semibold leading-tight tracking-tight text-[clamp(2.25rem,5vw,3.5rem)]" data-testid="text-vs-title">
            {t('vsHumano.title')}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{t('vsHumano.subtitle')}</p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          {/* Desktop / md+ : table */}
          <div className="hidden md:block overflow-hidden rounded-xl border-2">
            <table className="w-full text-sm" data-testid="table-vs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left font-display font-semibold p-4 w-[28%]"></th>
                  <th className="text-left font-display font-semibold p-4 text-foreground bg-primary/5 border-l border-r" data-testid="vs-col-marcall">
                    {t('vsHumano.colMarcall')}
                  </th>
                  <th className="text-left font-display font-semibold p-4 text-muted-foreground" data-testid="vs-col-human">
                    {t('vsHumano.colHuman')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROW_KEYS.map((k, i) => (
                  <tr key={k} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'} data-testid={`vs-row-${k}`}>
                    <td className="p-4 font-medium align-top">{t(`vsHumano.row${k}`)}</td>
                    <td className="p-4 align-top bg-primary/5 border-l border-r">
                      <span className="inline-flex gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{t(`vsHumano.row${k}M`)}</span>
                      </span>
                    </td>
                    <td className="p-4 align-top text-muted-foreground">
                      <span className="inline-flex gap-2">
                        <X className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                        <span>{t(`vsHumano.row${k}H`)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : stacked cards */}
          <div className="md:hidden space-y-4" data-testid="vs-mobile">
            {ROW_KEYS.map((k) => (
              <Card key={k} className="p-5 border-2">
                <div className="font-display font-semibold mb-3">{t(`vsHumano.row${k}`)}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2 p-2 rounded bg-primary/5 border">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-primary mb-0.5 font-semibold">MARCALL</div>
                      {t(`vsHumano.row${k}M`)}
                    </div>
                  </div>
                  <div className="flex gap-2 p-2 rounded text-muted-foreground">
                    <X className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest mb-0.5 font-semibold">{lang === 'en' ? 'Human' : 'Humano'}</div>
                      {t(`vsHumano.row${k}H`)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Caveat */}
          <div className="mt-10 rounded-xl border-2 border-dashed p-6 md:p-7 bg-muted/30 flex gap-4" data-testid="vs-caveat">
            <AlertCircle className="w-6 h-6 text-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold mb-2">{t('vsHumano.caveatTitle')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('vsHumano.caveatBody')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-foreground text-background py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-3">{t('vsHumano.ctaH')}</h2>
          <p className="opacity-80 text-lg mb-7">{t('vsHumano.ctaBody')}</p>
          <Link href="/signup" data-testid="link-vs-cta">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
              {t('vsHumano.ctaBtn')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  );
}

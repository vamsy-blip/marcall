import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { marked } from 'marked';
import { useLang } from '@/components/LanguageProvider';
import { useTranslation } from 'react-i18next';
import { MarcallWordmark } from '@/components/Brand';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Card, CardContent } from '@/components/ui/card';

export default function LegalPage() {
  const [, params] = useRoute('/legal/:doc');
  const doc = params?.doc || 'privacy';
  const { lang } = useLang();
  const { t } = useTranslation();
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/legal/${doc}?lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        const rendered = marked.parse(data.content || '', { async: false }) as string;
        setHtml(rendered);
      })
      .catch(() => setHtml(`<p>${t('common.loading')}</p>`))
      .finally(() => setLoading(false));
  }, [doc, lang]);

  const titles: Record<string, { es: string; en: string }> = {
    privacy: { es: 'Aviso de privacidad', en: 'Privacy notice' },
    terms: { es: 'Términos y condiciones', en: 'Terms of service' },
    resellers: { es: 'Programa de revendedores', en: 'Reseller program' },
  };
  const title = titles[doc]?.[lang] || doc;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" data-testid="link-home">
            <MarcallWordmark className="h-7" />
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-2xl font-semibold mb-6" data-testid="text-legal-title">{title}</h1>
        <Card>
          <CardContent className="p-8 prose prose-sm dark:prose-invert max-w-none">
            {loading ? (
              <p className="text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div
                className="legal-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

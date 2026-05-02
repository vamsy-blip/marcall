import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/components/LanguageProvider';
import { LanguageToggle, LanguagePill } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { MarcallLogo, MarcallWordmark } from '@/components/Brand';
import { Badge } from '@/components/ui/badge';

export function MarketingNav() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const howHref = lang === 'en' ? '/how-it-works' : '/como-funciona';
  const faqHref = lang === 'en' ? '/faq' : '/preguntas-frecuentes';

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" data-testid="link-nav-home" className="flex items-center gap-2">
          <MarcallLogo className="w-7 h-7 text-primary" />
          <span className="font-display font-semibold text-base">MARCALL</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm">
          <Link href={howHref} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-how">{t('nav.howItWorks')}</Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-pricing">{t('nav.pricing')}</Link>
          <Link href={faqHref} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-faq">{t('marketing.footerFaq')}</Link>
          <Link href="/security" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-security">{t('marketing.footerSecurity')}</Link>
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
  );
}

export function MarketingFooter() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const howHref = lang === 'en' ? '/how-it-works' : '/como-funciona';
  const faqHref = lang === 'en' ? '/faq' : '/preguntas-frecuentes';
  const vsHref = lang === 'en' ? '/vs-receptionist' : '/vs-recepcionista';
  const statusHref = lang === 'en' ? '/status' : '/estado';

  // Real, build-time deploy timestamp (not faked).
  const buildTime = (import.meta as any).env?.VITE_BUILD_TIME as string | undefined;
  const fmtBuild = (() => {
    if (!buildTime) return null;
    try {
      const d = new Date(buildTime);
      return d.toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return null; }
  })();

  return (
    <footer className="py-12 border-t bg-muted/20">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <MarcallWordmark className="h-7 mb-3" />
          <p className="text-muted-foreground text-xs leading-relaxed mb-3">{t('marketing.trustBuiltMty')} · {t('marketing.trustMexicano')}</p>
          {fmtBuild && (
            <Badge variant="outline" className="text-[10px] tracking-wide" data-testid="badge-build-time">
              {t('marketing.trustLastDeploy')}: {fmtBuild}
            </Badge>
          )}
          <div className="mt-4"><LanguagePill /></div>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t('marketing.footerProduct')}</h4>
          <ul className="space-y-2">
            <li><Link href={howHref} className="hover:text-primary" data-testid="link-footer-how">{t('marketing.footerHowItWorks')}</Link></li>
            <li><Link href={faqHref} className="hover:text-primary" data-testid="link-footer-faq">{t('marketing.footerFaq')}</Link></li>
            <li><Link href={vsHref} className="hover:text-primary" data-testid="link-footer-vs">{t('marketing.footerVsHumano')}</Link></li>
            <li><Link href="/pricing" className="hover:text-primary" data-testid="link-footer-pricing">{t('nav.pricing')}</Link></li>
            <li><Link href="/demo" className="hover:text-primary" data-testid="link-footer-demo">Demo</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t('marketing.footerCompany')}</h4>
          <ul className="space-y-2">
            <li><Link href="/security" className="hover:text-primary" data-testid="link-footer-security">{t('marketing.footerSecurity')}</Link></li>
            <li><Link href="/security#compliance" className="hover:text-primary" data-testid="link-footer-compliance">{t('marketing.footerCompliance')}</Link></li>
            <li><Link href={statusHref} className="hover:text-primary" data-testid="link-footer-status">{t('marketing.footerStatus')}</Link></li>
            <li><a href="mailto:hello@careofaddress.com" className="hover:text-primary" data-testid="link-footer-contact">{t('marketing.footerContact')}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-muted-foreground">{t('marketing.footerLegal')}</h4>
          <ul className="space-y-2">
            <li><Link href="/legal/privacy" className="hover:text-primary" data-testid="link-footer-privacy">{t('marketing.footerPrivacy')}</Link></li>
            <li><Link href="/legal/terms" className="hover:text-primary" data-testid="link-footer-terms">{t('marketing.footerTerms')}</Link></li>
            <li><a href="mailto:security@careofaddress.com" className="hover:text-primary" data-testid="link-footer-vuln">{t('marketing.footerVuln')}</a></li>
            <li><Link href="/login" className="hover:text-primary" data-testid="link-footer-signin">{t('marketing.footerSignIn')}</Link></li>
            <li><Link href="/signup" className="hover:text-primary" data-testid="link-footer-signup">{t('marketing.footerSignUp')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t text-xs text-muted-foreground flex justify-between">
        <span>© {new Date().getFullYear()} MARCALL</span>
        <span>marcall.careofaddress.com</span>
      </div>
    </footer>
  );
}

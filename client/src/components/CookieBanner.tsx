/**
 * Cookie consent v2 (Control 10).
 *
 * Two categories:
 *   - Essential: auth session, CSRF — always on
 *   - Analytics: Plausible — off by default until user accepts
 *
 * Consent is persisted to a `__Host-marcall_consent` cookie
 * (HttpOnly=false — JS needs to read it; SameSite=Lax).
 * Plausible script is only mounted when consent.analytics === true.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ConsentPrefs = { essential: true; analytics: boolean };

type Ctx = {
  consent: ConsentPrefs | null;
  acceptAll: () => void;
  acceptEssential: () => void;
};

const CONSENT_COOKIE = '__Host-marcall_consent';
const FALLBACK_COOKIE = 'marcall_consent'; // dev (no __Host-)

function readConsentCookie(): ConsentPrefs | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.match(/(?:^|;\s*)(?:__Host-)?marcall_consent=([^;]+)/)?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed?.analytics === 'boolean') {
      return { essential: true, analytics: parsed.analytics };
    }
  } catch {}
  return null;
}

function writeConsentCookie(prefs: ConsentPrefs) {
  const val = encodeURIComponent(JSON.stringify(prefs));
  const isProd = window.location.protocol === 'https:';
  const cookieName = isProd ? CONSENT_COOKIE : FALLBACK_COOKIE;
  const secure = isProd ? '; Secure' : '';
  // 1 year expiry
  const expires = new Date(Date.now() + 365 * 86400 * 1000).toUTCString();
  document.cookie = `${cookieName}=${val}; Path=/; SameSite=Lax${secure}; Expires=${expires}`;
}

const CookieCtx = createContext<Ctx>({
  consent: null,
  acceptAll: () => {},
  acceptEssential: () => {},
});

export function CookieProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentPrefs | null>(readConsentCookie);

  const acceptAll = () => {
    const prefs: ConsentPrefs = { essential: true, analytics: true };
    writeConsentCookie(prefs);
    setConsent(prefs);
  };

  const acceptEssential = () => {
    const prefs: ConsentPrefs = { essential: true, analytics: false };
    writeConsentCookie(prefs);
    setConsent(prefs);
  };

  // Mount Plausible analytics script only when analytics consent is given
  useEffect(() => {
    if (!consent?.analytics) return;
    if (document.querySelector('script[data-domain]')) return; // already mounted
    const script = document.createElement('script');
    script.defer = true;
    script.setAttribute('data-domain', 'marcall.careofaddress.com');
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);
  }, [consent?.analytics]);

  return (
    <CookieCtx.Provider value={{ consent, acceptAll, acceptEssential }}>
      {children}
    </CookieCtx.Provider>
  );
}

export const useCookies = () => useContext(CookieCtx);

export function CookieBanner() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const { consent, acceptAll, acceptEssential } = useCookies();

  if (consent !== null) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50 bg-background border shadow-lg rounded-lg p-4 md:p-5"
      role="region"
      aria-label="Cookie notice"
      data-testid="cookie-banner"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium mb-1">
            {lang === 'en' ? 'Privacy preferences' : 'Preferencias de privacidad'}
          </p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {lang === 'en'
              ? 'We use essential cookies for authentication and security. With your consent, we also use anonymous analytics (Plausible) to improve the product.'
              : 'Usamos cookies esenciales para autenticación y seguridad. Con tu consentimiento, también usamos analíticas anónimas (Plausible) para mejorar el producto.'}
          </p>

          {/* Categories */}
          <div className="text-xs mb-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              <span className="font-medium">{lang === 'en' ? 'Essential' : 'Esenciales'}</span>
              <span className="text-muted-foreground">({lang === 'en' ? 'always active' : 'siempre activas'})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />
              <span className="font-medium">{lang === 'en' ? 'Analytics' : 'Analíticas'}</span>
              <span className="text-muted-foreground">(Plausible — {lang === 'en' ? 'anonymous' : 'anónimas'})</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={acceptAll}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs"
              data-testid="button-cookie-accept-all"
            >
              {lang === 'en' ? 'Accept all' : 'Aceptar todo'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={acceptEssential}
              className="h-8 text-xs"
              data-testid="button-cookie-essential-only"
            >
              {lang === 'en' ? 'Essential only' : 'Solo esenciales'}
            </Button>
            <Link href="/security" data-testid="link-cookie-learn">
              <button className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline">
                {lang === 'en' ? 'Learn more' : 'Más información'}
              </button>
            </Link>
          </div>
        </div>
        <button
          onClick={acceptEssential}
          aria-label="Dismiss cookie notice"
          className="text-muted-foreground/60 hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
          data-testid="button-cookie-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

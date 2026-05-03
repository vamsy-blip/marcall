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
  const { t } = useTranslation();
  const { consent, acceptAll, acceptEssential } = useCookies();

  if (consent !== null) return null;

  // H-3 fix: bottom-center compact bar instead of corner sheet. Persists across
  // hash navigations because consent is stored in a 1y cookie (read on every
  // mount above). Mobile gets a stacked layout; desktop is a single compact row.
  return (
    <div
      className="fixed inset-x-0 bottom-3 md:bottom-4 z-50 px-3 pointer-events-none"
      role="region"
      aria-label={t('cookies.title')}
      data-testid="cookie-banner"
    >
      <div className="mx-auto max-w-2xl pointer-events-auto bg-background/95 backdrop-blur border border-border shadow-lg rounded-full px-4 py-2 md:py-2.5 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-foreground shrink-0" aria-hidden="true" />
        <p className="text-xs leading-snug flex-1 min-w-0 truncate md:whitespace-normal">
          {t('cookies.banner')}{' '}
          <Link href="/security" data-testid="link-cookie-learn" className="underline underline-offset-2 hover:text-foreground text-muted-foreground">
            {t('cookies.learn')}
          </Link>
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={acceptEssential}
            className="h-7 text-xs rounded-full px-3"
            data-testid="button-cookie-essential-only"
          >
            {t('cookies.strictly')}
          </Button>
          <Button
            size="sm"
            onClick={acceptAll}
            className="h-7 text-xs rounded-full px-3 bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-cookie-accept-all"
          >
            {t('cookies.acceptAll')}
          </Button>
          <button
            onClick={acceptEssential}
            aria-label={t('common.close')}
            className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
            data-testid="button-cookie-dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

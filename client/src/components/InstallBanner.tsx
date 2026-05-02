import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Shows a one-shot "Install MARCALL" banner on the bottom of the screen when the
 * browser fires `beforeinstallprompt`. Sandboxed iframes block storage APIs, so
 * dismissal is in-memory only — that's acceptable for a non-critical promo.
 */
export function InstallBanner() {
  const { t } = useTranslation();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setEvt(null);
      setDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!evt || dismissed) return null;

  const onInstall = async () => {
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setEvt(null);
      } else {
        setDismissed(true);
      }
    } catch {
      setDismissed(true);
    }
  };

  return (
    <div
      className="fixed left-3 right-3 bottom-20 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-40"
      data-testid="install-banner"
      role="dialog"
      aria-label={t('pwa.installTitle', 'Instalar MARCALL')}
    >
      <div className="rounded-lg border border-border bg-background shadow-lg p-4 flex items-start gap-3">
        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Download className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{t('pwa.installTitle', 'Instalar MARCALL')}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t('pwa.installBody', 'Acceso rápido desde tu pantalla de inicio. Funciona como una app.')}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onInstall}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate"
              data-testid="button-install-pwa"
            >
              {t('pwa.installCta', 'Instalar')}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover-elevate"
              data-testid="button-install-dismiss"
            >
              {t('common.dismiss', 'Ahora no')}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="size-7 rounded-md hover-elevate inline-flex items-center justify-center text-muted-foreground shrink-0"
          aria-label={t('common.close', 'Cerrar')}
          data-testid="button-install-close"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

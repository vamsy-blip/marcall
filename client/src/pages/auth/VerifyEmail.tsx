import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { MarcallWordmark } from '@/components/Brand';
import { Loader2, CheckCircle2, XCircle, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguagePill } from '@/components/LanguageToggle';

function getQueryParam(name: string): string | null {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  return params.get(name);
}

type State =
  | { kind: 'pending' }
  | { kind: 'no-token' }
  | { kind: 'success'; alreadyVerified?: boolean }
  | { kind: 'error'; message: string };

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'pending' });

  useEffect(() => {
    const token = getQueryParam('token');
    if (!token) {
      setState({ kind: 'no-token' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest('POST', '/api/auth/verify-email', { token });
        const data = await res.json();
        if (cancelled) return;
        if (data?.ok) {
          setState({ kind: 'success', alreadyVerified: !!data.alreadyVerified });
        } else {
          setState({ kind: 'error', message: data?.error || 'No se pudo verificar el correo.' });
        }
      } catch (e: any) {
        if (cancelled) return;
        setState({ kind: 'error', message: e?.message || 'No se pudo verificar el correo.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-12">
      <div className="flex items-center justify-between">
        <Link href="/" data-testid="link-brand"><MarcallWordmark size={26} /></Link>
        <LanguagePill />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          {state.kind === 'pending' && (
            <>
              <Loader2 className="size-12 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="font-display font-bold text-2xl mb-3" data-testid="text-verify-status">
                {t('auth.verifyPendingTitle', { defaultValue: 'Verificando tu correo…' })}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('auth.verifyPendingSub', { defaultValue: 'Esto solo tomará un momento.' })}
              </p>
            </>
          )}

          {state.kind === 'no-token' && (
            <>
              <XCircle className="size-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl mb-3" data-testid="text-verify-status">
                {t('auth.verifyNoTokenTitle', { defaultValue: 'Enlace inválido' })}
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                {t('auth.verifyNoTokenSub', { defaultValue: 'Este enlace no contiene un token válido. Inicia sesión y solicita un nuevo enlace de verificación.' })}
              </p>
              <Link href="/login">
                <Button data-testid="button-go-login">{t('auth.backToLogin', { defaultValue: 'Volver al inicio de sesión' })}</Button>
              </Link>
            </>
          )}

          {state.kind === 'success' && (
            <>
              {state.alreadyVerified ? (
                <MailCheck className="size-12 text-accent mx-auto mb-4" />
              ) : (
                <CheckCircle2 className="size-12 text-accent mx-auto mb-4" />
              )}
              <h1 className="font-display font-bold text-2xl mb-3" data-testid="text-verify-status">
                {state.alreadyVerified
                  ? t('auth.verifyAlreadyTitle', { defaultValue: 'Tu correo ya estaba verificado' })
                  : t('auth.verifySuccessTitle', { defaultValue: '¡Correo verificado!' })}
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                {state.alreadyVerified
                  ? t('auth.verifyAlreadySub', { defaultValue: 'Puedes continuar usando MARCALL con todas las funciones activas.' })
                  : t('auth.verifySuccessSub', { defaultValue: 'Tu cuenta está completamente activa. Bienvenido a MARCALL.' })}
              </p>
              <Link href="/app">
                <Button data-testid="button-go-app">{t('auth.goToDashboard', { defaultValue: 'Ir al panel' })}</Button>
              </Link>
            </>
          )}

          {state.kind === 'error' && (
            <>
              <XCircle className="size-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl mb-3" data-testid="text-verify-status">
                {t('auth.verifyErrorTitle', { defaultValue: 'No pudimos verificar tu correo' })}
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                {t('auth.verifyErrorSub', { defaultValue: 'El enlace puede haber expirado o ya fue utilizado. Inicia sesión y solicita un nuevo enlace.' })}
              </p>
              <Link href="/login">
                <Button data-testid="button-go-login">{t('auth.backToLogin', { defaultValue: 'Volver al inicio de sesión' })}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

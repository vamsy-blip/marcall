import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MarcallWordmark } from '@/components/Brand';
import { Loader2, ShieldCheck, Phone, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from 'react-i18next';
import { LanguagePill } from '@/components/LanguageToggle';

/**
 * Read the `?next=` query param from the hash-based URL.
 * Sanitised: must start with "/" and must NOT be an absolute URL to prevent
 * open-redirect attacks.
 */
function getNextParam(): string | null {
  try {
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart === -1) return null;
    const params = new URLSearchParams(hash.slice(queryStart));
    const next = params.get('next');
    if (!next) return null;
    if (!next.startsWith('/') || next.startsWith('//') || next.includes(':')) return null;
    return next;
  } catch {
    return null;
  }
}

function defaultDestination(role: string): string {
  if (role === 'superadmin') return '/admin';
  if (role === 'reseller') return '/agency';
  return '/app/resumen';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetch } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '', remember: true });

  const [mfaStep, setMfaStep] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [totp, setTotp] = useState('');

  const onLoginSuccess = async (data: { user: { role: string } }) => {
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    refetch();
    toast({ title: t('auth.welcomeBack', { defaultValue: '¡Bienvenido!' }) });
    const next = getNextParam() ?? defaultDestination(data.user.role);
    setTimeout(() => setLocation(next), 100);
  };

  const loginMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/login', { email: form.email, password: form.password });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.mfaRequired) {
        setChallengeToken(data.challengeToken);
        setMfaStep(true);
        return;
      }
      await onLoginSuccess(data);
    },
    onError: () =>
      toast({
        title: t('auth.loginFail', { defaultValue: 'No pudimos entrar' }),
        description: t('auth.loginGenericError', { defaultValue: 'Email o contraseña incorrectos.' }),
        variant: 'destructive',
      }),
  });

  const mfaMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/mfa/verify', { challengeToken, totp });
      return res.json();
    },
    onSuccess: async (data) => { await onLoginSuccess(data); },
    onError: (e: any) =>
      toast({
        title: t('auth.mfaFail', { defaultValue: 'Código incorrecto' }),
        description: e.message,
        variant: 'destructive',
      }),
  });

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1fr_minmax(0,540px)] xl:grid-cols-[1fr_minmax(0,640px)]">
      {/* Left: form */}
      <div className="flex flex-col p-6 md:p-10 lg:p-12 order-2 lg:order-1">
        <div className="flex items-center justify-between">
          <Link href="/" data-testid="link-brand"><MarcallWordmark size={26} /></Link>
          <LanguagePill />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {!mfaStep ? (
              <>
                <h1 className="font-display font-bold text-3xl tracking-tight mb-2">{t('auth.loginTitle')}</h1>
                <p className="text-muted-foreground mb-8 text-sm">{t('auth.loginSub')}</p>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); loginMut.mutate(); }} noValidate>
                  <div>
                    <Label htmlFor="email">{t('auth.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      data-testid="input-email"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw">{t('auth.password')}</Label>
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline" data-testid="link-forgot">
                        {t('auth.forgotPasswordShort', { defaultValue: '¿Olvidaste tu contraseña?' })}
                      </Link>
                    </div>
                    <Input
                      id="pw"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      data-testid="input-password"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
                    <Checkbox
                      checked={form.remember}
                      onCheckedChange={v => setForm(f => ({ ...f, remember: v === true }))}
                      data-testid="checkbox-remember"
                    />
                    {t('auth.rememberMe', { defaultValue: 'Recuérdame' })}
                  </label>
                  <Button type="submit" disabled={loginMut.isPending} className="w-full h-11" data-testid="button-submit">
                    {loginMut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                    {t('auth.signIn')}
                  </Button>
                </form>

                <div className="mt-6 text-sm text-center text-muted-foreground">
                  {t('auth.noAccountTrial', { defaultValue: '¿Aún no tienes cuenta?' })}{' '}
                  <Link href="/signup" className="text-primary font-medium hover:underline" data-testid="link-signup">
                    {t('auth.tryFreeTrial', { defaultValue: 'Pruébalo gratis 7 días' })}
                  </Link>
                </div>

                {/* Demo creds — DEV builds only */}
                {import.meta.env.DEV && (
                  <div className="mt-10 p-4 rounded-lg border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
                    <div className="font-semibold mb-1">{t('auth.demoCredentials')} (dev only)</div>
                    <div className="grid gap-1 font-mono">
                      <div>admin@careofaddress.com · admin123</div>
                      <div>dueno@clinicanorte.mx · demo123</div>
                      <div>agencia@demo.mx · agencia123</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="font-display font-bold text-3xl tracking-tight mb-2">
                  {t('auth.mfaTitle', { defaultValue: 'Verificación en dos pasos' })}
                </h1>
                <p className="text-muted-foreground mb-8 text-sm">
                  {t('auth.mfaSub', { defaultValue: 'Ingresa el código de 6 dígitos de tu aplicación autenticadora, o uno de tus códigos de respaldo.' })}
                </p>
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); mfaMut.mutate(); }}
                >
                  <div>
                    <Label htmlFor="totp">{t('auth.mfaCode', { defaultValue: 'Código TOTP' })}</Label>
                    <Input
                      id="totp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={8}
                      value={totp}
                      onChange={e => setTotp(e.target.value.trim())}
                      data-testid="input-totp"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" disabled={mfaMut.isPending} className="w-full h-11" data-testid="button-mfa-submit">
                    {mfaMut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                    {t('auth.mfaVerify', { defaultValue: 'Verificar' })}
                  </Button>
                </form>
                <button
                  type="button"
                  className="mt-4 text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
                  onClick={() => { setMfaStep(false); setChallengeToken(''); setTotp(''); }}
                >
                  {t('auth.mfaBack', { defaultValue: '← Volver al inicio de sesión' })}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-secondary text-secondary-foreground order-1 lg:order-2">
        <div className="absolute inset-0 marcall-mesh opacity-30" />
        <div className="relative p-12 flex flex-col justify-between w-full">
          <div className="opacity-80 text-xs uppercase tracking-widest font-semibold">MARCALL</div>
          <div className="space-y-6">
            <div className="font-display font-bold text-4xl xl:text-5xl tracking-tight text-balance leading-[1.05]">
              {t('auth.brandHeadline', { defaultValue: 'Cada llamada contestada. En tu idioma. 24/7.' })}
            </div>
            <div className="text-sm opacity-80 leading-relaxed max-w-md">
              {t('auth.brandSub', { defaultValue: 'Tu recepcionista de IA agenda citas, califica leads y toma recados — en español mexicano e inglés, sin acentos raros.' })}
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3"><Phone className="size-4 mt-0.5 shrink-0 text-accent" /> {t('auth.brandFeat1', { defaultValue: 'Atiende cada llamada en menos de 2 segundos' })}</li>
            <li className="flex items-start gap-3"><Sparkles className="size-4 mt-0.5 shrink-0 text-accent" /> {t('auth.brandFeat2', { defaultValue: 'Agenda en tu Google Calendar y manda recados a WhatsApp' })}</li>
            <li className="flex items-start gap-3"><ShieldCheck className="size-4 mt-0.5 shrink-0 text-accent" /> {t('auth.brandFeat3', { defaultValue: 'Cumple LFPDPPP. Datos encriptados. Hecho en Monterrey.' })}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

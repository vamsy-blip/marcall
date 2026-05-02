import { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MarcallWordmark } from '@/components/Brand';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from 'react-i18next';
import { LanguagePill } from '@/components/LanguageToggle';

const INDUSTRIES = [
  'Restaurante',
  'Clínica',
  'Inmobiliaria',
  'Salón',
  'Servicios automotrices',
  'Servicios legales',
  'Fitness',
  'Otro',
];

/** 12-char password rule + variety. Returns 0..4 strength score. */
function passwordScore(pw: string): { score: number; label: string; ok: boolean } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 16) score++;
  const labels = ['', 'Débil', 'Aceptable', 'Buena', 'Excelente', 'Excelente'];
  return { score, label: labels[score] || '', ok: pw.length >= 12 && score >= 2 };
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetch } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    tenantName: '',
    industry: 'Otro',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const pwStrength = useMemo(() => passwordScore(form.password), [form.password]);

  const trial = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/signup', {
        email: form.email,
        password: form.password,
        tenantName: form.tenantName,
        industry: form.industry,
        role: 'tenant_owner',
        acceptTerms: form.acceptTerms,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      refetch();
      toast({
        title: t('auth.welcomeToast', { defaultValue: '¡Bienvenido a MARCALL!' }),
        description: t('auth.welcomeSub', { defaultValue: 'Tu prueba de 7 días empezó. Configuremos a Sofía.' }),
      });
      const next = data?.redirectTo || '/onboarding';
      setTimeout(() => setLocation(next), 200);
    },
    onError: (e: any) =>
      toast({
        title: t('auth.signupFail', { defaultValue: 'No se pudo crear tu cuenta' }),
        description: e.message,
        variant: 'destructive',
      }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.acceptTerms) {
      toast({
        title: t('auth.acceptTermsRequired', { defaultValue: 'Debes aceptar los términos' }),
        variant: 'destructive',
      });
      return;
    }
    if (!pwStrength.ok) {
      toast({
        title: t('auth.passwordTooWeak', { defaultValue: 'Contraseña muy débil' }),
        description: t('auth.passwordHint'),
        variant: 'destructive',
      });
      return;
    }
    trial.mutate();
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1fr_minmax(0,540px)] xl:grid-cols-[1fr_minmax(0,640px)]">
      {/* Left: form */}
      <div className="flex flex-col p-6 md:p-10 lg:p-12 order-2 lg:order-1">
        <div className="flex items-center justify-between">
          <Link href="/" data-testid="link-brand"><MarcallWordmark size={26} /></Link>
          <LanguagePill />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <h1 className="font-display font-bold text-3xl tracking-tight mb-2">
              {t('auth.signupTitle', { defaultValue: 'Empieza tu prueba gratuita' })}
            </h1>
            <p className="text-muted-foreground mb-3 text-sm">
              {t('auth.signupSub', { defaultValue: '7 días, sin tarjeta. Tu recepcionista lista en 5 minutos.' })}
            </p>
            <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-accent" /> {t('auth.signupBadge1', { defaultValue: 'Sin tarjeta requerida' })}</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-accent" /> {t('auth.signupBadge2', { defaultValue: '7 días gratis' })}</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-accent" /> {t('auth.signupBadge3', { defaultValue: 'Cancela cuando quieras' })}</span>
            </div>

            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <Label htmlFor="tname">{t('auth.businessName')}</Label>
                <Input
                  id="tname"
                  required
                  placeholder={t('auth.businessNamePlaceholder', { defaultValue: 'Tu Negocio S.A. de C.V.' })}
                  value={form.tenantName}
                  onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
                  data-testid="input-tenant-name"
                />
              </div>
              <div>
                <Label htmlFor="industry">{t('auth.industry', { defaultValue: 'Industria' })}</Label>
                <select
                  id="industry"
                  required
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="select-industry"
                >
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" autoComplete="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="pw">{t('auth.password')}</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  data-testid="input-password"
                />
                {form.password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2" aria-live="polite">
                    <div className="flex-1 grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} className={`h-1 rounded-full ${pwStrength.score >= n
                          ? (pwStrength.score >= 4 ? 'bg-accent' : pwStrength.score >= 3 ? 'bg-primary' : 'bg-yellow-500')
                          : 'bg-muted'}`} />
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground w-20 text-right">{pwStrength.label}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{t('auth.passwordHint')}</p>
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground select-none cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={form.acceptTerms}
                  onCheckedChange={v => setForm(f => ({ ...f, acceptTerms: v === true }))}
                  data-testid="checkbox-terms"
                />
                <span>
                  {t('auth.acceptTermsPrefix', { defaultValue: 'Acepto los' })}{' '}
                  <Link href="/legal/terms" className="text-primary hover:underline" data-testid="link-terms">{t('auth.termsLink', { defaultValue: 'Términos' })}</Link>
                  {' '}{t('auth.acceptTermsAnd', { defaultValue: 'y el' })}{' '}
                  <Link href="/legal/privacy" className="text-primary hover:underline" data-testid="link-privacy">{t('auth.privacyLink', { defaultValue: 'Aviso de Privacidad' })}</Link>
                  {'.'}
                </span>
              </label>

              <Button
                type="submit"
                disabled={trial.isPending || !form.acceptTerms || !pwStrength.ok || form.tenantName.length === 0 || form.email.length === 0}
                className="w-full h-11"
                data-testid="button-submit-trial"
              >
                {trial.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                {t('auth.startTrial', { defaultValue: 'Empezar prueba gratuita' })}
              </Button>
            </form>

            <div className="mt-5 text-sm text-center text-muted-foreground">
              {t('auth.haveAccount', { defaultValue: '¿Ya tienes cuenta?' })}{' '}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                {t('auth.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right: pitch */}
      <div className="hidden lg:flex relative overflow-hidden bg-secondary text-secondary-foreground order-1 lg:order-2">
        <div className="absolute inset-0 marcall-mesh opacity-30" />
        <div className="relative p-12 flex flex-col justify-between w-full">
          <div className="opacity-80 text-xs uppercase tracking-widest font-semibold">MARCALL · 7 días gratis</div>
          <div>
            <div className="font-display font-bold text-4xl xl:text-5xl tracking-tight text-balance leading-[1.05]">
              {t('auth.signupBrandHeadline', { defaultValue: 'En 5 minutos contestas cada llamada que recibes.' })}
            </div>
            <div className="mt-6 text-sm opacity-80 leading-relaxed max-w-md">
              {t('auth.signupBrandSub', { defaultValue: 'Configura tu asistente, escoge una voz y manda llamadas. Sin tarjeta de crédito durante la prueba.' })}
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              t('auth.signupCheck1', { defaultValue: 'Configuración guiada en 5 minutos' }),
              t('auth.signupCheck2', { defaultValue: 'Voces ElevenLabs en español mexicano e inglés' }),
              t('auth.signupCheck3', { defaultValue: 'Cancela en un clic — sin penalización' }),
              t('auth.signupCheck4', { defaultValue: 'Datos encriptados, hecho en Monterrey' }),
            ].map(line => (
              <li key={line} className="flex gap-2.5"><CheckCircle2 className="size-4 text-accent shrink-0" /> {line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MarcallWordmark } from '@/components/Brand';
import { Loader2, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguagePill } from '@/components/LanguageToggle';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/forgot', { email });
      return res.json();
    },
    onSettled: () => setSubmitted(true),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-12">
      <div className="flex items-center justify-between">
        <Link href="/" data-testid="link-brand"><MarcallWordmark size={26} /></Link>
        <LanguagePill />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {!submitted ? (
            <>
              <h1 className="font-display font-bold text-3xl tracking-tight mb-2">
                {t('auth.forgotTitle', { defaultValue: 'Recuperar contraseña' })}
              </h1>
              <p className="text-muted-foreground mb-8 text-sm">
                {t('auth.forgotSub', { defaultValue: 'Ingresa el correo de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.' })}
              </p>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
                <div>
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    data-testid="input-email"
                  />
                </div>
                <Button type="submit" disabled={mut.isPending} className="w-full h-11" data-testid="button-submit">
                  {mut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  {t('auth.sendResetLink', { defaultValue: 'Enviar enlace' })}
                </Button>
              </form>
              <div className="mt-6 text-sm text-center text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline" data-testid="link-back-login">
                  {t('auth.backToLogin', { defaultValue: '← Volver a iniciar sesión' })}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex size-14 rounded-full bg-accent/10 items-center justify-center mb-4">
                <MailCheck className="size-7 text-accent" />
              </div>
              <h1 className="font-display font-bold text-2xl tracking-tight mb-3">
                {t('auth.forgotSentTitle', { defaultValue: 'Revisa tu correo' })}
              </h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto" data-testid="text-forgot-confirm">
                {t('auth.forgotSentBody', { defaultValue: 'Si tu correo está registrado, recibirás un enlace en 5 minutos. Revisa también tu carpeta de spam.' })}
              </p>
              <Link href="/login" className="mt-8 inline-block text-sm text-primary hover:underline" data-testid="link-back-login">
                {t('auth.backToLogin', { defaultValue: '← Volver a iniciar sesión' })}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

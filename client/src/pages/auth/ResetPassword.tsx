import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MarcallWordmark } from '@/components/Brand';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguagePill } from '@/components/LanguageToggle';

function getQueryParam(name: string): string | null {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  return params.get(name);
}

function passwordOk(pw: string): boolean {
  if (pw.length < 12) return false;
  let variety = 0;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  return variety >= 2;
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { setToken(getQueryParam('token') || ''); }, []);

  const ok = useMemo(() => passwordOk(pw) && pw === pw2 && token.length > 0, [pw, pw2, token]);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/reset-password', { token, newPassword: pw });
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      toast({ title: t('auth.resetDone', { defaultValue: 'Contraseña actualizada' }) });
      setTimeout(() => setLocation('/login'), 1500);
    },
    onError: (e: any) => toast({ title: t('auth.resetFail', { defaultValue: 'No se pudo actualizar' }), description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col p-6 md:p-12">
      <div className="flex items-center justify-between">
        <Link href="/" data-testid="link-brand"><MarcallWordmark size={26} /></Link>
        <LanguagePill />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {!token ? (
            <div className="text-center">
              <XCircle className="size-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl mb-3">{t('auth.resetInvalid', { defaultValue: 'Enlace inválido' })}</h1>
              <p className="text-muted-foreground text-sm mb-8">
                {t('auth.resetInvalidBody', { defaultValue: 'Este enlace no contiene un token válido.' })}
              </p>
              <Link href="/forgot-password" className="text-primary hover:underline text-sm" data-testid="link-request-new">
                {t('auth.requestNewLink', { defaultValue: 'Solicitar un enlace nuevo' })}
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <CheckCircle2 className="size-12 text-accent mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl mb-3">{t('auth.resetDoneTitle', { defaultValue: 'Listo' })}</h1>
              <p className="text-muted-foreground text-sm">
                {t('auth.resetDoneBody', { defaultValue: 'Te llevamos al inicio de sesión…' })}
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-3xl tracking-tight mb-2">
                {t('auth.resetTitle', { defaultValue: 'Crea una nueva contraseña' })}
              </h1>
              <p className="text-muted-foreground mb-8 text-sm">
                {t('auth.resetSub', { defaultValue: 'Mínimo 12 caracteres con mezcla de letras, números y símbolos.' })}
              </p>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ok) mut.mutate(); }}>
                <div>
                  <Label htmlFor="pw">{t('auth.newPassword', { defaultValue: 'Nueva contraseña' })}</Label>
                  <Input id="pw" type="password" autoComplete="new-password" required minLength={12}
                    value={pw} onChange={e => setPw(e.target.value)} data-testid="input-password" />
                </div>
                <div>
                  <Label htmlFor="pw2">{t('auth.confirmPassword', { defaultValue: 'Confirmar contraseña' })}</Label>
                  <Input id="pw2" type="password" autoComplete="new-password" required minLength={12}
                    value={pw2} onChange={e => setPw2(e.target.value)} data-testid="input-password-confirm" />
                  {pw2.length > 0 && pw !== pw2 && (
                    <p className="text-[11px] text-destructive mt-1">{t('auth.passwordMismatch', { defaultValue: 'Las contraseñas no coinciden.' })}</p>
                  )}
                </div>
                <Button type="submit" disabled={!ok || mut.isPending} className="w-full h-11" data-testid="button-submit">
                  {mut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  {t('auth.resetSubmit', { defaultValue: 'Actualizar contraseña' })}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

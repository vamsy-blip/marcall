/**
 * MFA Setup page — Control 2
 * Route: /app/security/mfa
 *
 * Allows authenticated users (especially super-admin and tenant-admin/owner)
 * to enroll in TOTP-based two-factor authentication or disable it.
 * Backup codes are shown exactly once on enrollment.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EnrollData {
  otpauthUrl: string;
  qrDataUrl: string;
  backupCodes: string[];
}

export default function MFASetup() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const { toast } = useToast();

  const [phase, setPhase] = useState<'idle' | 'enrolling' | 'verifying' | 'done' | 'disabling'>('idle');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [totpInput, setTotpInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [totpDisableInput, setTotpDisableInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copy = (text: string, i: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCodes = () => {
    if (!enrollData) return;
    navigator.clipboard.writeText(enrollData.backupCodes.join('\n'));
    toast({ title: lang === 'en' ? 'Backup codes copied' : 'Códigos copiados' });
  };

  const startEnroll = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/auth/mfa/enroll-start', {});
      const data = await res.json();
      setEnrollData(data);
      setPhase('enrolling');
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const verifyEnroll = async () => {
    if (!totpInput || totpInput.length < 6) return;
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/mfa/enroll-verify', { totp: totpInput });
      setPhase('done');
      toast({ title: lang === 'en' ? 'MFA enabled!' : '¡MFA activado!' });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Invalid code' : 'Código incorrecto', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    if (!passwordInput || !totpDisableInput) return;
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/mfa/disable', { password: passwordInput, totp: totpDisableInput });
      setPhase('idle');
      setPasswordInput('');
      setTotpDisableInput('');
      toast({ title: lang === 'en' ? 'MFA disabled' : 'MFA desactivado' });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">
          {lang === 'en' ? 'Two-factor authentication (2FA)' : 'Autenticación en dos pasos (2FA)'}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {lang === 'en'
          ? 'Protect your account with a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.).'
          : 'Protege tu cuenta con una app autenticadora TOTP (Google Authenticator, Authy, 1Password, etc.).'}
      </p>

      {/* ── Idle / setup start ── */}
      {phase === 'idle' && (
        <div className="space-y-4">
          <Button onClick={startEnroll} disabled={loading} className="w-full">
            {loading
              ? (lang === 'en' ? 'Loading...' : 'Cargando...')
              : (lang === 'en' ? 'Set up 2FA' : 'Configurar 2FA')}
          </Button>
          <Button variant="outline" onClick={() => setPhase('disabling')} className="w-full">
            <ShieldOff className="w-4 h-4 mr-2" />
            {lang === 'en' ? 'Disable 2FA' : 'Desactivar 2FA'}
          </Button>
        </div>
      )}

      {/* ── Enrolling: show QR + backup codes ── */}
      {phase === 'enrolling' && enrollData && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">
              {lang === 'en' ? 'Scan this QR code with your authenticator app:' : 'Escanea este código QR con tu app autenticadora:'}
            </p>
            <img src={enrollData.qrDataUrl} alt="TOTP QR Code" className="rounded border w-48 h-48" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-destructive">
                {lang === 'en'
                  ? '⚠ Save your backup codes (shown once only):'
                  : '⚠ Guarda tus códigos de respaldo (se muestran solo una vez):'}
              </p>
              <Button variant="outline" size="sm" onClick={copyAllCodes}>
                <Copy className="w-3 h-3 mr-1" />
                {lang === 'en' ? 'Copy all' : 'Copiar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-muted rounded p-3">
              {enrollData.backupCodes.map((code, i) => (
                <button
                  key={i}
                  className="flex items-center justify-between font-mono text-xs px-2 py-1 rounded hover:bg-background transition-colors"
                  onClick={() => copy(code, i)}
                >
                  <span>{code}</span>
                  {copiedIndex === i ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 opacity-40" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              {lang === 'en' ? 'Enter the 6-digit code from your app to verify:' : 'Ingresa el código de 6 dígitos de tu app para verificar:'}
            </p>
            <div className="flex gap-2">
              <Input
                value={totpInput}
                onChange={e => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="123456"
                maxLength={8}
                className="font-mono w-40"
                autoComplete="one-time-code"
              />
              <Button onClick={verifyEnroll} disabled={loading || totpInput.length < 6}>
                {loading ? '...' : (lang === 'en' ? 'Verify' : 'Verificar')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="rounded border p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 text-primary font-medium">
            <ShieldCheck className="w-5 h-5" />
            {lang === 'en' ? '2FA is active on your account.' : '2FA activo en tu cuenta.'}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'en'
              ? 'You will be asked for a TOTP code on every login.'
              : 'Se te pedirá un código TOTP en cada inicio de sesión.'}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setPhase('disabling')}>
            {lang === 'en' ? 'Disable 2FA' : 'Desactivar 2FA'}
          </Button>
        </div>
      )}

      {/* ── Disabling ── */}
      {phase === 'disabling' && (
        <div className="space-y-4 rounded border p-4">
          <p className="text-sm font-medium text-destructive">
            {lang === 'en' ? 'Disable two-factor authentication' : 'Desactivar autenticación en dos pasos'}
          </p>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {lang === 'en' ? 'Current password' : 'Contraseña actual'}
            </label>
            <Input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {lang === 'en' ? 'Authenticator code' : 'Código autenticador'}
            </label>
            <Input
              value={totpDisableInput}
              onChange={e => setTotpDisableInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              maxLength={8}
              className="font-mono w-40"
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={disableMFA} disabled={loading || !passwordInput || totpDisableInput.length < 6}>
              {loading ? '...' : (lang === 'en' ? 'Disable 2FA' : 'Desactivar 2FA')}
            </Button>
            <Button variant="outline" onClick={() => setPhase('idle')}>
              {lang === 'en' ? 'Cancel' : 'Cancelar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

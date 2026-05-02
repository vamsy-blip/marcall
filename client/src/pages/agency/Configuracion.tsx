import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function Configuracion() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: dash } = useQuery<any>({ queryKey: ['/api/agency/dashboard'] });
  const reseller = dash?.reseller || {};

  const [form, setForm] = useState({
    contactEmail: '',
    payoutClabe: '',
    payoutAccountHolder: '',
    payoutRfc: '',
  });

  useEffect(() => {
    setForm({
      contactEmail: reseller.contactEmail || '',
      payoutClabe: '',
      payoutAccountHolder: reseller.payoutAccountHolder || '',
      payoutRfc: reseller.payoutRfc || '',
    });
  }, [reseller.contactEmail, reseller.payoutAccountHolder, reseller.payoutRfc]);

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        contactEmail: form.contactEmail,
        payoutAccountHolder: form.payoutAccountHolder,
        payoutRfc: form.payoutRfc,
      };
      if (form.payoutClabe.trim()) body.payoutClabe = form.payoutClabe.trim();
      const res = await apiRequest('PATCH', '/api/agency/settings', body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/dashboard'] });
      toast({ title: t('agency.settings.saved', 'Configuración guardada') });
      setForm((f) => ({ ...f, payoutClabe: '' }));
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo guardar'), description: e.message, variant: 'destructive' }),
  });

  const clabeStored = !!reseller.payoutClabeLast4;

  return (
    <AgencyLayout title={t('agency.settings.title', 'Configuración')}>
      <div className="p-6 md:p-8 space-y-6 max-w-3xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('agency.settings.title', 'Configuración')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('agency.settings.sub', 'Datos de contacto y de pago de tu agencia.')}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('agency.settings.contact', 'Contacto')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('agency.settings.contactEmail', 'Correo de contacto')}</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                data-testid="input-contact-email"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              {t('agency.settings.payout', 'Datos de pago (cifrados)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('agency.settings.accountHolder', 'Titular de la cuenta')}</Label>
              <Input value={form.payoutAccountHolder} onChange={(e) => setForm({ ...form, payoutAccountHolder: e.target.value })} data-testid="input-account-holder" />
            </div>
            <div className="space-y-2">
              <Label>{t('agency.settings.rfc', 'RFC')}</Label>
              <Input value={form.payoutRfc} onChange={(e) => setForm({ ...form, payoutRfc: e.target.value.toUpperCase() })} maxLength={13} className="font-mono uppercase" data-testid="input-rfc" />
            </div>
            <div className="space-y-2">
              <Label>{t('agency.settings.clabe', 'CLABE (18 dígitos)')}</Label>
              <Input
                value={form.payoutClabe}
                onChange={(e) => setForm({ ...form, payoutClabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                placeholder={clabeStored ? `••••${reseller.payoutClabeLast4}` : '012345678901234567'}
                className="font-mono"
                data-testid="input-clabe"
              />
              <p className="text-xs text-muted-foreground">
                {clabeStored
                  ? t('agency.settings.clabeStored', 'CLABE registrada. Solo se mostrarán los últimos 4 dígitos. Escribe una nueva CLABE para reemplazarla.')
                  : t('agency.settings.clabeHelp', 'Se cifra antes de guardarse. Solo verás los últimos 4 dígitos.')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button disabled={save.isPending} onClick={() => save.mutate()} data-testid="button-save-settings">
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {t('common.save', 'Guardar')}
        </Button>
      </div>
    </AgencyLayout>
  );
}

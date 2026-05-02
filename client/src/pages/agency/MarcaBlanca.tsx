import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const SUBDOMAIN_RE = /^[a-z0-9-]+\.marcall\.careofaddress\.com$/i;

export default function MarcaBlanca() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: dash, isLoading } = useQuery<any>({ queryKey: ['/api/agency/dashboard'] });

  const reseller = dash?.reseller;
  const allowed = reseller?.whiteLabelAllowed ?? true;

  const [primary, setPrimary] = useState('#3F5E4D');
  const [logoUrl, setLogoUrl] = useState('');
  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    if (reseller) {
      setPrimary(reseller.brandingPrimaryColor || '#3F5E4D');
      setLogoUrl(reseller.brandingLogoUrl || '');
      setSubdomain(reseller.customSubdomain || '');
    }
  }, [reseller]);

  const subdomainValid = !subdomain || SUBDOMAIN_RE.test(subdomain);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', '/api/agency/branding', {
        brandingPrimaryColor: primary,
        brandingLogoUrl: logoUrl || null,
        customSubdomain: subdomain || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/dashboard'] });
      toast({ title: t('agency.brand.saved', 'Marca actualizada') });
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo guardar'), description: e.message, variant: 'destructive' }),
  });

  return (
    <AgencyLayout title={t('agency.brand.title', 'Marca blanca')}>
      <div className="p-6 md:p-8 space-y-6 max-w-3xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('agency.brand.title', 'Marca blanca')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('agency.brand.sub', 'Personaliza cómo ven tus clientes el producto.')}</p>
        </header>

        {!allowed && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 text-sm flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground">{t('agency.brand.locked', 'Marca blanca no incluida')}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{t('agency.brand.lockedDesc', 'Esta función está disponible desde el plan Agencia. Contacta a soporte para activarla.')}</div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('agency.brand.identity', 'Identidad')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t('agency.brand.primaryColor', 'Color primario')}</Label>
              <div className="flex gap-2">
                <Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-16 p-1 h-10" data-testid="input-primary-color" />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('agency.brand.logoUrl', 'URL del logo')}</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.svg" data-testid="input-logo-url" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('agency.brand.subdomain', 'Subdominio personalizado')}</Label>
              <Input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                placeholder="agencia.marcall.careofaddress.com"
                className={`font-mono text-sm ${!subdomainValid ? 'border-destructive' : ''}`}
                data-testid="input-subdomain"
              />
              <p className="text-xs text-muted-foreground">
                {t('agency.brand.subdomainHelp', 'Formato: <slug>.marcall.careofaddress.com — solo letras minúsculas, dígitos y guiones.')}
              </p>
              {!subdomainValid && <p className="text-xs text-destructive">{t('agency.brand.subdomainInvalid', 'Subdominio inválido.')}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('agency.brand.preview', 'Vista previa')}</Label>
              <div
                className="rounded-lg border p-6 flex items-center gap-4"
                style={{ background: `linear-gradient(135deg, ${primary}15, transparent)` }}
              >
                <div className="w-12 h-12 rounded-md shrink-0" style={{ background: primary }} />
                <div>
                  <div className="font-display font-semibold">{reseller?.name || t('agency.brand.yourBrand', 'Tu Agencia')}</div>
                  <div className="text-xs text-muted-foreground">{t('agency.brand.poweredBy', 'Powered by MARCALL')}</div>
                  {subdomain && <div className="text-xs font-mono text-muted-foreground mt-1">{subdomain}</div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            disabled={!allowed || !subdomainValid || save.isPending}
            onClick={() => save.mutate()}
            data-testid="button-save-branding"
          >
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('common.save', 'Guardar')}
          </Button>
          {isLoading && <span className="text-sm text-muted-foreground">{t('common.loading', 'Cargando…')}</span>}
          {allowed && <Badge variant="secondary" className="text-[10px] uppercase">{t('agency.brand.allowed', 'Marca blanca activa')}</Badge>}
        </div>
      </div>
    </AgencyLayout>
  );
}

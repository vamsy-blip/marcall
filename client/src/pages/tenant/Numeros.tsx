import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Plus, ShieldCheck, Clock, AlertCircle, XCircle } from 'lucide-react';
import { Trans } from 'react-i18next';

const KYC_BADGE: Record<string, { color: string; icon: any }> = {
  na: { color: 'bg-muted text-muted-foreground', icon: ShieldCheck },
  pending: { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: Clock },
  approved: { color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: ShieldCheck },
  rejected: { color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20', icon: XCircle },
};

export default function Numeros() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('MX');
  const [areaCode, setAreaCode] = useState('');

  const { data: numbers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'numbers'],
    enabled: !!tid,
  });

  const requestNumber = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/tenants/${tid}/numbers`, {
        country,
        kind: country === 'MX' ? 'mx_managed' : 'demo_us',
        kycStatus: country === 'MX' ? 'pending' : 'na',
        e164: '',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'numbers'] });
      toast({ title: t('common.saved') });
      setShowWizard(false);
      setStep(1);
      setAreaCode('');
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  return (
    <TenantLayout title={t('tenant.numeros.title')}>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.numeros.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('tenant.numeros.subtitle')}</p>
          </div>
          <Button onClick={() => setShowWizard(true)} data-testid="button-request-number">
            <Plus className="size-4 mr-1.5" /> {t('tenant.numeros.request')}
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-48" />
        ) : numbers.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-16 text-center">
              <Phone className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="text-sm text-muted-foreground mb-4">{t('tenant.numeros.empty')}</div>
              <Button onClick={() => setShowWizard(true)} data-testid="button-request-number-empty">
                <Plus className="size-4 mr-1.5" /> {t('tenant.numeros.request')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-card-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {numbers.map((n: any) => {
                  const kycBadge = KYC_BADGE[n.kycStatus || 'na'];
                  const Icon = kycBadge.icon;
                  return (
                    <div key={n.id} className="p-5 flex items-center justify-between gap-4 flex-wrap" data-testid={`number-${n.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Phone className="size-4 text-muted-foreground" />
                          <span className="font-mono font-semibold text-base" data-testid={`text-e164-${n.id}`}>{n.e164 || <span className="italic text-muted-foreground font-normal">{t('tenant.numeros.numberPending')}</span>}</span>
                          <Badge variant="outline" className="text-[10px]">{String(t(`tenant.numeros.kind${(n.kind || '').split('_').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`, (n.kind || '').replace('_', ' ')))}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{n.country}</div>
                      </div>
                      <Badge variant="outline" className={`${kycBadge.color} gap-1`}>
                        <Icon className="size-3" />
                        {n.kycStatus === 'na' ? '—' : t(`tenant.numeros.kyc${n.kycStatus.charAt(0).toUpperCase() + n.kycStatus.slice(1)}`)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC tracker for MX numbers in pending state */}
        {numbers.some((n: any) => n.country === 'MX' && n.kycStatus === 'pending') && (
          <Card className="border-card-border bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{t('tenant.numeros.kycBannerTitle')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Trans
                      i18nKey="tenant.numeros.kycBannerBody"
                      components={[
                        <a key="0" href={`mailto:support@careofaddress.com?subject=KYC%20documents%20-%20Tenant%20${tid ?? ''}`} className="underline" />,
                      ]}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenant.numeros.request')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <Label>{t('tenant.numeros.wizardCountry')}</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="mt-1.5" data-testid="select-country"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MX">🇲🇽 México</SelectItem>
                      <SelectItem value="US">🇺🇸 Estados Unidos (demo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('tenant.numeros.wizardArea')}</Label>
                  <Input
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder={country === 'MX' ? '81, 55, 33' : '212, 415'}
                    className="mt-1.5"
                    data-testid="input-area-code"
                  />
                </div>
                {country === 'MX' && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                    <div className="font-semibold mb-1">⚠ {t('tenant.numeros.wizardKyc')}</div>
                    <p className="text-muted-foreground">{t('tenant.numeros.wizardKycHint')}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWizard(false)} data-testid="button-cancel-wizard">{t('common.cancel')}</Button>
            <Button onClick={() => requestNumber.mutate()} disabled={requestNumber.isPending} data-testid="button-confirm-request">
              {t('common.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}

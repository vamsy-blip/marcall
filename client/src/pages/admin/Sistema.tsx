import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from '@/components/ui/table';
import { Loader2, CheckCircle2, AlertCircle, XCircle, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

function StatusIcon({ status }: { status: string }) {
  if (status === 'live' || status === 'ok' || status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (status === 'degraded') return <AlertCircle className="w-4 h-4 text-amber-600" />;
  if (status === 'down' || status === 'error') return <XCircle className="w-4 h-4 text-destructive" />;
  return <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />;
}

function badgeVariant(status: string): 'default' | 'destructive' | 'secondary' {
  if (status === 'live' || status === 'healthy' || status === 'ok') return 'default';
  if (status === 'down' || status === 'error') return 'destructive';
  return 'secondary';
}

export default function Sistema() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [purgeResult, setPurgeResult] = useState<any>(null);

  const { data: sys } = useQuery<any>({ queryKey: ['/api/system'] });
  const { data: health, isLoading } = useQuery<any>({ queryKey: ['/api/admin/system/health'] });

  const services: Array<{ name: string; status: string; detail?: string; latencyMs?: number | null; statusPage?: string }> = health?.services || [];
  const warnings: Array<{ code: string; severity: 'error' | 'warning'; message: string }> = health?.warnings || [];
  const prices = sys?.stripePricesConfigured || {};
  const stripeMode = sys?.stripeMode || health?.stripeMode || 'mock';
  const isMock = stripeMode !== 'live';

  const purge = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/cron/purge-now', {});
      return res.json();
    },
    onSuccess: (r) => {
      setPurgeResult(r);
      toast({
        title: t('admin.system.purgeOk', 'Purga ejecutada'),
        description: `${r.eligible || 0} grabaciones elegibles · ${r.scanned || 0} escaneadas`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system/health'] });
    },
    onError: (err: any) => {
      toast({ title: t('common.error', 'Error'), description: err?.message || 'Failed', variant: 'destructive' });
    },
  });

  return (
    <AdminLayout title={t('admin.system.title', 'Sistema')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.system.title', 'Sistema')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.system.sub', 'Estado de los conectores externos.')}</p>
        </header>

        {warnings.length > 0 && (
          <div className="space-y-2" data-testid="warnings-panel">
            {warnings.map((w) => {
              const isError = w.severity === 'error';
              return (
                <Card
                  key={w.code}
                  className={isError
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-amber-500/40 bg-amber-500/5'}
                  data-testid={`warning-${w.code}`}
                >
                  <CardContent className="p-4 flex items-start gap-3 text-sm">
                    {isError
                      ? <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <div className="font-medium">
                        <code className="text-xs bg-background/50 px-1 py-0.5 rounded mr-2">{w.code}</code>
                        <span className="capitalize">{isError ? t('common.error', 'Error') : t('common.warning', 'Aviso')}</span>
                      </div>
                      <div className="text-muted-foreground text-xs mt-1">{w.message}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {isMock && (
          <Card className="border-amber-500/40 bg-amber-500/5" data-testid="banner-mock-mode">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{t('admin.system.mockBannerTitle', 'Modo simulado')}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {t('admin.system.mockBannerDesc', 'Las operaciones de Stripe (cancelación, reembolso, reintento) se simulan en la base de datos. Configura STRIPE_SECRET_KEY y reinicia para activar producción.')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.system.servicesHealth', 'Salud de servicios')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : services.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">{t('admin.system.noServices', 'Health checks no conectados aún.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.system.service', 'Servicio')}</TableHead>
                    <TableHead className="w-32">{t('common.status', 'Estado')}</TableHead>
                    <TableHead className="w-24 text-right">{t('admin.system.latency', 'Latencia')}</TableHead>
                    <TableHead>{t('admin.system.detail', 'Detalle')}</TableHead>
                    <TableHead className="w-32 text-right">{t('admin.system.statusPage', 'Status page')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.name} data-testid={`row-service-${s.name}`}>
                      <TableCell className="font-medium capitalize">{s.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <StatusIcon status={s.status} />
                          <Badge variant={badgeVariant(s.status)}>{s.status}</Badge>
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground" data-testid={`text-latency-${s.name}`}>
                        {typeof s.latencyMs === 'number' ? `${s.latencyMs} ms` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.detail || '—'}</TableCell>
                      <TableCell className="text-right">
                        {s.statusPage ? (
                          <a
                            href={s.statusPage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                            data-testid={`link-statuspage-${s.name}`}
                          >
                            {t('admin.system.open', 'Abrir')}<ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.system.integrationMode', 'Modo de integración')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Modo</div>
                <Badge variant={sys?.mode === 'live' ? 'default' : 'secondary'} className="mt-1.5">{sys?.mode || 'mock'}</Badge>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Stripe</div>
                <Badge variant={stripeMode === 'live' ? 'default' : 'secondary'} className="mt-1.5">{stripeMode}</Badge>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Vapi</div>
                <Badge variant={sys?.vapiConfigured ? 'default' : 'secondary'} className="mt-1.5">{sys?.vapiConfigured ? 'live' : 'mock'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.system.stripePrices', 'Precios Stripe configurados')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['inicia', 'crece', 'empresa', 'agencia'].map((p) => (
                <div key={p} className="flex items-center justify-between border rounded-md p-3">
                  <span className="text-sm capitalize">{p}</span>
                  <Badge variant={prices[p] ? 'default' : 'secondary'}>{prices[p] ? 'OK' : '—'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-3">
              <span>{t('admin.system.cronPurge', 'Retención de grabaciones')}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => purge.mutate()}
                disabled={purge.isPending}
                data-testid="button-run-cron-purge"
              >
                {purge.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                {t('admin.system.runPurgeNow', 'Ejecutar purga ahora')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs">
              {t('admin.system.cronPurgeDesc', 'Identifica y purga grabaciones que excedan el período de retención de cada tenant. Auditado.')}
            </p>
            {purgeResult && (
              <div className="grid grid-cols-3 gap-3 mt-3" data-testid="purge-result">
                <div className="border rounded-md p-3">
                  <div className="text-xs uppercase tracking-wider">Tenants</div>
                  <div className="text-lg font-semibold text-foreground mt-1">{purgeResult.tenants ?? 0}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs uppercase tracking-wider">{t('admin.system.scanned', 'Escaneadas')}</div>
                  <div className="text-lg font-semibold text-foreground mt-1">{purgeResult.scanned ?? 0}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs uppercase tracking-wider">{t('admin.system.eligible', 'Elegibles')}</div>
                  <div className="text-lg font-semibold text-foreground mt-1">{purgeResult.eligible ?? 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">{t('admin.system.activateLive', 'Para activar producción')}:</strong></p>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Define <code className="bg-muted px-1 rounded">MARCALL_INTEGRATION_MODE=live</code></li>
              <li>Configura <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code></li>
              <li>Define los price IDs: <code className="bg-muted px-1 rounded">STRIPE_PRICE_INICIA</code>, <code className="bg-muted px-1 rounded">STRIPE_PRICE_CRECE</code>, <code className="bg-muted px-1 rounded">STRIPE_PRICE_EMPRESA</code>, <code className="bg-muted px-1 rounded">STRIPE_PRICE_AGENCIA</code></li>
              <li>Reinicia el servidor</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

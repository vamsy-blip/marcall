import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, XCircle, Undo2, RefreshCw } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

function formatMxn(cents: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

export default function Suscripciones() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: sys } = useQuery<any>({ queryKey: ['/api/system'] });
  const stripeMode = sys?.stripeMode || 'mock';
  const isMock = stripeMode !== 'live';

  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/admin/subscriptions'] });
  const rows: any[] = Array.isArray(data) ? data : data?.rows || [];

  const [refundOpen, setRefundOpen] = useState<any>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');

  const cancel = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('POST', `/api/admin/subscriptions/${id}/cancel`, {});
      return r.json();
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      toast({ title: t('admin.subs.cancelled', 'Cancelación programada'), description: r.mode === 'mock' ? t('admin.subs.mockNote', 'Modo mock — Stripe no fue contactado.') : undefined });
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo cancelar'), description: e.message, variant: 'destructive' }),
  });

  const refund = useMutation({
    mutationFn: async ({ id, amountMxnCents, reason }: { id: number; amountMxnCents?: number; reason: string }) => {
      const body: any = { reason };
      if (amountMxnCents) body.amountMxnCents = amountMxnCents;
      const r = await apiRequest('POST', `/api/admin/subscriptions/${id}/refund`, body);
      return r.json();
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      toast({ title: t('admin.subs.refunded', 'Reembolso emitido'), description: r.mode === 'mock' ? t('admin.subs.mockNote', 'Modo mock — Stripe no fue contactado.') : `Refund ID: ${r.refundId}` });
      setRefundOpen(null); setRefundReason(''); setRefundAmount('');
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo reembolsar'), description: e.message, variant: 'destructive' }),
  });

  const retry = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('POST', `/api/admin/subscriptions/${id}/retry`, {});
      return r.json();
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      toast({ title: t('admin.subs.retried', 'Reintento enviado'), description: r.mode === 'mock' ? t('admin.subs.mockNote', 'Modo mock — Stripe no fue contactado.') : `Invoice: ${r.invoiceId}` });
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo reintentar'), description: e.message, variant: 'destructive' }),
  });

  return (
    <AdminLayout title={t('admin.subs.title', 'Suscripciones')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.subs.title', 'Suscripciones')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.subs.sub', 'Estado de Stripe por tenant.')}</p>
        </header>

        {isMock && (
          <Card className="border-amber-500/30 bg-amber-500/5" data-testid="banner-mock-stripe">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground">{t('admin.subs.mockBanner', 'Modo mock — operaciones de Stripe simuladas.')}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {t('admin.subs.mockBannerDesc', 'Configura STRIPE_SECRET_KEY en el entorno para que cancelaciones, reembolsos y reintentos golpeen Stripe en vivo.')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm" data-testid="empty-subs">
                {t('admin.subs.empty', 'Aún no hay suscripciones. Aparecerán aquí cuando los tenants se registren.')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>{t('admin.subs.period', 'Próximo cargo')}</TableHead>
                    <TableHead>Stripe ID</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.id} data-testid={`row-sub-${row.id}`}>
                      <TableCell className="font-medium">{row.tenantName || `Tenant #${row.tenantId}`}</TableCell>
                      <TableCell><Badge variant="outline">{row.planSlug || '—'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'active' ? 'default' : row.status === 'past_due' ? 'destructive' : 'secondary'}>
                          {row.status || 'trial'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatMxn(row.mrrMxnCents || row.priceMxnCents || 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString('es-MX') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.stripeSubId?.slice(0, 18) || '—'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {row.status === 'past_due' && (
                          <Button size="sm" variant="outline" onClick={() => retry.mutate(row.id)} disabled={retry.isPending} data-testid={`button-retry-${row.id}`}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('admin.subs.retry', 'Reintentar')}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setRefundOpen(row)} data-testid={`button-refund-${row.id}`}>
                          <Undo2 className="w-3.5 h-3.5 mr-1" /> {t('admin.subs.refund', 'Reembolsar')}
                        </Button>
                        {row.status !== 'cancel_pending' && row.status !== 'canceled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { if (confirm(t('admin.subs.confirmCancel', '¿Cancelar al final del periodo?'))) cancel.mutate(row.id); }}
                            disabled={cancel.isPending}
                            data-testid={`button-cancel-${row.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> {t('admin.subs.cancel', 'Cancelar')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!refundOpen} onOpenChange={(o) => { if (!o) { setRefundOpen(null); setRefundReason(''); setRefundAmount(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.subs.refundTitle', 'Reembolsar última factura')}</DialogTitle>
              <DialogDescription>
                {refundOpen?.tenantName} · {refundOpen?.stripeSubId?.slice(0, 18) || '—'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('admin.subs.refundReason', 'Motivo')}</Label>
                <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required data-testid="input-refund-reason" />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.subs.refundAmount', 'Monto en centavos MXN (vacío = total)')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Total"
                  data-testid="input-refund-amount"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRefundOpen(null); setRefundReason(''); setRefundAmount(''); }}>{t('common.cancel', 'Cancelar')}</Button>
              <Button
                disabled={!refundReason.trim() || refund.isPending}
                onClick={() => refund.mutate({
                  id: refundOpen.id,
                  amountMxnCents: refundAmount ? parseInt(refundAmount, 10) : undefined,
                  reason: refundReason.trim(),
                })}
                data-testid="button-confirm-refund"
              >
                {refund.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('admin.subs.refund', 'Reembolsar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

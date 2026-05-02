import { useQuery } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function formatMxn(cents: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

export default function Comisiones() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/agency/commissions'] });
  const { data: dash } = useQuery<any>({ queryKey: ['/api/agency/dashboard'] });

  const rateBps = dash?.reseller?.commissionRateBps ?? 2000;
  const months: any[] = data?.months || data?.history || [];
  const summary = data?.summary || {};

  return (
    <AgencyLayout title={t('agency.commissions.title', 'Comisiones')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('agency.commissions.title', 'Comisiones')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {(rateBps / 100).toFixed(0)}% {t('agency.commissions.sub', 'recurrente sobre cada suscripción activa.')}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('agency.commissions.mtd', 'Comisión MTD')}</span>
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="font-display text-2xl font-semibold mt-3" data-testid="stat-mtd">{formatMxn(summary.mtdCents ?? data?.mtdCents ?? 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('agency.commissions.lastPaid', 'Último pago')}</span>
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div className="font-display text-2xl font-semibold mt-3" data-testid="stat-last-paid">{formatMxn(summary.lastPaidCents ?? 0)}</div>
              {summary.lastPaidAt && <div className="text-xs text-muted-foreground mt-1">{new Date(summary.lastPaidAt).toLocaleDateString('es-MX')}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('agency.commissions.lifetime', 'Acumulado')}</span>
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="font-display text-2xl font-semibold mt-3" data-testid="stat-lifetime">{formatMxn(summary.lifetimeCents ?? 0)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('agency.commissions.history', 'Historial mensual')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : months.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('agency.commissions.empty', 'Aún no hay comisiones registradas.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('agency.commissions.month', 'Mes')}</TableHead>
                    <TableHead>{t('agency.commissions.activeSubs', 'Suscripciones activas')}</TableHead>
                    <TableHead>{t('agency.commissions.gross', 'MRR clientes')}</TableHead>
                    <TableHead>{t('agency.commissions.commission', 'Comisión')}</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m: any, i: number) => (
                    <TableRow key={m.id || m.month || i} data-testid={`row-month-${m.month || i}`}>
                      <TableCell className="font-medium">{m.month || m.label}</TableCell>
                      <TableCell>{m.subs ?? m.activeSubs ?? '—'}</TableCell>
                      <TableCell>{formatMxn(m.grossCents ?? m.mrrCents ?? 0)}</TableCell>
                      <TableCell className="font-display font-semibold">{formatMxn(m.commissionCents ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'paid' ? 'default' : 'secondary'}>{m.status || 'pending'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {t('agency.commissions.payoutNote', 'Las comisiones se pagan el día 5 de cada mes a la cuenta CLABE registrada en Configuración.')}
          </CardContent>
        </Card>
      </div>
    </AgencyLayout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Search } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function Auditoria() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/audit', { search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await apiRequest('GET', `/api/admin/audit?${params}`);
      return res.json();
    },
  });

  const rows: any[] = Array.isArray(data) ? data : data?.rows || [];

  const verify = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/audit/verify', {});
      return res.json();
    },
    onSuccess: (r) => {
      setVerifyResult(r);
      toast({
        title: r.verified ? t('admin.audit.verified', 'Cadena íntegra') : t('admin.audit.broken', 'Cadena rota'),
        description: r.note || `${r.rowsChecked ?? 0} filas`,
        variant: r.verified ? 'default' : 'destructive',
      });
    },
  });

  return (
    <AdminLayout title={t('admin.audit.title', 'Auditoría')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.audit.title', 'Auditoría')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('admin.audit.sub', 'Bitácora hash-chained de todas las acciones administrativas.')}</p>
          </div>
          <Button onClick={() => verify.mutate()} disabled={verify.isPending} data-testid="button-verify-chain">
            {verify.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            {t('admin.audit.verifyChain', 'Verificar cadena')}
          </Button>
        </header>

        {verifyResult && (
          <Card className={verifyResult.verified ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'} data-testid="card-verify-result">
            <CardContent className="p-4 text-sm flex items-start gap-3">
              <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${verifyResult.verified ? 'text-emerald-600' : 'text-destructive'}`} />
              <div className="flex-1 space-y-2">
                <div className="font-medium" data-testid="text-verify-status">
                  {verifyResult.verified
                    ? t('admin.audit.intact', 'Cadena íntegra')
                    : t('admin.audit.tampered', 'Cadena alterada')}
                </div>
                {verifyResult.note && (
                  <div className="text-muted-foreground text-xs">{verifyResult.note}</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="border rounded-md p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('admin.audit.rowsChecked', 'Filas revisadas')}</div>
                    <div className="font-mono text-sm mt-0.5" data-testid="text-rows-checked">{verifyResult.rowsChecked ?? 0}</div>
                  </div>
                  <div className="border rounded-md p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('admin.audit.lastEntry', 'Última entrada')}</div>
                    <div className="font-mono text-[11px] mt-0.5 truncate">
                      {verifyResult.lastEntryAt ? new Date(verifyResult.lastEntryAt).toLocaleString('es-MX') : '—'}
                    </div>
                  </div>
                  {!verifyResult.verified && (
                    <>
                      <div className="border rounded-md p-2 border-destructive/30">
                        <div className="text-[10px] uppercase tracking-wider text-destructive">{t('admin.audit.firstBreak', 'Ruptura en ID')}</div>
                        <div className="font-mono text-sm mt-0.5" data-testid="text-first-break">{verifyResult.firstBreakAtId ?? '—'}</div>
                      </div>
                      <div className="border rounded-md p-2 border-destructive/30">
                        <div className="text-[10px] uppercase tracking-wider text-destructive">{t('admin.audit.breakReason', 'Motivo')}</div>
                        <div className="text-[11px] mt-0.5" data-testid="text-break-reason">{verifyResult.breakReason || '—'}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-muted-foreground text-[11px] pt-1">
                  {t('admin.audit.lastChecked', 'Última verificación')}:{' '}
                  {verifyResult.lastChecked && new Date(verifyResult.lastChecked).toLocaleString('es-MX')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('admin.audit.searchPh', 'Filtrar por acción, recurso o usuario…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-audit"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('admin.audit.empty', 'Sin eventos.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date', 'Fecha')}</TableHead>
                    <TableHead>{t('admin.audit.actor', 'Actor')}</TableHead>
                    <TableHead>{t('admin.audit.action', 'Acción')}</TableHead>
                    <TableHead>{t('admin.audit.resource', 'Recurso')}</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 200).map((row: any) => (
                    <TableRow key={row.id} data-testid={`row-audit-${row.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString('es-MX') : '—'}</TableCell>
                      <TableCell className="text-sm">{row.actorEmail || row.actorUserId || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{row.action}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.resource || row.resourceType}{row.resourceId ? ` #${row.resourceId}` : ''}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{row.ip || '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{(row.hash || '').slice(0, 10) || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

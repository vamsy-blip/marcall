import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Pause, Play, LogIn } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function Tenants() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [plan, setPlan] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/tenants', { search, status, plan, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      if (plan !== 'all') params.set('plan', plan);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiRequest('GET', `/api/admin/tenants?${params}`);
      return res.json();
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [suspendTenant, setSuspendTenant] = useState<any>(null);
  const [reason, setReason] = useState('');
  const suspend = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest('POST', `/api/admin/tenants/${id}/suspend`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: t('admin.tenants.suspended', 'Tenant suspendido') });
      setSuspendTenant(null);
      setReason('');
    },
  });
  const unsuspend = useMutation({
    mutationFn: async (id: number) => apiRequest('POST', `/api/admin/tenants/${id}/unsuspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({ title: t('admin.tenants.unsuspended', 'Tenant reactivado') });
    },
  });

  const impersonate = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest('POST', '/api/admin/impersonate', { tenantId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.tenants.impersonating', 'Sesión iniciada como tenant') });
      // Hard-redirect to tenant app — session cookies were rotated server-side
      window.location.hash = '#/app';
      window.location.reload();
    },
    onError: (err: any) => {
      toast({ title: t('common.error', 'Error'), description: err?.message || 'Failed', variant: 'destructive' });
    },
  });

  return (
    <AdminLayout title={t('admin.tenants.title', 'Tenants')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.tenants.title', 'Tenants')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('admin.tenants.sub', 'Todos los negocios bajo MARCALL.')} {total > 0 && <span className="ml-1">({total})</span>}
          </p>
        </header>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('admin.tenants.searchPlaceholder', 'Buscar por nombre o slug…')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
                data-testid="input-search-tenants"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40" data-testid="select-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all', 'Todos')}</SelectItem>
                <SelectItem value="active">{t('common.active', 'Activo')}</SelectItem>
                <SelectItem value="trial">{t('common.trial', 'Prueba')}</SelectItem>
                <SelectItem value="suspended">{t('common.suspended', 'Suspendido')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
              <SelectTrigger className="w-40" data-testid="select-plan"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all', 'Todos')}</SelectItem>
                <SelectItem value="inicia">Inicia</SelectItem>
                <SelectItem value="crece">Crece</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
                <SelectItem value="agencia">Agencia</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('admin.tenants.empty', 'Sin tenants que coincidan.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Nombre')}</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                    <TableHead>{t('admin.tenants.reseller', 'Agencia')}</TableHead>
                    <TableHead>{t('admin.tenants.created', 'Creado')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.id} data-testid={`row-tenant-${row.id}`}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.slug}</TableCell>
                      <TableCell><Badge variant="outline">{row.planSlug || '—'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={row.suspended ? 'destructive' : row.status === 'active' ? 'default' : 'secondary'}>
                          {row.suspended ? t('common.suspended', 'Suspendido') : row.status || 'trial'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.resellerName || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString('es-MX') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => impersonate.mutate(row.id)}
                            disabled={impersonate.isPending}
                            data-testid={`button-impersonate-${row.id}`}
                          >
                            <LogIn className="w-3.5 h-3.5 mr-1" /> {t('admin.tenants.impersonate', 'Impersonar')}
                          </Button>
                          {row.suspended ? (
                            <Button size="sm" variant="outline" onClick={() => unsuspend.mutate(row.id)} data-testid={`button-unsuspend-${row.id}`}>
                              <Play className="w-3.5 h-3.5 mr-1" /> {t('admin.tenants.unsuspend', 'Reactivar')}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setSuspendTenant(row)} data-testid={`button-suspend-${row.id}`}>
                              <Pause className="w-3.5 h-3.5 mr-1" /> {t('admin.tenants.suspend', 'Suspender')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('common.page', 'Página')} {page} {t('common.of', 'de')} {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="button-prev-page">{t('common.prev', 'Anterior')}</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} data-testid="button-next-page">{t('common.next', 'Siguiente')}</Button>
            </div>
          </div>
        )}

        <Dialog open={!!suspendTenant} onOpenChange={(o) => !o && setSuspendTenant(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.tenants.suspendTitle', 'Suspender tenant')}</DialogTitle>
              <DialogDescription>
                {t('admin.tenants.suspendDesc', 'El tenant no podrá iniciar sesión ni recibir llamadas hasta que se reactive.')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('admin.tenants.reason', 'Motivo')}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required data-testid="input-suspend-reason" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendTenant(null)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button
                disabled={!reason.trim() || suspend.isPending}
                onClick={() => suspend.mutate({ id: suspendTenant.id, reason: reason.trim() })}
                data-testid="button-confirm-suspend"
              >
                {suspend.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {t('admin.tenants.suspend', 'Suspender')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

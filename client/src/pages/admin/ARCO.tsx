import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function ARCO() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['/api/admin/arco'] });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest('PATCH', `/api/admin/arco/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/arco'] });
      toast({ title: t('admin.arco.updated', 'Solicitud actualizada') });
    },
  });

  return (
    <AdminLayout title={t('admin.arco.title', 'Solicitudes ARCO')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="w-5 h-5 text-primary" />
            {t('admin.arco.title', 'Solicitudes ARCO')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.arco.sub', 'Acceso, Rectificación, Cancelación, Oposición — Aviso de Privacidad LFPDPPP.')}</p>
        </header>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : data.length === 0 ? (
              <div className="p-16 text-center">
                <Shield className="w-12 h-12 mx-auto text-primary/40 mb-3" />
                <p className="text-muted-foreground">{t('admin.arco.empty', 'Sin solicitudes pendientes.')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.email', 'Correo')}</TableHead>
                    <TableHead>{t('admin.arco.kind', 'Tipo')}</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                    <TableHead>{t('common.date', 'Fecha')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row: any) => (
                    <TableRow key={row.id} data-testid={`row-arco-${row.id}`}>
                      <TableCell className="text-sm">{row.email || row.requesterEmail || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase">{row.kind || row.requestType}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'fulfilled' ? 'default' : row.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {row.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString('es-MX') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select value={row.status || 'pending'} onValueChange={(v) => updateStatus.mutate({ id: row.id, status: v })}>
                          <SelectTrigger className="w-36 ml-auto" data-testid={`select-arco-status-${row.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t('admin.arco.status.pending', 'Pendiente')}</SelectItem>
                            <SelectItem value="in_progress">{t('admin.arco.status.in_progress', 'En proceso')}</SelectItem>
                            <SelectItem value="fulfilled">{t('admin.arco.status.fulfilled', 'Atendida')}</SelectItem>
                            <SelectItem value="rejected">{t('admin.arco.status.rejected', 'Rechazada')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
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

import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function KYC() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: queue = [], isLoading } = useQuery<any[]>({ queryKey: ['/api/admin/kyc-queue'] });

  const approve = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/admin/kyc/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/kyc-queue'] });
      toast({ title: t('admin.kyc.approved', 'Documento aprobado') });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/admin/kyc/${id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/kyc-queue'] });
      toast({ title: t('admin.kyc.rejected', 'Documento rechazado') });
    },
  });

  return (
    <AdminLayout title={t('admin.kyc.title', 'KYC')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.kyc.title', 'Cola de KYC')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.kyc.sub', 'Documentos pendientes de revisión.')}</p>
        </header>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : queue.length === 0 ? (
              <div className="p-16 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-primary/40 mb-3" />
                <p className="text-muted-foreground">{t('admin.kyc.empty', 'Cola vacía. Todo al día.')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.kyc.number', 'Número')}</TableHead>
                    <TableHead>{t('admin.kyc.kind', 'Tipo')}</TableHead>
                    <TableHead>{t('admin.kyc.country', 'País')}</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((doc) => (
                    <TableRow key={doc.id} data-testid={`row-kyc-${doc.id}`}>
                      <TableCell className="font-mono text-sm font-medium">{doc.e164 || `Tenant #${doc.tenantId}`}</TableCell>
                      <TableCell><Badge variant="outline">{doc.kind || 'mx_managed'}</Badge></TableCell>
                      <TableCell className="text-sm">{doc.country || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.tenantId}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => reject.mutate(doc.id)} disabled={reject.isPending} data-testid={`button-reject-${doc.id}`}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> {t('admin.kyc.reject', 'Rechazar')}
                        </Button>
                        <Button size="sm" onClick={() => approve.mutate(doc.id)} disabled={approve.isPending} data-testid={`button-approve-${doc.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t('admin.kyc.approve', 'Aprobar')}
                        </Button>
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

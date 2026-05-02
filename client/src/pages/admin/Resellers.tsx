import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, Copy } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function Resellers() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: resellers = [], isLoading } = useQuery<any[]>({ queryKey: ['/api/admin/resellers'] });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [commissionPct, setCommissionPct] = useState(20);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/resellers', {
        name,
        contactEmail,
        commissionRateBps: Math.round(commissionPct * 100),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resellers'] });
      toast({ title: t('admin.resellers.created', 'Agencia creada'), description: data?.apiKey ? `API key: ${data.apiKey}` : '' });
      setOpen(false);
      setName(''); setContactEmail(''); setCommissionPct(20);
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo guardar'), description: e.message, variant: 'destructive' }),
  });

  return (
    <AdminLayout title={t('admin.resellers.title', 'Resellers')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.resellers.title', 'Resellers')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('admin.resellers.sub', 'Partners y agencias revendedoras.')}</p>
          </div>
          <Button onClick={() => setOpen(true)} data-testid="button-create-reseller">
            <Plus className="w-4 h-4 mr-2" /> {t('admin.resellers.new', 'Nueva agencia')}
          </Button>
        </header>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : resellers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('admin.resellers.empty', 'Sin agencias registradas.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Nombre')}</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>{t('common.email', 'Correo')}</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                    <TableHead>{t('admin.resellers.commission', 'Comisión')}</TableHead>
                    <TableHead>API key</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellers.map((r) => (
                    <TableRow key={r.id} data-testid={`row-reseller-${r.id}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.slug}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contactEmail || '—'}</TableCell>
                      <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status || 'active'}</Badge></TableCell>
                      <TableCell>{((r.commissionRateBps ?? 2000) / 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        {r.apiKey ? (
                          <button
                            onClick={() => { navigator.clipboard.writeText(r.apiKey); toast({ title: 'API key copiada' }); }}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            data-testid={`button-copy-key-${r.id}`}
                          >
                            <Copy className="w-3 h-3" /> {r.apiKey.slice(0, 12)}…
                          </button>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.resellers.new', 'Nueva agencia')}</DialogTitle>
              <DialogDescription>{t('admin.resellers.newDesc', 'Crea un partner revendedor con su slug y comisión.')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.name', 'Nombre')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-reseller-name" />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.resellers.contactEmail', 'Correo de contacto')}</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} data-testid="input-reseller-email" />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.resellers.commissionPct', 'Comisión (%)')}</Label>
                <Input type="number" min={0} max={50} value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} data-testid="input-reseller-commission" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} data-testid="button-confirm-create">
                {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('common.save', 'Guardar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

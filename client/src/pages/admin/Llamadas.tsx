import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from './AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';

export default function Llamadas() {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/calls', { outcome, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (outcome !== 'all') params.set('outcome', outcome);
      if (search) params.set('search', search);
      const res = await apiRequest('GET', `/api/admin/calls?${params}`);
      return res.json();
    },
  });

  const rows: any[] = Array.isArray(data) ? data : data?.rows || [];

  return (
    <AdminLayout title={t('admin.calls.title', 'Llamadas')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header>
          <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('admin.calls.title', 'Llamadas')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.calls.sub', 'Llamadas globales — todos los tenants.')}</p>
        </header>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('admin.calls.searchPh', 'Buscar por teléfono o tenant…')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-calls" />
            </div>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-44" data-testid="select-outcome"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all', 'Todos')}</SelectItem>
                <SelectItem value="appointment">{t('admin.calls.outcome.appointment', 'Cita')}</SelectItem>
                <SelectItem value="message">{t('admin.calls.outcome.message', 'Recado')}</SelectItem>
                <SelectItem value="lead">{t('admin.calls.outcome.lead', 'Lead')}</SelectItem>
                <SelectItem value="transfer">{t('admin.calls.outcome.transfer', 'Transferencia')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('admin.calls.empty', 'Sin llamadas.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>{t('common.phone', 'Teléfono')}</TableHead>
                    <TableHead>{t('common.duration', 'Duración')}</TableHead>
                    <TableHead>{t('admin.calls.outcomeCol', 'Resultado')}</TableHead>
                    <TableHead>{t('common.date', 'Fecha')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((c: any) => (
                    <TableRow key={c.id} data-testid={`row-call-${c.id}`}>
                      <TableCell className="text-sm">{c.tenantName || `Tenant #${c.tenantId}`}</TableCell>
                      <TableCell className="font-mono text-sm">{c.callerPhone || c.fromE164 || '—'}</TableCell>
                      <TableCell className="text-sm">{c.durationSec ? `${Math.round(c.durationSec / 60)} min` : '—'}</TableCell>
                      <TableCell><Badge variant="outline">{c.outcome || '—'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.startedAt ? new Date(c.startedAt).toLocaleString('es-MX') : '—'}</TableCell>
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

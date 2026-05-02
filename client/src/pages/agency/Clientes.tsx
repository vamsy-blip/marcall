import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

function formatMxn(cents: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

export default function Clientes() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading } = useQuery<any[]>({ queryKey: ['/api/agency/clients'] });
  const { data: dash } = useQuery<any>({ queryKey: ['/api/agency/dashboard'] });

  const filtered = clients.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const slug = dash?.reseller?.slug || 'agencia';
  const subdomain = dash?.reseller?.customSubdomain;
  const inviteUrl = subdomain
    ? `https://${subdomain}/#/signup?reseller=${slug}`
    : `${window.location.origin}${window.location.pathname}#/signup?reseller=${slug}`;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast({ title: t('agency.clients.copied', 'Link copiado al portapapeles') });
  };

  return (
    <AgencyLayout title={t('agency.clients.title', 'Clientes')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('agency.clients.title', 'Clientes')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} {t('agency.clients.under', 'bajo tu agencia.')}</p>
          </div>
          <Button onClick={copyInvite} variant="outline" data-testid="button-copy-invite">
            <Copy className="w-4 h-4 mr-2" /> {t('agency.clients.copyInvite', 'Copiar link de invitación')}
          </Button>
        </header>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('agency.clients.searchPh', 'Buscar cliente…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-clients"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('agency.clients.empty', 'Sin clientes. Comparte tu link de invitación para empezar.')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Nombre')}</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>{t('common.status', 'Estado')}</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>{t('agency.clients.commissionEst', 'Comisión est.')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const rateBps = dash?.reseller?.commissionRateBps ?? 2000;
                    const commission = (c.priceCents || c.priceMxnCents || 0) * (rateBps / 10000);
                    return (
                      <TableRow key={c.id} data-testid={`row-client-${c.id}`}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline">{c.planSlug || '—'}</Badge></TableCell>
                        <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status || 'trial'}</Badge></TableCell>
                        <TableCell>{formatMxn(c.priceCents || c.priceMxnCents || 0)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatMxn(commission)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AgencyLayout>
  );
}

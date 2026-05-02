import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, ShieldCheck, ShieldOff } from 'lucide-react';

const ROLES = [
  { id: 'tenant_owner', i18n: 'tenant.equipo.roleOwner' },
  { id: 'tenant_admin', i18n: 'tenant.equipo.roleAdmin' },
  { id: 'tenant_agent', i18n: 'tenant.equipo.roleAgent' },
  { id: 'tenant_viewer', i18n: 'tenant.equipo.roleViewer' },
];

export default function Equipo() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'tenant_agent' });

  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'team'],
    enabled: !!tid,
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/tenants/${tid}/team/invite`, inviteForm);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'team'] });
      toast({ title: t('tenant.equipo.inviteSent') });
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'tenant_agent' });
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  return (
    <TenantLayout title={t('tenant.equipo.title')}>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.equipo.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</p>
          </div>
          <Button onClick={() => setShowInvite(true)} data-testid="button-invite">
            <UserPlus className="size-4 mr-1.5" /> {t('tenant.equipo.invite')}
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : members.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-16 text-center">
              <Users className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="text-sm text-muted-foreground mb-4">{t('tenant.equipo.empty')}</div>
              <Button onClick={() => setShowInvite(true)} data-testid="button-invite-empty">
                <UserPlus className="size-4 mr-1.5" /> {t('tenant.equipo.invite')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-card-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left font-medium px-5 py-3">{t('tenant.equipo.name')}</th>
                      <th className="text-left font-medium px-5 py-3">{t('tenant.equipo.email')}</th>
                      <th className="text-left font-medium px-5 py-3">{t('tenant.equipo.role')}</th>
                      <th className="text-left font-medium px-5 py-3">{t('tenant.equipo.lastSeen')}</th>
                      <th className="text-left font-medium px-5 py-3">{t('tenant.equipo.mfa')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m: any) => {
                      const roleI18n = ROLES.find((r) => r.id === m.role)?.i18n || 'tenant.equipo.roleAgent';
                      return (
                        <tr key={m.id} data-testid={`row-member-${m.id}`}>
                          <td className="px-5 py-4 font-medium">{m.name || '—'}</td>
                          <td className="px-5 py-4 text-muted-foreground">{m.email}</td>
                          <td className="px-5 py-4"><Badge variant="outline">{t(roleI18n)}</Badge></td>
                          <td className="px-5 py-4 text-xs text-muted-foreground tabular-nums">
                            {m.lastLoginAt ? format(new Date(m.lastLoginAt), "d MMM, HH:mm", { locale: dateLocale }) : '—'}
                          </td>
                          <td className="px-5 py-4">
                            {m.mfaEnabled ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                                <ShieldCheck className="size-3" /> {t('tenant.equipo.mfaOn')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <ShieldOff className="size-3" /> {t('tenant.equipo.mfaOff')}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenant.equipo.invite')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('tenant.equipo.name')}</Label>
              <Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className="mt-1.5" data-testid="input-invite-name" />
            </div>
            <div>
              <Label>{t('tenant.equipo.email')}</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="mt-1.5" data-testid="input-invite-email" />
            </div>
            <div>
              <Label>{t('tenant.equipo.role')}</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger className="mt-1.5" data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{t(r.i18n)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)} data-testid="button-cancel-invite">{t('common.cancel')}</Button>
            <Button onClick={() => invite.mutate()} disabled={!inviteForm.email || invite.isPending} data-testid="button-send-invite">
              {t('tenant.equipo.invite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}

import { useState, useEffect } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Link } from 'wouter';
import { Building2, Palette, Bell, Languages, ShieldAlert, Monitor, KeyRound, Plus, Trash2, Copy, LogOut, Calendar as CalendarIcon, Receipt, CheckCircle2, XCircle, Loader2, ShieldCheck, Lock } from 'lucide-react';

export default function Configuracion() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tid = user?.currentTenantId;

  const [tab, setTab] = useState('empresa');

  return (
    <TenantLayout title={t('tenant.configuracion.title')}>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.configuracion.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('tenant.configuracion.subtitle')}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} data-testid="tabs-configuracion">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="empresa" data-testid="tab-empresa"><Building2 className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabEmpresa')}</TabsTrigger>
            <TabsTrigger value="marca" data-testid="tab-marca"><Palette className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabMarca')}</TabsTrigger>
            <TabsTrigger value="notificaciones" data-testid="tab-notificaciones"><Bell className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabNotificaciones')}</TabsTrigger>
            <TabsTrigger value="idioma" data-testid="tab-idioma"><Languages className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabIdioma')}</TabsTrigger>
            <TabsTrigger value="datos" data-testid="tab-datos"><ShieldAlert className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabDatos')}</TabsTrigger>
            <TabsTrigger value="sesiones" data-testid="tab-sesiones"><Monitor className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabSesiones')}</TabsTrigger>
            <TabsTrigger value="seguridad" data-testid="tab-seguridad"><ShieldCheck className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabSeguridad')}</TabsTrigger>
            <TabsTrigger value="api" data-testid="tab-api"><KeyRound className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabApi')}</TabsTrigger>
            <TabsTrigger value="integraciones" data-testid="tab-integraciones"><CalendarIcon className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabIntegraciones', 'Integraciones')}</TabsTrigger>
            <TabsTrigger value="fiscal" data-testid="tab-fiscal"><Receipt className="size-3.5 mr-1.5" />{t('tenant.configuracion.tabFiscal', 'Datos Fiscales')}</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa" className="mt-5"><EmpresaTab tid={tid} /></TabsContent>
          <TabsContent value="marca" className="mt-5"><MarcaTab tid={tid} /></TabsContent>
          <TabsContent value="notificaciones" className="mt-5"><NotificacionesTab /></TabsContent>
          <TabsContent value="idioma" className="mt-5"><IdiomaTab /></TabsContent>
          <TabsContent value="datos" className="mt-5"><DatosTab /></TabsContent>
          <TabsContent value="sesiones" className="mt-5"><SesionesTab /></TabsContent>
          <TabsContent value="seguridad" className="mt-5"><SeguridadTab /></TabsContent>
          <TabsContent value="api" className="mt-5"><ApiTab tid={tid} /></TabsContent>
          <TabsContent value="integraciones" className="mt-5"><IntegracionesTab tid={tid} /></TabsContent>
          <TabsContent value="fiscal" className="mt-5"><FiscalTab tid={tid} /></TabsContent>
        </Tabs>
      </div>
    </TenantLayout>
  );
}

// EMPRESA
function EmpresaTab({ tid }: { tid: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: tenant, isLoading } = useQuery<any>({ queryKey: ['/api/tenants', tid], enabled: !!tid });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (tenant) setForm(tenant); }, [tenant]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}`, form);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid] }); toast({ title: t('common.saved') }); },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>{t('tenant.configuracion.businessName')}</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="input-business-name" /></div>
        <div><Label>{t('tenant.configuracion.industry')}</Label><Input value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1.5" data-testid="input-industry" /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>{t('tenant.configuracion.timezone')}</Label>
          <Select value={form.timezone || 'America/Monterrey'} onValueChange={(v) => setForm({ ...form, timezone: v })}>
            <SelectTrigger className="mt-1.5" data-testid="select-timezone"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Monterrey">America/Monterrey</SelectItem>
              <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
              <SelectItem value="America/Tijuana">America/Tijuana</SelectItem>
              <SelectItem value="America/Cancun">America/Cancun</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t('tenant.configuracion.transferNumber')}</Label><Input value={form.transferNumber || ''} onChange={(e) => setForm({ ...form, transferNumber: e.target.value })} className="mt-1.5 font-mono" placeholder="+52..." data-testid="input-transfer" /></div>
      </div>
      <div><Label>{t('tenant.configuracion.address')}</Label><Input value={form.addressLine || ''} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="mt-1.5" data-testid="input-address" /></div>
      <div className="flex justify-end pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-empresa">{t('common.save')}</Button>
      </div>
    </CardContent></Card>
  );
}

// MARCA
function MarcaTab({ tid }: { tid: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: tenant, isLoading } = useQuery<any>({ queryKey: ['/api/tenants', tid], enabled: !!tid });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (tenant) setForm(tenant); }, [tenant]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}`, { logoUrl: form.logoUrl, primaryColor: form.primaryColor });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid] }); toast({ title: t('common.saved') }); },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-4">
      <div><Label>{t('tenant.configuracion.logoUrl')}</Label><Input value={form.logoUrl || ''} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." className="mt-1.5" data-testid="input-logo-url" /></div>
      <div>
        <Label>{t('tenant.configuracion.primaryColor')}</Label>
        <div className="flex items-center gap-3 mt-1.5">
          <Input type="color" value={form.primaryColor || '#516960'} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-20 h-10 p-1" data-testid="input-color" />
          <Input value={form.primaryColor || ''} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="font-mono" placeholder="#516960" />
        </div>
      </div>
      {form.logoUrl && (
        <div>
          <Label className="text-xs text-muted-foreground">{t('common.preview')}</Label>
          <div className="mt-2 p-4 rounded-md border border-card-border bg-muted/20">
            <img src={form.logoUrl} alt="Logo" className="h-10 max-w-[200px] object-contain" />
          </div>
        </div>
      )}
      <div className="flex justify-end pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-marca">{t('common.save')}</Button>
      </div>
    </CardContent></Card>
  );
}

// NOTIFICACIONES
function NotificacionesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: serverPrefs, isLoading } = useQuery<any>({ queryKey: ['/api/me/notification-prefs'] });
  const [prefs, setPrefs] = useState({ emailNewCall: true, emailNewAppt: true, emailDailyDigest: false, smsCritical: false });
  useEffect(() => { if (serverPrefs) setPrefs((p) => ({ ...p, ...serverPrefs })); }, [serverPrefs]);

  const save = useMutation({
    mutationFn: async (next: typeof prefs) => apiRequest('PUT', '/api/me/notification-prefs', next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/notification-prefs'] });
      toast({ title: t('common.saved') });
    },
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  if (isLoading) return <Card className="border-card-border"><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>;

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-1">
      {[
        { k: 'emailNewCall', label: t('tenant.configuracion.emailNewCall') },
        { k: 'emailNewAppt', label: t('tenant.configuracion.emailNewAppt') },
        { k: 'emailDailyDigest', label: t('tenant.configuracion.emailDailyDigest') },
        { k: 'smsCritical', label: t('tenant.configuracion.smsCritical') },
      ].map((p) => (
        <div key={p.k} className="flex items-center justify-between py-3 border-t border-border first:border-t-0">
          <Label htmlFor={p.k} className="font-normal">{p.label}</Label>
          <Switch id={p.k} checked={(prefs as any)[p.k]} onCheckedChange={(v) => setPrefs({ ...prefs, [p.k]: v })} data-testid={`switch-${p.k}`} />
        </div>
      ))}
      <div className="flex justify-end pt-3">
        <Button onClick={() => save.mutate(prefs)} disabled={save.isPending} data-testid="button-save-notificaciones">{t('common.save')}</Button>
      </div>
    </CardContent></Card>
  );
}

// IDIOMA
function IdiomaTab() {
  const { t } = useTranslation();
  const { lang, setLang } = useLang();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: async (newLang: 'es' | 'en') => {
      const res = await apiRequest('PATCH', '/api/auth/preferences', { preferredLanguage: newLang });
      return res.json();
    },
    onSuccess: () => toast({ title: t('common.saved') }),
  });

  const change = (v: 'es' | 'en') => {
    setLang(v);
    save.mutate(v);
  };

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-4">
      <div>
        <Label>{t('tenant.configuracion.defaultLang')}</Label>
        <div className="flex gap-2 mt-2">
          <Button variant={lang === 'es' ? 'default' : 'outline'} onClick={() => change('es')} data-testid="button-lang-es">🇲🇽 {t('common.spanish')}</Button>
          <Button variant={lang === 'en' ? 'default' : 'outline'} onClick={() => change('en')} data-testid="button-lang-en">🇺🇸 {t('common.english')}</Button>
        </div>
      </div>
    </CardContent></Card>
  );
}

// DATOS (privacy / ARCO)
function DatosTab() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const exportData = useMutation({
    mutationFn: async () => apiRequest('GET', '/api/me/data-export'),
    onSuccess: () => toast({ title: t('common.saved'), description: t('tenant.configuracion.exportInfo') }),
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const rectify = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/me/data-correction', { request: 'Solicitud de rectificación' }),
    onSuccess: () => toast({ title: t('common.saved') }),
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const deleteData = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/me/data-deletion', {}),
    onSuccess: () => toast({ title: t('common.saved'), description: t('tenant.configuracion.arcoDeleteDesc') }),
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  return (
    <Card className="border-card-border"><CardContent className="p-6 space-y-3">
      <p className="text-xs text-muted-foreground">
        Bajo la <a href="/#/legal/privacy" className="underline">Ley Federal de Protección de Datos Personales en Posesión de los Particulares</a> (LFPDPPP), tienes derechos ARCO: Acceso, Rectificación, Cancelación y Oposición. También puedes contactar <a href="mailto:privacy@careofaddress.com" className="underline">privacy@careofaddress.com</a>.
      </p>
      <div className="space-y-2 pt-3 border-t border-border">
        {/* Export */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start" data-testid="button-export">
              {t('tenant.configuracion.arcoExportCta')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tenant.configuracion.arcoExportTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('tenant.configuracion.arcoExportDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-export-cancel">{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => exportData.mutate()} data-testid="button-export-confirm">{t('common.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Rectify */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start" data-testid="button-rectify">
              {t('tenant.configuracion.arcoRectifyCta')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tenant.configuracion.arcoRectifyTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('tenant.configuracion.arcoRectifyDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-rectify-cancel">{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => rectify.mutate()} data-testid="button-rectify-confirm">{t('common.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-rose-600 dark:text-rose-400" data-testid="button-delete">
              {t('tenant.configuracion.arcoDeleteCta')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tenant.configuracion.arcoDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('tenant.configuracion.arcoDeleteDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-delete-cancel">{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteData.mutate()} className="bg-rose-600 hover:bg-rose-700" data-testid="button-delete-confirm">{t('common.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CardContent></Card>
  );
}

// SEGURIDAD (J-64) — links to MFA setup + sessions
function SeguridadTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mfaEnabled = !!(user as any)?.mfaEnabled;
  return (
    <div className="space-y-4">
      <Card className="border-card-border"><CardContent className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground">{t('tenant.configuracion.securityHint')}</p>
        <div className="flex items-start justify-between gap-4 pt-3 border-t border-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lock className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                {t('tenant.configuracion.securityMfaTitle')}
                {mfaEnabled && <Badge variant="outline" className="text-[10px]">{t('common.active')}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('tenant.configuracion.securityMfaDesc')}</p>
            </div>
          </div>
          <Link href="/app/security/mfa">
            <Button variant="outline" size="sm" data-testid="button-mfa-setup">{t('tenant.configuracion.securityMfaCta')}</Button>
          </Link>
        </div>
      </CardContent></Card>
      <SesionesTab />
    </div>
  );
}

// SESIONES
function SesionesTab() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useQuery<any[]>({ queryKey: ['/api/me/sessions'] });

  const revoke = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/me/sessions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/me/sessions'] }); toast({ title: t('common.saved') }); },
  });

  return (
    <Card className="border-card-border"><CardContent className="p-6">
      <p className="text-xs text-muted-foreground mb-4">{t('tenant.configuracion.sessionsHint')}</p>
      {isLoading ? <Skeleton className="h-32" /> :
        sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">{t('tenant.configuracion.noSessions')}</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-md border border-card-border" data-testid={`session-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {s.userAgent ? s.userAgent.split(' ')[0] : 'Dispositivo'}
                    {s.current && <Badge variant="outline" className="text-[10px]">{t('tenant.configuracion.thisDevice')}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.ipAddress || '—'} · {s.lastActiveAt ? format(new Date(s.lastActiveAt), "d MMM, HH:mm", { locale: dateLocale }) : '—'}
                  </div>
                </div>
                {!s.current && (
                  <Button variant="outline" size="sm" onClick={() => revoke.mutate(s.id)} data-testid={`button-revoke-session-${s.id}`}>
                    <LogOut className="size-3.5 mr-1.5" /> {t('tenant.configuracion.revokeSession')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
      }
    </CardContent></Card>
  );
}

// INTEGRACIONES (Google Calendar)
function IntegracionesTab({ tid }: { tid: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: sys } = useQuery<any>({ queryKey: ['/api/system'] });
  const googleConfigured = !!sys?.googleCalendarConfigured;

  const { data: integrations = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'integrations'],
    enabled: !!tid,
  });
  const google = integrations.find((i: any) => i.provider === 'google_calendar');
  const connected = google?.status === 'connected';

  const connect = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', `/api/integrations/google/authorize?tenant_id=${tid}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
      else toast({ title: t('common.saveError', 'No se pudo conectar'), variant: 'destructive' });
    },
    onError: () => toast({ title: t('common.saveError', 'No se pudo conectar'), variant: 'destructive' }),
  });

  const disconnect = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/integrations/google/disconnect`, { tenant_id: tid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'integrations'] });
      toast({ title: t('common.saved', 'Guardado') });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm">Google Calendar</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t('tenant.configuracion.googleCalendarDesc', 'Sincroniza automáticamente las citas creadas por MARCALL con tu calendario de Google.')}
                </div>
                {google?.externalId && (
                  <div className="text-[11px] font-mono text-muted-foreground mt-2 truncate">{google.externalId}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {connected ? (
                <>
                  <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" data-testid="badge-google-connected">
                    <CheckCircle2 className="size-3 mr-1" /> {t('common.connected', 'Conectado')}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} data-testid="button-google-disconnect">
                    {t('common.disconnect', 'Desconectar')}
                  </Button>
                </>
              ) : (
                <Button onClick={() => connect.mutate()} disabled={connect.isPending || !googleConfigured} data-testid="button-google-connect">
                  {connect.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                  {t('common.connect', 'Conectar')}
                </Button>
              )}
            </div>
          </div>
          {!googleConfigured && !connected && (
            <div className="mt-4 pt-4 border-t border-border text-xs text-amber-700 dark:text-amber-400" data-testid="text-google-not-configured">
              {t('tenant.configuracion.googleNotConfigured', 'El administrador no ha configurado las credenciales de Google. Contacta soporte.')}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && <Skeleton className="h-12" />}
    </div>
  );
}

// FISCAL (CFDI)
function FiscalTab({ tid }: { tid: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: fiscal, isLoading } = useQuery<any>({
    queryKey: ['/api/tenants', tid, 'fiscal'],
    enabled: !!tid,
  });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (fiscal) setForm(fiscal); }, [fiscal]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', `/api/tenants/${tid}/fiscal`, form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'fiscal'] });
      toast({ title: t('common.saved', 'Guardado') });
    },
    onError: (err: any) => {
      toast({
        title: t('common.saveError', 'Error al guardar'),
        description: err?.message || 'Verifica el RFC.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card className="border-card-border">
      <CardContent className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('tenant.configuracion.fiscalIntro', 'Tus datos fiscales se utilizan para emitir facturas CFDI 4.0 al SAT cuando se renueva tu suscripción. Los cambios se aplican a partir de la próxima factura.')}
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>{t('tenant.configuracion.rfc', 'RFC')}</Label>
            <Input
              value={form.rfc || ''}
              onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
              className="mt-1.5 font-mono uppercase"
              placeholder="XAXX010101000"
              maxLength={13}
              data-testid="input-rfc"
            />
          </div>
          <div>
            <Label>{t('tenant.configuracion.razonSocial', 'Razón social')}</Label>
            <Input
              value={form.razonSocial || ''}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              className="mt-1.5"
              data-testid="input-razon-social"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>{t('tenant.configuracion.regimenFiscal', 'Régimen fiscal')}</Label>
            <Select
              value={form.regimenFiscal || ''}
              onValueChange={(v) => setForm({ ...form, regimenFiscal: v })}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-regimen"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="601">601 — General de Ley Personas Morales</SelectItem>
                <SelectItem value="603">603 — Personas Morales con Fines no Lucrativos</SelectItem>
                <SelectItem value="605">605 — Sueldos y Salarios</SelectItem>
                <SelectItem value="606">606 — Arrendamiento</SelectItem>
                <SelectItem value="612">612 — Personas Físicas Actividades Empresariales</SelectItem>
                <SelectItem value="621">621 — Incorporación Fiscal</SelectItem>
                <SelectItem value="626">626 — Régimen Simplificado de Confianza (RESICO)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('tenant.configuracion.usoCfdi', 'Uso de CFDI')}</Label>
            <Select
              value={form.usoCfdi || ''}
              onValueChange={(v) => setForm({ ...form, usoCfdi: v })}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-uso-cfdi"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="G03">G03 — Gastos en general</SelectItem>
                <SelectItem value="P01">P01 — Por definir</SelectItem>
                <SelectItem value="S01">S01 — Sin efectos fiscales</SelectItem>
                <SelectItem value="CP01">CP01 — Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-fiscal">
            {save.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            {t('common.save', 'Guardar')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// API
function ApiTab({ tid }: { tid: any }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'api-keys'],
    enabled: !!tid,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/tenants/${tid}/api-keys`, { name: keyName, scopes: 'read,write' });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'api-keys'] });
      setCreatedSecret(data?.plaintext || data?.secret || null);
      setKeyName('');
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/tenants/${tid}/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'api-keys'] }),
  });

  const closeCreate = () => { setShowCreate(false); setCreatedSecret(null); setKeyName(''); };

  return (
    <>
      <Card className="border-card-border"><CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">Usa estas claves para integrar MARCALL con tu sistema. Documentación en <a href="https://docs.careofaddress.com" target="_blank" rel="noopener noreferrer" className="underline">docs.careofaddress.com</a>.</p>
          <Button onClick={() => setShowCreate(true)} size="sm" data-testid="button-new-key">
            <Plus className="size-4 mr-1.5" /> {t('tenant.configuracion.newKey')}
          </Button>
        </div>
        {isLoading ? <Skeleton className="h-32" /> :
          keys.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No tienes claves API. Crea la primera para empezar.</div>
          ) : (
            <div className="divide-y divide-border">
              {keys.map((k: any) => (
                <div key={k.id} className="py-3 flex items-center justify-between gap-3" data-testid={`apikey-${k.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{k.name}</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">{k.prefix}••••••••</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {t('tenant.configuracion.lastUsed')}: {k.lastUsedAt ? format(new Date(k.lastUsedAt), "d MMM, HH:mm", { locale: dateLocale }) : t('tenant.configuracion.neverUsed')}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-revoke-${k.id}`} aria-label={t('tenant.configuracion.revokeKey', 'Revocar clave')}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('tenant.configuracion.revokeKeyTitle', '¿Revocar la clave {{name}}?', { name: k.name })}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('tenant.configuracion.revokeKeyBody', 'Las integraciones que la usen dejarán de funcionar inmediatamente. Esta acción no se puede deshacer.')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revoke.mutate(k.id)} className="bg-rose-600 hover:bg-rose-700">
                          {t('common.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )
        }
      </CardContent></Card>

      <Dialog open={showCreate} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenant.configuracion.newKey')}</DialogTitle>
          </DialogHeader>
          {!createdSecret ? (
            <>
              <div>
                <Label>{t('tenant.configuracion.keyName')}</Label>
                <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Producción" className="mt-1.5" data-testid="input-key-name" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate} data-testid="button-cancel-key">{t('common.cancel')}</Button>
                <Button onClick={() => create.mutate()} disabled={!keyName || create.isPending} data-testid="button-create-key">{t('common.save')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t('tenant.configuracion.copySecret')}</p>
                <div className="rounded-md border border-card-border bg-muted/30 p-3 font-mono text-xs break-all" data-testid="text-new-secret">
                  {createdSecret}
                </div>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdSecret); toast({ title: 'Copiado' }); }} className="w-full" data-testid="button-copy-secret">
                  <Copy className="size-3.5 mr-1.5" /> Copiar
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeCreate} data-testid="button-done-key">{t('common.close')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


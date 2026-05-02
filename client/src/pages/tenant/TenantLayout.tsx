import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { MarcallWordmark } from '@/components/Brand';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageToggle } from '@/components/LanguageToggle';
import { TrialBanners } from '@/components/TrialBanners';
import { BottomNav } from '@/components/BottomNav';
import { TrialBlocker } from '@/components/TrialBlocker';
import {
  LayoutDashboard, Phone, Calendar, MessageSquare, Users,
  Bot, PhoneCall, UserPlus, CreditCard, Settings,
  Sun, Moon, LogOut, ChevronDown, Bell, Menu,
} from 'lucide-react';

type NavSpec = { href: string; key: string; icon: any; emphasis?: boolean };
type Section = { items: NavSpec[] };

const SECTIONS: Section[] = [
  {
    items: [
      { href: '/app/resumen', key: 'tenant.sidebar.resumen', icon: LayoutDashboard },
      { href: '/app/llamadas', key: 'tenant.sidebar.llamadas', icon: Phone },
      { href: '/app/citas', key: 'tenant.sidebar.citas', icon: Calendar },
      { href: '/app/mensajes', key: 'tenant.sidebar.mensajes', icon: MessageSquare },
      { href: '/app/leads', key: 'tenant.sidebar.leads', icon: Users },
    ],
  },
  {
    items: [
      { href: '/app/asistente', key: 'tenant.sidebar.asistente', icon: Bot, emphasis: true },
      { href: '/app/numeros', key: 'tenant.sidebar.numeros', icon: PhoneCall },
    ],
  },
  {
    items: [
      { href: '/app/equipo', key: 'tenant.sidebar.equipo', icon: UserPlus },
      { href: '/app/facturacion', key: 'tenant.sidebar.facturacion', icon: CreditCard },
      { href: '/app/configuracion', key: 'tenant.sidebar.configuracion', icon: Settings },
    ],
  },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { t } = useTranslation();
  return (
    <>
      <div className="px-5 h-16 flex items-center border-b border-sidebar-border">
        <Link href="/" data-testid="link-brand-home"><MarcallWordmark size={24} /></Link>
      </div>
      <nav className="flex-1 px-3 py-5 overflow-y-auto" data-testid="sidebar-nav">
        {SECTIONS.map((sec, si) => (
          <div key={si} className={si > 0 ? 'mt-3 pt-3 border-t border-sidebar-border/60' : ''}>
            <div className="space-y-0.5">
              {sec.items.map(item => {
                const active = location === item.href || (item.href !== '/app' && location.startsWith(item.href));
                const testid = `nav-${item.href.replace(/[^a-z0-9]+/gi, '-')}`;
                return (
                  <Link key={item.href} href={item.href} onClick={onNavigate} data-testid={testid}>
                    <span
                      className={[
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                          : 'text-sidebar-foreground/80',
                        item.emphasis && !active ? 'text-sidebar-foreground' : '',
                      ].join(' ')}
                    >
                      <item.icon className="size-4" />
                      <span>{t(item.key)}</span>
                      {item.emphasis && (
                        <span className="ml-auto inline-block size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

export function TenantLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useTranslation();
  const { user, refetch } = useAuth();
  const { theme, toggle } = useTheme();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const tenantId = user?.currentTenantId;
  const { data: tenants = [] } = useQuery<any[]>({ queryKey: ['/api/tenants'], enabled: !!user });
  const currentTenant = tenants.find((tx: any) => tx.id === tenantId);
  const { data: subscription } = useQuery<any>({
    queryKey: ['/api/tenants', tenantId, 'subscription'],
    enabled: !!tenantId,
  });

  const switchTenant = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/tenants/${id}/switch`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      refetch();
    },
  });

  const logoutMut = useMutation({
    mutationFn: async () => { await apiRequest('POST', '/api/auth/logout'); },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      refetch();
      setLocation('/login');
    },
  });

  const initials = (user?.name || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        data-testid="sidebar"
      >
        <SidebarBody />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 border-b border-border px-4 md:px-8 flex items-center justify-between bg-background/85 backdrop-blur-sm sticky top-0 z-30"
          data-testid="topbar"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="md:hidden size-9 rounded-md hover-elevate inline-flex items-center justify-center"
                  data-testid="button-mobile-nav"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
                <SidebarBody onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            {tenants.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate min-w-0"
                    data-testid="button-tenant-switcher"
                  >
                    <span className="font-display font-semibold text-sm truncate max-w-[160px]">
                      {currentTenant?.name || title || 'MARCALL'}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>{t('tenant.topbar.switchTenant')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tenants.map((tx: any) => (
                    <DropdownMenuItem
                      key={tx.id}
                      onClick={() => switchTenant.mutate(tx.id)}
                      data-testid={`menuitem-tenant-${tx.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{tx.name}</span>
                        <span className="text-xs text-muted-foreground">{tx.slug}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:block font-display font-semibold text-base truncate" data-testid="text-page-title">
                {title || currentTenant?.name || 'MARCALL'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageToggle />

            <button
              onClick={toggle}
              className="size-9 rounded-md hover-elevate inline-flex items-center justify-center text-muted-foreground"
              aria-label="Toggle theme"
              data-testid="button-theme"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <button
              className="size-9 rounded-md hover-elevate inline-flex items-center justify-center text-muted-foreground"
              aria-label={t('tenant.topbar.notifications')}
              data-testid="button-notifications"
            >
              <Bell className="size-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate" data-testid="button-user-menu">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:inline">{user?.name}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {user?.email}
                  <div className="text-xs font-normal text-muted-foreground capitalize">
                    {user?.role?.replace('_', ' ')}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/configuracion" data-testid="menuitem-profile">{t('tenant.topbar.profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logoutMut.mutate()} data-testid="menuitem-logout">
                  <LogOut className="size-4 mr-2" />
                  {t('tenant.topbar.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <TrialBanners />
        <main className="flex-1 p-5 md:p-8 overflow-x-hidden pb-24 md:pb-8">
          <TrialBlocker tenant={currentTenant} subscription={subscription}>
            {children}
          </TrialBlocker>
        </main>
      </div>

      <BottomNav
        ariaLabel="Tenant bottom navigation"
        items={[
          { href: '/app/resumen', label: t('tenant.sidebar.resumen', 'Resumen'), icon: LayoutDashboard },
          { href: '/app/llamadas', label: t('tenant.sidebar.llamadas', 'Llamadas'), icon: Phone },
          { href: '/app/citas', label: t('tenant.sidebar.citas', 'Citas'), icon: Calendar },
          { href: '/app/asistente', label: t('tenant.sidebar.asistente', 'Asistente'), icon: Bot },
        ]}
        drawerTitle={t('common.more', 'Más')}
        drawerItems={[
          { href: '/app/mensajes', label: t('tenant.sidebar.mensajes', 'Mensajes'), icon: MessageSquare },
          { href: '/app/leads', label: t('tenant.sidebar.leads', 'Leads'), icon: Users },
          { href: '/app/numeros', label: t('tenant.sidebar.numeros', 'Números'), icon: PhoneCall },
          { href: '/app/equipo', label: t('tenant.sidebar.equipo', 'Equipo'), icon: UserPlus },
          { href: '/app/facturacion', label: t('tenant.sidebar.facturacion', 'Facturación'), icon: CreditCard },
          { href: '/app/configuracion', label: t('tenant.sidebar.configuracion', 'Configuración'), icon: Settings },
        ]}
      />
    </div>
  );
}

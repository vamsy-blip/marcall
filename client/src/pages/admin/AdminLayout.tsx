import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Building2, Handshake, CreditCard, PhoneCall, FileCheck, Shield,
  FileText, Server, LogOut, Sun, Moon, ChevronDown, UserCircle, Menu, X,
} from 'lucide-react';
import { MarcallWordmark } from '@/components/Brand';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LanguageToggle } from '@/components/LanguageToggle';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const { user, refetch } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: sys } = useQuery<any>({ queryKey: ['/api/system'] });
  const env: 'mock' | 'live' = (sys?.mode as any) || 'mock';

  const NAV = [
    { href: '/admin/panorama', label: t('admin.nav.panorama', 'Panorama'), icon: LayoutDashboard },
    { href: '/admin/tenants', label: t('admin.nav.tenants', 'Tenants'), icon: Building2 },
    { href: '/admin/resellers', label: t('admin.nav.resellers', 'Resellers'), icon: Handshake },
    { href: '/admin/suscripciones', label: t('admin.nav.subscriptions', 'Suscripciones'), icon: CreditCard },
    { href: '/admin/llamadas', label: t('admin.nav.calls', 'Llamadas'), icon: PhoneCall },
    { href: '/admin/kyc', label: t('admin.nav.kyc', 'KYC'), icon: FileCheck },
    { href: '/admin/arco', label: t('admin.nav.arco', 'ARCO'), icon: Shield },
    { href: '/admin/auditoria', label: t('admin.nav.audit', 'Auditoría'), icon: FileText },
    { href: '/admin/sistema', label: t('admin.nav.system', 'Sistema'), icon: Server },
  ];

  const handleLogout = async () => {
    await apiRequest('POST', '/api/auth/logout', {});
    queryClient.clear();
    refetch();
    window.location.hash = '#/login';
  };

  const Sidebar = (
    <>
      <div className="px-5 h-16 flex items-center border-b border-border">
        <Link href="/admin/panorama" data-testid="link-admin-home" className="flex items-center gap-2">
          <MarcallWordmark size={22} />
        </Link>
      </div>
      <div className="px-5 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Super Admin</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">marcall.careofaddress.com</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-admin-${href.split('/').pop()}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/30" data-testid="admin-sidebar">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r flex flex-col">
            <button className="absolute right-3 top-3" onClick={() => setMobileOpen(false)} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 md:px-8" data-testid="admin-topbar">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
            {title && <h1 className="text-base font-semibold hidden md:block">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={env === 'live' ? 'default' : 'secondary'}
              className={`uppercase text-[10px] ${env === 'live' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : ''}`}
              data-testid="badge-env"
            >
              {env}
            </Badge>
            <LanguageToggle />
            <button
              onClick={toggle}
              className="size-9 rounded-md hover:bg-muted inline-flex items-center justify-center text-muted-foreground"
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted" data-testid="button-admin-user-menu">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm hidden sm:inline">{user?.name || 'Admin'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium truncate">{user?.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">Super-administrador</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => (window.location.hash = '#/app')} data-testid="menuitem-switch-tenant">
                  {t('admin.switchToTenant', 'Cambiar a vista tenant')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menuitem-admin-logout">
                  <LogOut className="w-4 h-4 mr-2" /> {t('common.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0" data-testid="admin-main">{children}</main>
      </div>

      <BottomNav
        ariaLabel="Admin bottom navigation"
        items={[
          { href: '/admin/panorama', label: t('admin.nav.panorama', 'Panorama'), icon: LayoutDashboard },
          { href: '/admin/tenants', label: t('admin.nav.tenants', 'Tenants'), icon: Building2 },
          { href: '/admin/suscripciones', label: t('admin.nav.subscriptions', 'Suscripciones'), icon: CreditCard },
          { href: '/admin/sistema', label: t('admin.nav.system', 'Sistema'), icon: Server },
        ]}
        drawerTitle={t('common.more', 'Más')}
        drawerItems={[
          { href: '/admin/resellers', label: t('admin.nav.resellers', 'Resellers'), icon: Handshake },
          { href: '/admin/llamadas', label: t('admin.nav.calls', 'Llamadas'), icon: PhoneCall },
          { href: '/admin/kyc', label: t('admin.nav.kyc', 'KYC'), icon: FileCheck },
          { href: '/admin/arco', label: t('admin.nav.arco', 'ARCO'), icon: Shield },
          { href: '/admin/auditoria', label: t('admin.nav.audit', 'Auditoría'), icon: FileText },
        ]}
      />
    </div>
  );
}

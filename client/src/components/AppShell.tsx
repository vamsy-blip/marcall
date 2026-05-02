import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { MarcallLogo, MarcallWordmark } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sun, Moon, LogOut, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DevSwitcher } from '@/components/DevSwitcher';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from 'react-i18next';

export interface NavItem {
  href: string;
  label: string;
  icon: any;
}

export function AppShell({
  navItems,
  brand = 'MARCALL',
  brandAccent,
  children,
  title,
}: {
  navItems: NavItem[];
  brand?: string;
  brandAccent?: string;
  title?: string;
  children: ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const { user, refetch } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();

  const logoutMut = useMutation({
    mutationFn: async () => { await apiRequest('POST', '/api/auth/logout'); },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      refetch();
      setLocation('/login');
    },
  });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground" data-testid="sidebar">
        <div className="px-5 h-16 flex items-center border-b border-sidebar-border">
          <Link href="/"><MarcallWordmark size={24} /></Link>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = location === item.href || (item.href !== '/app' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} data-testid={`nav-${item.href.replace(/[^a-z0-9]+/gi, '-')}`}>
                <span className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold' : 'text-sidebar-foreground/80'}`}>
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          {import.meta.env.DEV && <DevSwitcher />}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border px-5 md:px-8 flex items-center justify-between bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="md:hidden"><MarcallLogo size={24} className="text-primary" /></div>
          <div className="hidden md:block font-display font-semibold text-lg">{title}</div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button onClick={toggle} className="size-9 rounded-md hover-elevate inline-flex items-center justify-center text-muted-foreground" aria-label="Cambiar tema" data-testid="button-theme">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate" data-testid="button-user-menu">
                  <Avatar className="size-7"><AvatarFallback className="text-xs bg-primary text-primary-foreground">{(user?.name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="text-sm hidden sm:inline">{user?.name}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.email}<div className="text-xs font-normal text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMut.mutate()} data-testid="menuitem-logout"><LogOut className="size-4 mr-2" /> {t('common.logout')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

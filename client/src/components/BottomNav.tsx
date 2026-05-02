import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type BottomNavItem = {
  href: string;
  label: string;
  icon: any;
};

export type BottomNavProps = {
  /** First 4 items rendered as direct buttons, the rest go inside the "Más" drawer. */
  items: BottomNavItem[];
  /** Items shown only inside the "Más" drawer. */
  drawerItems?: BottomNavItem[];
  drawerTitle?: string;
  ariaLabel?: string;
};

/**
 * Mobile bottom navigation. Hidden on md+ screens. 64px tall, sticky bottom.
 * Use exactly 4 primary items + a "Más" drawer for the rest.
 */
export function BottomNav({
  items,
  drawerItems = [],
  drawerTitle,
  ariaLabel = 'Bottom navigation',
}: BottomNavProps) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  if (!isMobile) return null;

  const isActive = (href: string) =>
    location === href || (href !== '/' && location.startsWith(href + '/'));

  const primary = items.slice(0, 4);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-border bg-background/95 backdrop-blur-md flex items-stretch justify-around"
        aria-label={ariaLabel}
        data-testid="bottom-nav"
      >
        {primary.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const testid = `bottomnav-${item.href.replace(/[^a-z0-9]+/gi, '-')}`;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={testid}
              className={[
                'flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] transition-colors',
                active ? 'text-primary font-semibold' : 'text-muted-foreground',
              ].join(' ')}
            >
              <Icon className={['size-5', active ? '' : 'opacity-80'].join(' ')} />
              <span className="leading-none truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}

        {drawerItems.length > 0 && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[11px] text-muted-foreground hover-elevate"
                data-testid="bottomnav-mas"
                aria-label={t('common.more', 'Más')}
              >
                <Menu className="size-5 opacity-80" />
                <span className="leading-none">{t('common.more', 'Más')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh] p-0">
              <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
                <SheetTitle className="text-base">{drawerTitle || t('common.more', 'Más')}</SheetTitle>
              </SheetHeader>
              <div className="p-3 grid grid-cols-1 gap-1" data-testid="bottomnav-drawer">
                {drawerItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const testid = `bottomnav-drawer-${item.href.replace(/[^a-z0-9]+/gi, '-')}`;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      data-testid={testid}
                      className={[
                        'flex items-center gap-3 px-4 py-3 rounded-md text-sm hover-elevate',
                        active ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>
      {/* Spacer so content above isn't covered */}
      <div className="md:hidden h-16" aria-hidden="true" />
    </>
  );
}

export function BottomNavSpacer({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

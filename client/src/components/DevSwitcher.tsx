import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ChevronUp, UserCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export function DevSwitcher() {
  const { data } = useQuery<{ users: any[] }>({ queryKey: ['/api/dev/users'] });
  const m = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest('POST', '/api/dev/login-as', { email });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      const role = data.user.role;
      let path = '/';
      if (role === 'superadmin') path = '/admin';
      else if (role === 'reseller') path = '/agency';
      else path = '/app';
      window.location.hash = `#${path}`;
    },
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-xs" data-testid="button-dev-switcher">
          <span className="flex items-center gap-2"><UserCircle2 className="size-3.5" /> Dev: cambiar usuario</span>
          <ChevronUp className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel>Cuentas demo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(data?.users || []).map(u => (
          <DropdownMenuItem key={u.id} onClick={() => m.mutate(u.email)} data-testid={`devswitch-${u.email}`}>
            <div>
              <div className="text-sm">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.email} · <span className="capitalize">{u.role.replace('_', ' ')}</span></div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

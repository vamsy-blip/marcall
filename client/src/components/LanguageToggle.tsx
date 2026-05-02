import { useLang } from '@/components/LanguageProvider';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageToggle({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { lang, setLang } = useLang();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-1.5" data-testid="button-language-toggle">
          <Globe className="w-4 h-4" />
          <span className="text-xs uppercase font-medium tracking-wider">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => setLang('es')} data-testid="menu-lang-es">
          <span className="mr-2">🇲🇽</span> Español
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('en')} data-testid="menu-lang-en">
          <span className="mr-2">🇺🇸</span> English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact pill variant for marketing footer
export function LanguagePill() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex rounded-full border border-border p-1 bg-background/60">
      <button
        onClick={() => setLang('es')}
        className={`text-xs px-3 py-1 rounded-full transition-colors ${lang === 'es' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
        data-testid="pill-lang-es"
      >ES</button>
      <button
        onClick={() => setLang('en')}
        className={`text-xs px-3 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
        data-testid="pill-lang-en"
      >EN</button>
    </div>
  );
}

import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { MarcallLogo } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || 'es').startsWith('en');

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <MarcallLogo size={36} className="text-primary mx-auto mb-6" />
        <h1 className="font-display font-semibold text-3xl mb-3" data-testid="text-404-title">
          {isEn ? 'Page not found' : 'Página no encontrada'}
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          {isEn
            ? "The page you're looking for doesn't exist or has moved."
            : 'La página que buscas no existe o fue movida.'}
        </p>
        <Link href="/">
          <Button size="lg" className="gap-2" data-testid="link-404-home">
            <ArrowLeft className="w-4 h-4" />
            {isEn ? 'Back to home' : 'Volver al inicio'}
          </Button>
        </Link>
      </div>
    </div>
  );
}

import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { MarcallWordmark } from '@/components/Brand';

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center marcall-grain bg-background px-6 py-12">
      <div className="absolute top-6 left-6">
        <Link href="/" data-testid="link-home">
          <MarcallWordmark className="h-7" />
        </Link>
      </div>
      <Card className="max-w-lg w-full border-2">
        <CardContent className="p-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <XCircle className="w-9 h-9 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold">Pago cancelado</h1>
            <p className="text-muted-foreground">
              No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/signup" data-testid="link-back-signup">
              <Button size="lg" className="w-full">Volver a planes</Button>
            </Link>
            <Link href="/" data-testid="link-back-home">
              <Button variant="ghost" className="w-full">Ir al inicio</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Phone, Send, Mail, Bot, User as UserIcon } from 'lucide-react';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  tool?: string;
}

const SCRIPTED: Record<string, (input: string) => string> = {
  es: (input: string) => {
    const i = input.toLowerCase();
    if (i.includes('cita') || i.includes('agendar')) return 'Con gusto. Para agendar, ¿qué día y hora le acomodan?';
    if (i.includes('precio') || i.includes('costo')) return 'El servicio inicia desde 1,500 MXN. ¿Le interesa que le agende una valoración?';
    if (i.includes('horario')) return 'Atendemos de lunes a viernes de 9 a 19, y sábados de 10 a 14.';
    return '¿Me puede dar más detalles? Estoy aquí para ayudarle.';
  },
  en: (input: string) => {
    const i = input.toLowerCase();
    if (i.includes('appointment') || i.includes('book')) return 'Happy to help. What day and time work best for you?';
    if (i.includes('price') || i.includes('cost')) return 'Pricing starts at 1,500 MXN. Want me to book an evaluation?';
    if (i.includes('hours')) return 'We are open Monday to Friday, 9 to 7, and Saturday 10 to 2.';
    return 'Could you share more detail? I am happy to help.';
  },
};

export function TestCallModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tid = user?.currentTenantId;
  const { data: numbers = [] } = useQuery<any[]>({ queryKey: ['/api/tenants', tid, 'numbers'], enabled: !!tid && open });
  const phoneNumber = numbers[0]?.e164;
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  const sendTurn = () => {
    if (!input.trim()) return;
    const userTurn: Turn = { role: 'user', text: input };
    const reply = SCRIPTED[lang](input);
    const replyTurn: Turn = { role: 'assistant', text: reply };
    const next: Turn[] = [...turns, userTurn, replyTurn];
    if (input.toLowerCase().includes('cita') || input.toLowerCase().includes('appoint')) {
      next.splice(next.length - 1, 0, { role: 'assistant', text: 'check_availability(today)', tool: 'check_availability' });
    }
    setTurns(next);
    setInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('tenant.testcall.title')}</DialogTitle>
          <DialogDescription>{t('tenant.testcall.subtitle')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="browser" className="mt-3">
          <TabsList className="grid grid-cols-2 w-full" data-testid="testcall-tabs">
            <TabsTrigger value="browser" data-testid="tab-browser">{t('tenant.testcall.browserMode')}</TabsTrigger>
            <TabsTrigger value="phone" data-testid="tab-phone">{t('tenant.testcall.phoneMode')}</TabsTrigger>
          </TabsList>
          <TabsContent value="browser" className="space-y-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('tenant.testcall.lang')}:</span>
              <button onClick={() => setLang('es')} className={`text-xs px-2 py-1 rounded ${lang === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="tc-lang-es">🇲🇽 ES</button>
              <button onClick={() => setLang('en')} className={`text-xs px-2 py-1 rounded ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} data-testid="tc-lang-en">🇺🇸 EN</button>
              <span className="text-xs text-muted-foreground ml-2">{t('tenant.testcall.browserHint')}</span>
            </div>
            <div className="border border-border rounded-md bg-muted/30 p-4 h-72 overflow-y-auto space-y-3" data-testid="testcall-transcript">
              {turns.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-12">
                  {lang === 'es' ? 'Escribe un mensaje para comenzar.' : 'Type a message to start.'}
                </div>
              )}
              {turns.map((tr, i) => (
                <div key={i} className={`flex gap-2 text-sm ${tr.role === 'user' ? 'justify-end' : ''}`}>
                  {tr.role === 'assistant' && (
                    <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Bot className="size-3" />
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-md max-w-[80%] ${tr.role === 'user' ? 'bg-primary text-primary-foreground' : tr.tool ? 'bg-amber-100 dark:bg-amber-900/30 text-xs font-mono' : 'bg-card border border-border'}`}>
                    {tr.tool ? <span>🛠 {tr.text}</span> : tr.text}
                  </div>
                  {tr.role === 'user' && (
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserIcon className="size-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendTurn()}
                placeholder={lang === 'es' ? 'Quisiera agendar una cita…' : 'I would like to book an appointment…'}
                data-testid="input-testcall"
              />
              <Button onClick={sendTurn} disabled={!input.trim()} data-testid="button-testcall-send">
                <Send className="size-4" />
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="phone" className="space-y-3 mt-3">
            {phoneNumber ? (
              <div className="border border-border rounded-md p-6 text-center">
                <Phone className="size-8 mx-auto mb-3 text-primary" />
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t('tenant.testcall.phoneHint')}
                </div>
                <div className="font-mono font-semibold text-xl tracking-wide" data-testid="testcall-phone">{phoneNumber}</div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
                {t('tenant.testcall.noNumber')}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="flex-row sm:justify-between gap-2 mt-2">
          <Button variant="ghost" size="sm" data-testid="button-testcall-email">
            <Mail className="size-4 mr-1.5" /> {t('tenant.testcall.emailCopy')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="button-testcall-close">
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

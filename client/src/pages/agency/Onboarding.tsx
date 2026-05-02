import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgencyLayout from './AgencyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Edit, FileText } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface Template {
  id: number;
  name: string;
  description?: string | null;
  industry?: string | null;
  greeting?: string | null;
  faqsJson?: string | null;
}

export default function Onboarding() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: ['/api/agency/templates'] });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', description: '', industry: '', greeting: '' });

  const reset = () => { setForm({ name: '', description: '', industry: '', greeting: '' }); setEditing(null); };

  const startEdit = (tpl: Template) => {
    setEditing(tpl);
    setForm({
      name: tpl.name || '',
      description: tpl.description || '',
      industry: tpl.industry || '',
      greeting: tpl.greeting || '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const res = await apiRequest('PATCH', `/api/agency/templates/${editing.id}`, form);
        return res.json();
      }
      const res = await apiRequest('POST', '/api/agency/templates', form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/templates'] });
      toast({ title: editing ? t('agency.templates.updated', 'Plantilla actualizada') : t('agency.templates.created', 'Plantilla creada') });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast({ title: t('common.saveError', 'No se pudo guardar'), description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/agency/templates/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agency/templates'] });
      toast({ title: t('agency.templates.deleted', 'Plantilla eliminada') });
    },
  });

  return (
    <AgencyLayout title={t('agency.templates.title', 'Plantillas de onboarding')}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold" data-testid="text-page-title">{t('agency.templates.title', 'Plantillas de onboarding')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('agency.templates.sub', 'Configura plantillas reutilizables por industria para acelerar el alta de clientes.')}</p>
          </div>
          <Button onClick={() => { reset(); setOpen(true); }} data-testid="button-new-template">
            <Plus className="w-4 h-4 mr-2" /> {t('agency.templates.new', 'Nueva plantilla')}
          </Button>
        </header>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : templates.length === 0 ? (
              <div className="p-16 text-center">
                <FileText className="w-10 h-10 mx-auto text-primary/40 mb-3" />
                <p className="text-muted-foreground text-sm">{t('agency.templates.empty', 'Aún no hay plantillas. Crea la primera.')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Nombre')}</TableHead>
                    <TableHead>{t('agency.templates.industry', 'Industria')}</TableHead>
                    <TableHead>{t('agency.templates.greeting', 'Saludo')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id} data-testid={`row-template-${tpl.id}`}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.industry || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{tpl.greeting || '—'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(tpl)} data-testid={`button-edit-${tpl.id}`}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { if (confirm(t('agency.templates.confirmDelete', '¿Eliminar plantilla?'))) del.mutate(tpl.id); }}
                          data-testid={`button-delete-${tpl.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? t('agency.templates.editTitle', 'Editar plantilla') : t('agency.templates.new', 'Nueva plantilla')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.name', 'Nombre')}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-template-name" />
              </div>
              <div className="space-y-2">
                <Label>{t('agency.templates.industry', 'Industria')}</Label>
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Dentista, Plomería, Bufete legal…" data-testid="input-template-industry" />
              </div>
              <div className="space-y-2">
                <Label>{t('agency.templates.descriptionLabel', 'Descripción')}</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-template-description" />
              </div>
              <div className="space-y-2">
                <Label>{t('agency.templates.greeting', 'Saludo')}</Label>
                <Textarea rows={3} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Hola, gracias por llamar a…" data-testid="input-template-greeting" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>{t('common.cancel', 'Cancelar')}</Button>
              <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()} data-testid="button-save-template">
                {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('common.save', 'Guardar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AgencyLayout>
  );
}

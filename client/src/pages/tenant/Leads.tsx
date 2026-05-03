import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { TenantLayout } from './TenantLayout';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, Phone, Mail, Building2, StickyNote } from 'lucide-react';

const STAGES = [
  { id: 'new', i18n: 'tenant.leads.stageNew', color: 'bg-sky-500' },
  { id: 'qualified', i18n: 'tenant.leads.stageQualified', color: 'bg-violet-500' },
  { id: 'hot', i18n: 'tenant.leads.stageHot', color: 'bg-rose-500' },
  { id: 'contacted', i18n: 'tenant.leads.stageContacted', color: 'bg-amber-500' },
  { id: 'converted', i18n: 'tenant.leads.stageConverted', color: 'bg-emerald-500' },
  { id: 'lost', i18n: 'tenant.leads.stageLost', color: 'bg-muted-foreground' },
];

function LeadCard({ lead, onClick }: { lead: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { lead },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="touch-none" data-testid={`card-lead-${lead.id}`}>
      <Card className="border-card-border hover-elevate cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <button {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing pt-0.5" data-testid={`drag-lead-${lead.id}`} aria-label={`Drag lead ${lead.name || lead.id}`}>
              <GripVertical className="size-3.5" />
            </button>
            <div className="flex-1 min-w-0" onClick={onClick}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-semibold text-sm truncate">{lead.name || '—'}</div>
                <Badge variant={(lead.qualificationScore || 0) > 60 ? 'default' : 'outline'} className="tabular-nums text-[10px]">
                  {lead.qualificationScore || 0}
                </Badge>
              </div>
              {lead.company && <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><Building2 className="size-3" />{lead.company}</div>}
              <div className="text-[11px] text-muted-foreground mt-1 truncate font-mono">{lead.phone || lead.email || '—'}</div>
              {lead.interest && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{lead.interest}</div>}
              {lead.source && <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-2">{lead.source}</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StageColumn({ stage, leads, onLeadClick }: { stage: any; leads: any[]; onLeadClick: (l: any) => void }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex-1 min-w-[240px] flex flex-col" data-testid={`column-stage-${stage.id}`}>
      <div className="flex items-center gap-2 px-1 py-2 mb-2 border-b border-border">
        <span className={`size-2 rounded-full ${stage.color}`} />
        <div className="text-xs font-semibold uppercase tracking-wider">{t(stage.i18n)}</div>
        <span className="text-xs text-muted-foreground tabular-nums ml-auto">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg p-2 space-y-2 transition-colors ${isOver ? 'bg-primary/5 ring-1 ring-primary/40' : 'bg-muted/20'}`}
      >
        {leads.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">{t('tenant.leads.empty')}</div>
        ) : (
          leads.map((l) => <LeadCard key={l.id} lead={l} onClick={() => onLeadClick(l)} />)
        )}
      </div>
    </div>
  );
}

export default function Leads() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { lang } = useLang();
  const dateLocale = lang === 'en' ? enUS : es;
  const tid = user?.currentTenantId;
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<any>(null);
  const [note, setNote] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants', tid, 'leads'],
    enabled: !!tid,
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/tenants/${tid}/leads/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tenants', tid, 'leads'] }),
    onError: () => toast({ title: t('common.saveError'), variant: 'destructive' }),
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    STAGES.forEach((s) => (g[s.id] = []));
    leads.forEach((l: any) => {
      const stage = l.stage || 'new';
      if (g[stage]) g[stage].push(l);
      else g.new.push(l);
    });
    return g;
  }, [leads]);

  const activeLead = useMemo(() => {
    if (!activeId) return null;
    const id = Number(activeId.replace('lead-', ''));
    return leads.find((l: any) => l.id === id);
  }, [activeId, leads]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const newStage = String(e.over.id);
    const lead = e.active.data.current?.lead;
    if (lead && lead.stage !== newStage) {
      updateLead.mutate({ id: lead.id, data: { stage: newStage } });
    }
  };

  const saveNote = () => {
    if (!drawer || !note.trim()) return;
    updateLead.mutate(
      { id: drawer.id, data: { notes: note } },
      {
        onSuccess: () => {
          toast({ title: t('common.saved') });
          setNote('');
        },
      },
    );
  };

  return (
    <TenantLayout title={t('tenant.leads.title')}>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight" data-testid="text-page-heading">{t('tenant.leads.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} {t('common.results')}</p>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((s) => <Skeleton key={s.id} className="h-96 min-w-[240px] flex-1" />)}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  leads={grouped[stage.id] || []}
                  onLeadClick={(l) => { setDrawer(l); setNote(l.notes || ''); }}
                />
              ))}
            </div>
            <DragOverlay>
              {activeLead && (
                <div className="rotate-1">
                  <Card className="border-card-border shadow-lg">
                    <CardContent className="p-3 w-[240px]">
                      <div className="font-semibold text-sm">{activeLead.name || '—'}</div>
                      <div className="text-xs text-muted-foreground mt-1">{activeLead.phone || activeLead.email}</div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('tenant.leads.drawerTitle')}</SheetTitle>
          </SheetHeader>
          {drawer && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="font-display font-bold text-lg">{drawer.name || '—'}</div>
                {drawer.company && <div className="text-sm text-muted-foreground">{drawer.company}</div>}
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{t(STAGES.find(s => s.id === (drawer.stage || 'new'))?.i18n || 'tenant.leads.stageNew')}</Badge>
                  <Badge variant={(drawer.qualificationScore || 0) > 60 ? 'default' : 'outline'} className="tabular-nums">{t('tenant.leads.score')}: {drawer.qualificationScore || 0}</Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {drawer.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /><span className="font-mono">{drawer.phone}</span></div>}
                {drawer.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /><span className="font-mono">{drawer.email}</span></div>}
                {drawer.source && <div><span className="text-xs text-muted-foreground">{t('tenant.leads.source')}: </span>{drawer.source}</div>}
                {drawer.interest && <div className="text-muted-foreground italic">"{drawer.interest}"</div>}
                {drawer.transcriptExcerpt && <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">"{drawer.transcriptExcerpt}"</div>}
                {drawer.createdAt && <div className="text-xs text-muted-foreground">{t('tenant.leads.lastActivity')}: {format(new Date(drawer.createdAt), "d MMM yyyy, HH:mm", { locale: dateLocale })}</div>}
              </div>

              <div>
                <Label className="text-xs">{t('tenant.leads.addNote')}</Label>
                <Textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1.5"
                  data-testid="textarea-lead-note"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={saveNote} data-testid="button-save-note">
                    <StickyNote className="size-3.5 mr-1.5" /> {t('common.save')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TenantLayout>
  );
}

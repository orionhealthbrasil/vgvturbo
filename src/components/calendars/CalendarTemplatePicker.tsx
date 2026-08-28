import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Globe, BellOff, Bell, ChevronLeft } from 'lucide-react';
import { DAYS_OF_WEEK, type CalendarTemplate } from '@/types/booking';
import { useCalendarTemplates, useApplyCalendarTemplate } from '@/hooks/useCalendarTemplates';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export function CalendarTemplatePicker({ open, onOpenChange }: Props) {
  const { data: templates, isLoading } = useCalendarTemplates();
  const { data: members } = useOrganizationMembers();
  const apply = useApplyCalendarTemplate();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<CalendarTemplate | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string>('none');

  const grouped = useMemo(() => {
    const list = templates ?? [];
    return {
      org: list.filter((t) => t.scope === 'organization'),
      global: list.filter((t) => t.scope === 'global'),
    };
  }, [templates]);

  const reset = () => {
    setSelected(null);
    setName('');
    setSlug('');
    setOwnerUserId('none');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePick = (t: CalendarTemplate) => {
    setSelected(t);
    setName(t.name);
    setSlug(slugify(t.name));
  };

  const handleApply = async () => {
    if (!selected || !name.trim() || !slug.trim()) return;
    const newId = await apply.mutateAsync({
      template_id: selected.id,
      calendar_name: name.trim(),
      slug: slug.trim(),
      owner_user_id: ownerUserId === 'none' ? null : ownerUserId,
    });
    handleClose(false);
    navigate(`/calendarios/${newId}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Escolha um template</DialogTitle>
              <DialogDescription>
                Crie um calendário pré-configurado com disponibilidade, tipos de evento e mensagens prontas.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando templates...</p>
            ) : (
              <div className="space-y-6">
                {grouped.org.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                      <Building2 className="w-4 h-4" /> Da organização
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {grouped.org.map((t) => (
                        <TemplateCard key={t.id} template={t} onPick={handlePick} />
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                    <Globe className="w-4 h-4" /> Templates prontos
                  </div>
                  {grouped.global.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum template global disponível.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {grouped.global.map((t) => (
                        <TemplateCard key={t.id} template={t} onPick={handlePick} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={reset}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {selected.icon && <span>{selected.icon}</span>} {selected.name}
              </DialogTitle>
              <DialogDescription>{selected.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome do calendário *</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="Ex.: Dr. João Silva"
                />
              </div>
              <div>
                <Label>Identificador (URL) *</Label>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">
                  Link: /agenda/<span className="font-mono">{slug || 'identificador'}</span>
                </p>
              </div>
              <div>
                <Label>Profissional responsável</Label>
                <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {(members ?? []).map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email || m.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card className="p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Você vai criar</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>{selected.event_types.length} tipo(s) de evento</li>
                  <li>{selected.availability.length} bloco(s) de disponibilidade</li>
                  <li>
                    Lembretes:{' '}
                    {selected.reminders_enabled ? (
                      <span className="text-emerald-600 dark:text-emerald-400">ativados</span>
                    ) : (
                      <span className="text-muted-foreground">desativados (silencioso)</span>
                    )}
                  </li>
                </ul>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApply} disabled={apply.isPending || !name.trim() || !slug.trim()}>
                {apply.isPending ? 'Criando...' : 'Criar calendário'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onPick }: { template: CalendarTemplate; onPick: (t: CalendarTemplate) => void }) {
  const days = Array.from(new Set(template.availability.map((a) => a.day_of_week))).sort();
  return (
    <Card
      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors space-y-2"
      onClick={() => onPick(template)}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none">{template.icon ?? '📅'}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{template.name}</h4>
          {template.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {template.category && <Badge variant="outline" className="text-xs">{template.category}</Badge>}
        {template.reminders_enabled ? (
          <Badge variant="outline" className="text-xs gap-1">
            <Bell className="w-3 h-3" /> Lembretes
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs gap-1">
            <BellOff className="w-3 h-3" /> Silencioso
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {template.event_types.length} tipo(s)
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {days.map((d) => (
          <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {DAYS_OF_WEEK.find((x) => x.value === d)?.short}
          </span>
        ))}
      </div>
    </Card>
  );
}

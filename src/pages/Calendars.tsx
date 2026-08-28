import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, ExternalLink, Copy, Pencil, BellOff, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCalendars, useUpdateCalendar } from '@/hooks/useCalendars';
import { CalendarFormDialog } from '@/components/calendars/CalendarFormDialog';
import { CalendarTemplatePicker } from '@/components/calendars/CalendarTemplatePicker';
import type { Calendar } from '@/types/booking';
import { toast } from 'sonner';

export default function Calendars() {
  const { data: calendars, isLoading } = useCalendars();
  const update = useUpdateCalendar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<Calendar | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const copyPublicLink = (slug: string) => {
    const url = `${window.location.origin}/agenda/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Calendários</h1>
          <p className="text-muted-foreground text-sm">Gerencie os calendários da organização e seus links públicos.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Novo calendário <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Criar do zero
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPickerOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Usar template…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (calendars ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Nenhum calendário ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie um calendário para começar a receber agendamentos.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Criar do zero</Button>
            <Button variant="outline" onClick={() => setPickerOpen(true)}><Sparkles className="w-4 h-4 mr-2" /> Usar template</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {calendars!.map((c) => (
            <Card key={c.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                </div>
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(v) => update.mutate({ id: c.id, is_active: v })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">/agenda/{c.slug}</Badge>
                {!c.reminders_enabled && (
                  <Badge variant="secondary" className="gap-1">
                    <BellOff className="w-3 h-3" /> Silencioso
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copyPublicLink(c.slug)}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`/agenda/${c.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/calendarios/${c.id}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CalendarFormDialog open={dialogOpen} onOpenChange={setDialogOpen} calendar={editing} />
      <CalendarTemplatePicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateCalendar, useUpdateCalendar } from '@/hooks/useCalendars';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import type { Calendar } from '@/types/booking';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendar?: Calendar | null;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7', '#ef4444', '#3b82f6'];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export function CalendarFormDialog({ open, onOpenChange, calendar }: Props) {
  const create = useCreateCalendar();
  const update = useUpdateCalendar();
  const { data: members } = useOrganizationMembers();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [ownerUserId, setOwnerUserId] = useState<string>('none');
  const [contactPhone, setContactPhone] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [isActive, setIsActive] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setSlug(calendar.slug);
      setDescription(calendar.description ?? '');
      setColor(calendar.color);
      setOwnerUserId(calendar.owner_user_id ?? 'none');
      setContactPhone(calendar.contact_phone ?? '');
      setGoogleReviewUrl(calendar.google_review_url ?? '');
      setTimezone(calendar.timezone);
      setIsActive(calendar.is_active);
      setRemindersEnabled(calendar.reminders_enabled ?? true);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setColor(COLORS[0]);
      setOwnerUserId('none');
      setContactPhone('');
      setGoogleReviewUrl('');
      setTimezone('America/Sao_Paulo');
      setIsActive(true);
      setRemindersEnabled(true);
    }
  }, [calendar, open]);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!calendar) setSlug(slugify(v));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) return;
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      color,
      owner_user_id: ownerUserId === 'none' ? null : ownerUserId,
      contact_phone: contactPhone.trim() || null,
      google_review_url: googleReviewUrl.trim() || null,
      timezone,
      is_active: isActive,
      reminders_enabled: remindersEnabled,
    } as any;

    if (calendar) {
      await update.mutateAsync({ id: calendar.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{calendar ? 'Editar calendário' : 'Novo calendário'}</DialogTitle>
          <DialogDescription>Configure os dados básicos do calendário.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex.: Dr. João Silva" />
          </div>
          <div>
            <Label>Identificador (URL pública) *</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="dr-joao-silva" />
            <p className="text-xs text-muted-foreground mt-1">
              Link: /agenda/<span className="font-mono">{slug || 'identificador'}</span>
            </p>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Profissional responsável</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone de contato</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="55119..." />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>Link de avaliação Google (opcional)</Label>
            <Input value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/..." />
          </div>
          <div className="flex items-center justify-between">
            <Label className="m-0">Calendário ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="m-0">Enviar lembretes automáticos</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirmações, lembretes 24h/1h e pedido de avaliação via WhatsApp/email.
                </p>
              </div>
              <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
            </div>
            {!remindersEnabled && (
              <p className="text-xs rounded bg-muted/50 px-2 py-1.5 text-muted-foreground">
                ⚠️ Modo silencioso: este calendário funciona apenas como agenda interna — nenhum WhatsApp ou email automático será enviado aos contatos agendados.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {calendar ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

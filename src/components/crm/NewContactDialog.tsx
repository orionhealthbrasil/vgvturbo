import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateContact, useAllKanbanColumns } from '@/hooks/useCRM';
import { useKanbanPipelines } from '@/hooks/useKanbanPipelines';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { toast } from 'sonner';

interface NewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewContactDialog({ open, onOpenChange }: NewContactDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [columnId, setColumnId] = useState<string>('');
  const [pipelineId, setPipelineId] = useState<string>('');
  const [funnelStage, setFunnelStage] = useState<string>('');

  const { data: columns = [] } = useAllKanbanColumns();
  const { data: pipelines = [] } = useKanbanPipelines();
  const { data: allStages = [] } = useFunnelStages();
  const createContact = useCreateContact();

  const stagesForPipeline = allStages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.position - b.position);

  // Normalize phone number to ensure consistent format with country code
  // Applies the same 9th-digit logic as the webhook to prevent duplicates
  const normalizePhone = (rawPhone: string): string => {
    // Remove all non-digits
    let digits = rawPhone.replace(/\D/g, '');
    // Ensure 55 prefix for Brazilian numbers
    if (!digits.startsWith('55')) {
      digits = `55${digits}`;
    }
    // Apply 9th digit normalization for Brazilian mobile numbers
    const withoutCountry = digits.slice(2);
    if (withoutCountry.length === 10) {
      const ddd = withoutCountry.slice(0, 2);
      const number = withoutCountry.slice(2);
      const firstDigit = number[0];
      // Mobile numbers start with 6-9 after DDD, add the 9
      if (['6', '7', '8', '9'].includes(firstDigit)) {
        return `55${ddd}9${number}`;
      }
    }
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    const normalizedPhone = normalizePhone(phone.trim());
    
    // Validate minimum length (55 + 10 or 11 digits)
    if (normalizedPhone.length < 12) {
      toast.error('Telefone inválido. Digite o número completo com DDD.');
      return;
    }

    try {
      await createContact.mutateAsync({
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim() || null,
        notes: notes.trim() || null,
        kanban_column_id: columnId || null,
        pipeline_id: pipelineId || null,
        assigned_to: null,
        funnel_stage: funnelStage || 'lead',
        sale_result: null,
        profile_picture_url: null,
      });

      toast.success('Contato criado com sucesso!');
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      const msg: string = error?.message || error?.error_description || JSON.stringify(error);
      if (msg.includes('contacts_organization_phone_unique') || msg.includes('duplicate key')) {
        toast.error('Este telefone já está cadastrado em outro contato da sua organização.');
      } else {
        toast.error('Erro ao criar contato');
      }
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setColumnId('');
    setPipelineId('');
    setFunnelStage('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (WhatsApp) *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {pipelines.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="pipeline">Funil</Label>
              <Select
                value={pipelineId}
                onValueChange={(v) => { setPipelineId(v); setFunnelStage(''); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_default && <span className="ml-1 text-xs text-muted-foreground">(padrão)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pipelineId && stagesForPipeline.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="stage">Etapa do funil</Label>
              <Select value={funnelStage} onValueChange={setFunnelStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stagesForPipeline.map((s) => (
                    <SelectItem key={s.id} value={s.slug}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="column">Coluna Kanban</Label>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma coluna (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.color || '#6366f1' }}
                      />
                      {column.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre o contato..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? 'Criando...' : 'Criar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

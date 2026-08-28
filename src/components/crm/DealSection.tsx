import { useEffect, useRef, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useUpdateDealFields } from '@/hooks/usePipeline';
import { toast } from 'sonner';
import type { Contact } from '@/types/crm';

interface Props {
  contact: Contact;
}

const formatBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

export function DealSection({ contact }: Props) {
  const update = useUpdateDealFields();
  const [value, setValue] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [editingValue, setEditingValue] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(contact.deal_value != null ? String(contact.deal_value) : '');
    setNotes(contact.deal_notes ?? '');
  }, [contact.id, contact.deal_value, contact.deal_notes]);

  useEffect(() => {
    if (editingValue) valueInputRef.current?.focus();
  }, [editingValue]);

  const saveValue = async () => {
    // Strip thousand-separator dots (2.000 → 2000) then convert decimal comma to dot
    const trimmed = value.trim().replace(/\./g, '').replace(',', '.');
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      toast.error('Valor inválido');
      return;
    }
    if (parsed === (contact.deal_value ?? null)) {
      setEditingValue(false);
      return;
    }
    try {
      await update.mutateAsync({ id: contact.id, deal_value: parsed });
      setEditingValue(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar valor');
    }
  };

  const saveNotes = async () => {
    const trimmed = notes.trim();
    if (trimmed === (contact.deal_notes ?? '').trim()) return;
    try {
      await update.mutateAsync({
        id: contact.id,
        deal_notes: trimmed === '' ? null : trimmed,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar anotações');
    }
  };

  return (
    <div className="space-y-3">
      {/* Deal value */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Valor potencial
        </label>
        {editingValue ? (
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                ref={valueInputRef}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={saveValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveValue();
                  if (e.key === 'Escape') {
                    setValue(contact.deal_value != null ? String(contact.deal_value) : '');
                    setEditingValue(false);
                  }
                }}
                className="h-8 text-sm pl-8"
              />
            </div>
            {update.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingValue(true)}
            className="w-full text-left text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-accent/50 rounded px-2 py-1.5 -mx-2 transition-colors"
          >
            {contact.deal_value != null ? formatBRL(contact.deal_value) : (
              <span className="text-muted-foreground italic font-normal">Adicionar valor</span>
            )}
          </button>
        )}
      </div>

      {/* Deal notes */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Anotações
        </label>
        <Textarea
          rows={3}
          placeholder="Próximos passos, observações..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          maxLength={2000}
          className="text-xs resize-none min-h-[60px]"
        />
      </div>

      {/* Loss reason (only if lost) */}
      {contact.sale_result === 'lost' && contact.loss_reason && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Motivo da perda
          </label>
          <p className="text-xs text-muted-foreground bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-md px-2.5 py-2">
            {contact.loss_reason}
          </p>
        </div>
      )}
    </div>
  );
}

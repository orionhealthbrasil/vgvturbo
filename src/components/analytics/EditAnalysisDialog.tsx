import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ConversationAnalysis } from '@/hooks/useConversationAnalyses';

const SALE_STATUS = ['VENDA','ORCAMENTO','PECA NAO ENCONTRADA','SEM RESPOSTA','NAO TRABALHAMOS COM A PECA','NAO SELECIONOU OPCAO'];
const PRODUCT_LINES = ['LINHA LEVE','LINHA PESADA'];

interface Props {
  analysis: ConversationAnalysis | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
}

const FIELDS: (keyof ConversationAnalysis)[] = [
  'customer_name','phone','lead_source','sale_status','product_line','part_searched','quantity','sale_value','analysis_date'
];

export function EditAnalysisDialog({ analysis, open, onOpenChange, organizationId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [note, setNote] = useState('');
  const [saveAsExample, setSaveAsExample] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (analysis) {
      setForm({
        customer_name: analysis.customer_name ?? '',
        phone: analysis.phone ?? '',
        lead_source: analysis.lead_source ?? '',
        sale_status: analysis.sale_status ?? '',
        product_line: analysis.product_line ?? '',
        part_searched: analysis.part_searched ?? '',
        quantity: analysis.quantity ?? '',
        sale_value: analysis.sale_value ?? '',
        analysis_date: analysis.analysis_date ?? '',
      });
      setNote('');
      setSaveAsExample(true);
    }
  }, [analysis]);

  if (!analysis) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Compute diff
      const changes: Record<string, { from: any; to: any }> = {};
      const correct: Record<string, any> = {};
      const wrong: Record<string, any> = {};
      for (const f of FIELDS) {
        const oldV = (analysis as any)[f] ?? null;
        let newV: any = form[f];
        if (newV === '') newV = null;
        if (f === 'quantity') newV = newV != null ? Number(newV) : null;
        if (f === 'sale_value') newV = newV != null ? Number(newV) : null;
        if (String(oldV ?? '') !== String(newV ?? '')) {
          changes[f] = { from: oldV, to: newV };
          correct[f] = newV;
          wrong[f] = oldV;
        }
      }

      const updates: any = { ...form };
      updates.quantity = updates.quantity !== '' && updates.quantity != null ? Number(updates.quantity) : null;
      updates.sale_value = updates.sale_value !== '' && updates.sale_value != null ? Number(updates.sale_value) : null;
      for (const k of Object.keys(updates)) if (updates[k] === '') updates[k] = null;

      if (Object.keys(changes).length > 0) {
        updates.is_corrected = true;
        updates.original_values = { ...(analysis.original_values as any || {}), ...wrong };
        updates.correction_note = note || null;
        updates.corrected_by = user.id;
        updates.corrected_at = new Date().toISOString();
      }

      const { error: upErr } = await supabase
        .from('conversation_analyses')
        .update(updates)
        .eq('id', analysis.id);
      if (upErr) throw upErr;

      if (saveAsExample && Object.keys(changes).length > 0) {
        // Try to fetch a short conversation excerpt if we have a contact
        let excerpt: string | null = null;
        if (analysis.contact_id) {
          const { data: msgs } = await supabase
            .from('messages')
            .select('direction, content, created_at')
            .eq('contact_id', analysis.contact_id)
            .order('created_at', { ascending: false })
            .limit(20);
          if (msgs?.length) {
            excerpt = msgs.reverse()
              .map((m: any) => `[${m.direction === 'inbound' ? 'Cliente' : 'Atendente'}] ${(m.content ?? '').toString().slice(0, 200)}`)
              .join('\n')
              .slice(0, 4000);
          }
        }

        await supabase.from('analysis_curation_examples').insert({
          organization_id: organizationId,
          analysis_id: analysis.id,
          contact_id: analysis.contact_id,
          conversation_excerpt: excerpt,
          wrong_values: wrong,
          correct_values: correct,
          note: note || null,
          created_by: user.id,
        });
      }

      toast.success('Análise atualizada' + (saveAsExample && Object.keys(changes).length ? ' e exemplo salvo' : ''));
      qc.invalidateQueries({ queryKey: ['conversation-analyses', organizationId] });
      qc.invalidateQueries({ queryKey: ['analysis-curation-examples', organizationId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar análise</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Cliente</Label>
            <Input value={form.customer_name || ''} onChange={(e) => upd('customer_name', e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone || ''} onChange={(e) => upd('phone', e.target.value)} />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.analysis_date || ''} onChange={(e) => upd('analysis_date', e.target.value)} />
          </div>
          <div>
            <Label>Origem</Label>
            <Input value={form.lead_source || ''} onChange={(e) => upd('lead_source', e.target.value)} placeholder="Google, indicação..." />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.sale_status || ''} onValueChange={(v) => upd('sale_status', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {SALE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Linha</Label>
            <Select value={form.product_line || ''} onValueChange={(v) => upd('product_line', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {PRODUCT_LINES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Peça buscada</Label>
            <Input value={form.part_searched || ''} onChange={(e) => upd('part_searched', e.target.value)} />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={form.quantity ?? ''} onChange={(e) => upd('quantity', e.target.value)} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.sale_value ?? ''} onChange={(e) => upd('sale_value', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Nota da correção (opcional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Cliente pediu orçamento mas a IA marcou como sem resposta."
              rows={2}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Checkbox id="save-example" checked={saveAsExample} onCheckedChange={(v) => setSaveAsExample(!!v)} />
            <Label htmlFor="save-example" className="cursor-pointer text-sm font-normal">
              Salvar essa correção como exemplo de aprendizado para a IA
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

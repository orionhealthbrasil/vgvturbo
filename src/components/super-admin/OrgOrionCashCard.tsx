import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart, Gift, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { OrionCashIcon } from '@/components/orioncash/OrionCashIcon';

const OC_PER_USD = 10;
const MARGIN = 0.30;
function usdToOc(usd: number) { return usd * OC_PER_USD; }
function ocToUsd(oc: number) { return oc / OC_PER_USD; }
function clientPriceUsd(oc: number) { return ocToUsd(oc) / (1 - MARGIN); }
function fmtOc(oc: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(oc) + ' OC';
}

interface Props { organizationId: string; organizationName: string; }

export function OrgOrionCashCard({ organizationId, organizationName }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subtype, setSubtype] = useState<'purchased' | 'bonus'>('purchased');
  const [ocAmount, setOcAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: txRows = [], isLoading } = useQuery({
    queryKey: ['orioncash-super', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('amount, transaction_type, credit_subtype, created_at, description')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as { amount: number; transaction_type: string; credit_subtype: string | null; created_at: string; description: string | null }[];
    },
  });

  const balance = txRows.reduce((s, t) => s + Number(t.amount), 0);
  const balanceOc = usdToOc(balance);

  const addCredits = useMutation({
    mutationFn: async ({ amount, desc, subtype }: { amount: number; desc: string; subtype: 'purchased' | 'bonus' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-add-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ organization_id: organizationId, amount, description: desc || undefined, credit_subtype: subtype }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao adicionar créditos');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orioncash-super', organizationId] });
    },
  });

  const handleAdd = async () => {
    const oc = parseFloat(ocAmount);
    if (isNaN(oc) || oc <= 0) { toast.error('Informe um valor válido'); return; }
    try {
      await addCredits.mutateAsync({ amount: ocToUsd(oc), desc: description.trim(), subtype });
      toast.success(`+${fmtOc(oc)} liberados para ${organizationName}`);
      setDialogOpen(false);
      setOcAmount('');
      setDescription('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao liberar créditos');
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <OrionCashIcon size={28} />
              <CardTitle className="text-base">VGVCash</CardTitle>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />Liberar créditos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold font-mono tabular-nums" style={{
                  background: balanceOc <= 0 ? undefined : 'linear-gradient(90deg, #FFD700, #00D4AA)',
                  WebkitBackgroundClip: balanceOc <= 0 ? undefined : 'text',
                  WebkitTextFillColor: balanceOc <= 0 ? undefined : 'transparent',
                  backgroundClip: balanceOc <= 0 ? undefined : 'text',
                  color: balanceOc <= 0 ? 'hsl(var(--muted-foreground))' : undefined,
                }}>
                  {fmtOc(Math.max(0, balanceOc))}
                </p>
                {balanceOc <= 0 && <Badge variant="destructive" className="mb-1 text-xs">Esgotado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">= ${Math.max(0, balance).toFixed(4)} de custo API</p>

              {/* Últimas 5 transações */}
              {txRows.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold pt-1">Últimas transações</p>
                  {txRows.map((t, i) => {
                    const isCredit = t.transaction_type === 'credit';
                    const ocAmt = Math.abs(usdToOc(t.amount));
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          {isCredit
                            ? <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" />
                            : <ArrowDownLeft className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{t.description || (isCredit ? 'Recarga' : 'Uso IA')}</span>
                          {t.credit_subtype === 'bonus' && <Gift className="w-3 h-3 text-teal-500 shrink-0" />}
                          {t.credit_subtype === 'purchased' && <ShoppingCart className="w-3 h-3 text-yellow-500 shrink-0" />}
                        </div>
                        <span className={`font-mono tabular-nums shrink-0 ml-2 ${isCredit ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {isCredit ? '+' : '-'}{fmtOc(ocAmt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <OrionCashIcon size={28} />
              <DialogTitle>Liberar VGVCash</DialogTitle>
            </div>
            <DialogDescription>
              Liberando créditos para <strong>{organizationName}</strong>. Confirme o pagamento antes de prosseguir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de crédito</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubtype('purchased')}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    subtype === 'purchased'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                      : 'border-border text-muted-foreground hover:border-yellow-400'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />Compra
                </button>
                <button
                  type="button"
                  onClick={() => setSubtype('bonus')}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    subtype === 'bonus'
                      ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400'
                      : 'border-border text-muted-foreground hover:border-teal-400'
                  }`}
                >
                  <Gift className="w-4 h-4" />Bônus
                </button>
              </div>
              {subtype === 'purchased' && <p className="text-xs text-muted-foreground">Pix/pagamento confirmado. Gera receita.</p>}
              {subtype === 'bonus' && <p className="text-xs text-yellow-600 dark:text-yellow-500">Custo direto — sem receita. Use com parcimônia.</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Quantidade em OC</Label>
              <Input
                type="number" min="1" step="1" placeholder="100"
                value={ocAmount}
                onChange={e => setOcAmount(e.target.value)}
              />
              {ocAmount && !isNaN(parseFloat(ocAmount)) && parseFloat(ocAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Custo API: ${ocToUsd(parseFloat(ocAmount)).toFixed(2)}
                  {subtype === 'purchased' && ` · Receita esperada: $${clientPriceUsd(parseFloat(ocAmount)).toFixed(2)}`}
                  {subtype === 'bonus' && ' · Sem receita'}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observação <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                placeholder={subtype === 'purchased' ? 'ex: Pix confirmado em 29/08' : 'ex: Bônus de onboarding'}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={addCredits.isPending} className="gap-2">
              {addCredits.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Liberar créditos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownLeft, Gift, ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrionCash, usdToOc, fmtOc, type CreditTransaction } from '@/hooks/useOrionCash';
import { OrionCashIcon } from './OrionCashIcon';

interface OrionCashPanelProps { isAdmin?: boolean; }

function fmtDate(d: string) {
  return format(new Date(d), "dd MMM yy · HH:mm", { locale: ptBR });
}

function TxRow({ tx }: { tx: CreditTransaction }) {
  const isCredit = tx.amount > 0;
  const ocAmount = Math.abs(usdToOc(tx.amount));

  const subtypeBadge = tx.credit_subtype === 'purchased'
    ? <Badge variant="outline" className="text-xs gap-1 border-yellow-500/40 text-yellow-600"><ShoppingCart className="w-3 h-3" />Compra</Badge>
    : tx.credit_subtype === 'bonus'
    ? <Badge variant="outline" className="text-xs gap-1 border-teal-500/40 text-teal-600"><Gift className="w-3 h-3" />Bônus</Badge>
    : <Badge variant="secondary" className="text-xs">Débito IA</Badge>;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={isCredit ? 'text-emerald-500' : 'text-muted-foreground'}>
            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
          </span>
          <span className="text-sm">{tx.description || (isCredit ? 'Recarga' : 'Uso de IA')}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        <span className={isCredit ? 'text-emerald-500 font-semibold' : 'text-muted-foreground'}>
          {isCredit ? '+' : '-'}{fmtOc(ocAmount)}
        </span>
      </TableCell>
      <TableCell>{subtypeBadge}</TableCell>
      <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
        {fmtDate(tx.created_at)}
      </TableCell>
    </TableRow>
  );
}

export function OrionCashPanel({ isAdmin }: OrionCashPanelProps) {
  const { balance, transactions, ledgerRows, isLoading } = useOrionCash();

  const balanceOc = usdToOc(balance);
  const isLow = balance > 0 && balanceOc < 10;
  const isDepleted = balance <= 0;

  // Estatísticas de créditos comprados vs bônus — calculadas sobre o ledger completo,
  // não sobre a lista de transações recentes exibida (que é limitada para não crescer sem fim).
  const purchasedOc = usdToOc(ledgerRows.filter(t => t.credit_subtype === 'purchased').reduce((s, t) => s + Number(t.amount), 0));
  const bonusOc     = usdToOc(ledgerRows.filter(t => t.credit_subtype === 'bonus').reduce((s, t) => s + Number(t.amount), 0));
  const debitedOc   = usdToOc(Math.abs(ledgerRows.filter(t => t.transaction_type === 'debit').reduce((s, t) => s + Number(t.amount), 0)));

  return (
    <div className="space-y-6">

      {/* Saldo principal — card tech com gradiente */}
      <div
        className={`relative overflow-hidden rounded-xl border p-6 ${
          isDepleted ? 'border-destructive/60' : isLow ? 'border-yellow-500/60' : 'border-transparent'
        }`}
        style={{
          background: isDepleted
            ? 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 100%)'
            : 'linear-gradient(135deg, #070D1F 0%, #0d1a35 50%, #071a1a 100%)',
        }}
      >
        {/* Faixa de brilho decorativa */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isDepleted
              ? 'radial-gradient(ellipse at 80% 0%, rgba(239,68,68,0.15) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 80% 0%, rgba(0,212,170,0.18) 0%, transparent 60%), radial-gradient(ellipse at 20% 100%, rgba(255,215,0,0.12) 0%, transparent 60%)',
          }}
        />

        {/* Linha de gradiente top */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: isDepleted
              ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(0,212,170,0.6), rgba(255,215,0,0.4), transparent)',
          }}
        />

        <div className="relative space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <OrionCashIcon size={36} animated />
              <div>
                <p className="text-sm font-semibold text-white/80 uppercase tracking-widest">VGVCash</p>
                <p className="text-xs text-white/40">Créditos para uso da IA</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => window.open('https://wa.me/5579991658966?text=Ol%C3%A1!%20Gostaria%20de%20recarregar%20meu%20VGVCash.', '_blank')}
              className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
              variant="ghost"
            >
              <Plus className="w-4 h-4" />Adicionar créditos
            </Button>
          </div>

          {/* Saldo */}
          {isLoading ? (
            <Skeleton className="h-12 w-48 bg-white/10" />
          ) : (
            <div className="space-y-1">
              <p
                className="text-5xl font-bold font-mono tabular-nums tracking-tight"
                style={{
                  background: isDepleted
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : isLow
                    ? 'linear-gradient(90deg, #eab308, #fde047)'
                    : 'linear-gradient(90deg, #FFD700, #00D4AA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {fmtOc(Math.max(0, balanceOc))}
              </p>
              <div className="flex items-center gap-2">
                {isDepleted && <Badge variant="destructive" className="text-xs">IA pausada — saldo esgotado</Badge>}
                {isLow && !isDepleted && <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Saldo baixo</Badge>}
              </div>
            </div>
          )}

          {/* Barra de gradiente decorativa */}
          <div className="h-1 rounded-full overflow-hidden bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: isDepleted ? '0%' : '100%',
                background: isLow
                  ? 'linear-gradient(90deg, #eab308, #fde047)'
                  : 'linear-gradient(90deg, #FFD700, #00D4AA, #3B82F6)',
                boxShadow: isLow ? '0 0 8px rgba(234,179,8,0.5)' : '0 0 12px rgba(0,212,170,0.4)',
              }}
            />
          </div>

          {/* Breakdown */}
          {!isLoading && (purchasedOc > 0 || bonusOc > 0) && (
            <div className="flex gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 text-yellow-400/80">
                <ShoppingCart className="w-3 h-3" />
                <span className="font-mono tabular-nums">{fmtOc(purchasedOc)}</span>
                <span className="text-white/30">comprados</span>
              </div>
              <div className="flex items-center gap-1.5 text-teal-400/80">
                <Gift className="w-3 h-3" />
                <span className="font-mono tabular-nums">{fmtOc(bonusOc)}</span>
                <span className="text-white/30">bônus</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/30">
                <ArrowDownLeft className="w-3 h-3" />
                <span className="font-mono tabular-nums">{fmtOc(debitedOc)}</span>
                <span>consumidos</span>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Histórico de transações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma transação ainda.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">VGVCash</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => <TxRow key={tx.id} tx={tx} />)}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

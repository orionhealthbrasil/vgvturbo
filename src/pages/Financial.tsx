import { useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, Clock, AlertCircle, Loader2, Pencil, Trash2, Repeat } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useHasFeature } from '@/hooks/useOrganizationFeatures';
import {
  useFinancialAccounts,
  useFinancialCategories,
  useFinancialTransactions,
  useFinancialSummary,
  useUpsertTransaction,
  useDeleteTransaction,
  useUpsertAccount,
  useDeleteAccount,
  useUpsertCategory,
  useFinancialRecurrences,
  useUpsertRecurrence,
  useDeleteRecurrence,
} from '@/hooks/useFinancial';
import {
  STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  FREQUENCY_LABELS,
  type TransactionType,
  type FinancialTransaction,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialRecurrence,
} from '@/types/financial';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Financial() {
  const { data: hasFeature, isLoading: featureLoading } = useHasFeature('financial');

  if (featureLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasFeature) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Módulo Financeiro indisponível</h2>
        <p className="text-muted-foreground max-w-md">
          Este módulo ainda não foi liberado para a sua organização. Entre em contato com o suporte
          para ativar.
        </p>
      </div>
    );
  }

  return <FinancialContent />;
}

function FinancialContent() {
  const [period, setPeriod] = useState<'current' | '3m' | '6m' | '12m'>('current');
  const range = useMemo(() => {
    const end = endOfMonth(new Date());
    let start: Date;
    if (period === 'current') start = startOfMonth(new Date());
    else if (period === '3m') start = startOfMonth(subMonths(new Date(), 2));
    else if (period === '6m') start = startOfMonth(subMonths(new Date(), 5));
    else start = startOfMonth(subMonths(new Date(), 11));
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [period]);

  const { data: summary, isLoading: sumLoading } = useFinancialSummary(range.startDate, range.endDate);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Helmet>
        <title>Financeiro | VGV Turbo</title>
        <meta name="description" content="Controle financeiro: entradas, saídas, recorrências e relatórios." />
      </Helmet>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">
            Controle de entradas, saídas, recorrências e fluxo de caixa.
          </p>
        </div>

        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="Entradas"
          value={fmtBRL(summary?.totalIncome || 0)}
          loading={sumLoading}
        />
        <KPI
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          label="Saídas"
          value={fmtBRL(summary?.totalExpense || 0)}
          loading={sumLoading}
        />
        <KPI
          icon={<Wallet className="w-5 h-5 text-primary" />}
          label="Saldo"
          value={fmtBRL(summary?.balance || 0)}
          loading={sumLoading}
          highlight={(summary?.balance || 0) >= 0 ? 'positive' : 'negative'}
        />
        <KPI
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Pendente"
          value={`${fmtBRL(summary?.pendingIncome || 0)} / ${fmtBRL(summary?.pendingExpense || 0)}`}
          loading={sumLoading}
          subtitle="Receber / Pagar"
        />
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          <TabsTrigger value="dashboard">Relatórios</TabsTrigger>
          <TabsTrigger value="recurrences">Recorrências</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab summary={summary} loading={sumLoading} />
        </TabsContent>
        <TabsContent value="recurrences" className="mt-4">
          <RecurrencesTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  subtitle,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  loading?: boolean;
  highlight?: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {icon}
        </div>
        <div
          className={`text-xl font-bold ${
            highlight === 'positive' ? 'text-emerald-500' : highlight === 'negative' ? 'text-red-500' : ''
          }`}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : value}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

// ===================== TRANSACTIONS TAB =====================
function TransactionsTab() {
  const [filters, setFilters] = useState<{
    type?: TransactionType;
    status?: string;
    accountId?: string;
    search?: string;
  }>({});
  const [editing, setEditing] = useState<Partial<FinancialTransaction> | null>(null);

  const { data: txs = [], isLoading } = useFinancialTransactions(filters);
  const { data: accounts = [] } = useFinancialAccounts();
  const del = useDeleteTransaction();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <Input
            placeholder="Buscar por descrição..."
            value={filters.search || ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="md:max-w-xs"
          />
          <Select
            value={filters.type || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: v === 'all' ? undefined : (v as TransactionType) }))}
          >
            <SelectTrigger className="md:w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Entradas</SelectItem>
              <SelectItem value="expense">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}
          >
            <SelectTrigger className="md:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.accountId || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, accountId: v === 'all' ? undefined : v }))}
          >
            <SelectTrigger className="md:w-[180px]">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="md:ml-auto">
            <Button onClick={() => setEditing({ transaction_type: 'income', status: 'paid' })}>
              <Plus className="w-4 h-4 mr-2" /> Novo lançamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : txs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Nenhum lançamento neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">
                        {format(new Date(t.transaction_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.description}</div>
                        {t.contact && (
                          <div className="text-xs text-muted-foreground">{t.contact.name}</div>
                        )}
                        {t.source === 'pipeline_won' && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Pipeline
                          </Badge>
                        )}
                        {t.source === 'recurrence' && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            <Repeat className="w-3 h-3 mr-1" /> Recorrente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.category ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: t.category.color + '20', color: t.category.color }}
                          >
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.account ? (
                          <span className="inline-flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full" style={{ background: t.account.color }} />
                            {t.account.name}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.status === 'paid'
                              ? 'default'
                              : t.status === 'overdue'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {STATUS_LABELS[t.status]}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          t.transaction_type === 'income' ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {t.transaction_type === 'income' ? '+' : '-'} {fmtBRL(Number(t.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Remover este lançamento?')) del.mutate(t.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <TransactionDialog
          tx={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TransactionDialog({
  tx,
  onClose,
}: {
  tx: Partial<FinancialTransaction>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<FinancialTransaction>>(tx);
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: categories = [] } = useFinancialCategories(form.transaction_type);
  const upsert = useUpsertTransaction();

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      alert('Informe um valor maior que zero');
      return;
    }
    if (!form.description?.trim()) {
      alert('Informe uma descrição');
      return;
    }
    if (!form.account_id) {
      alert('Selecione uma conta');
      return;
    }
    await upsert.mutateAsync({
      ...form,
      amount: Number(form.amount),
      transaction_date: form.transaction_date || format(new Date(), 'yyyy-MM-dd'),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx.id ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.transaction_type === 'income' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, transaction_type: 'income', category_id: null })}
            >
              <TrendingUp className="w-4 h-4 mr-2" /> Entrada
            </Button>
            <Button
              type="button"
              variant={form.transaction_type === 'expense' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, transaction_type: 'expense', category_id: null })}
            >
              <TrendingDown className="w-4 h-4 mr-2" /> Saída
            </Button>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Input
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Venda do produto X"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.transaction_date || format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta *</Label>
              <Select
                value={form.account_id || ''}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category_id || 'none'}
                onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select
                value={form.status || 'paid'}
                onValueChange={(v: any) => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={form.payment_method || 'none'}
                onValueChange={(v: any) => setForm({ ...form, payment_method: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.status === 'pending' || form.status === 'overdue') && (
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== DASHBOARD TAB =====================
function DashboardTab({ summary, loading }: { summary: any; loading: boolean }) {
  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }
  if (!summary) return null;

  const monthData = (summary.byMonth || []).map((m: any) => ({
    month: format(new Date(m.month + '-01'), 'MMM/yy', { locale: ptBR }),
    Entradas: m.income,
    Saídas: m.expense,
  }));

  const incomeCats = summary.byCategory.filter((c: any) => c.type === 'income');
  const expenseCats = summary.byCategory.filter((c: any) => c.type === 'expense');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Fluxo mensal</CardTitle></CardHeader>
        <CardContent style={{ height: 300 }}>
          {monthData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center pt-12">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="Entradas" fill="hsl(142 76% 36%)" />
                <Bar dataKey="Saídas" fill="hsl(0 84% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Entradas por categoria</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {incomeCats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center pt-12">Sem entradas.</p>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={incomeCats} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {incomeCats.map((c: any, i: number) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <RTooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saídas por categoria</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {expenseCats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center pt-12">Sem saídas.</p>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expenseCats} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {expenseCats.map((c: any, i: number) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <RTooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Saldo por conta</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.byAccount.map((a: any) => (
              <div key={a.name} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                  <span className="font-medium">{a.name}</span>
                </div>
                <span className={`font-bold ${a.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {fmtBRL(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== ACCOUNTS TAB =====================
function AccountsTab() {
  const { data: accounts = [], isLoading } = useFinancialAccounts();
  const [editing, setEditing] = useState<Partial<FinancialAccount> | null>(null);
  const del = useDeleteAccount();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ account_type: 'cash', color: '#6366f1', initial_balance: 0 })}>
          <Plus className="w-4 h-4 mr-2" /> Nova conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma conta cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                        {a.name}
                      </div>
                    </TableCell>
                    <TableCell>{ACCOUNT_TYPE_LABELS[a.account_type]}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(a.initial_balance))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(a)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Remover esta conta?')) del.mutate(a.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <AccountDialog acc={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountDialog({ acc, onClose }: { acc: Partial<FinancialAccount>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<FinancialAccount>>(acc);
  const upsert = useUpsertAccount();

  const submit = async () => {
    if (!form.name?.trim()) { alert('Informe o nome'); return; }
    await upsert.mutateAsync({ ...form, initial_balance: Number(form.initial_balance) || 0 });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{acc.id ? 'Editar conta' : 'Nova conta'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.account_type || 'cash'} onValueChange={(v: any) => setForm({ ...form, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.color || '#6366f1'} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Saldo inicial</Label>
            <Input type="number" step="0.01" value={form.initial_balance ?? 0} onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== CATEGORIES TAB =====================
function CategoriesTab() {
  const { data: cats = [], isLoading } = useFinancialCategories();
  const [editing, setEditing] = useState<Partial<FinancialCategory> | null>(null);

  const incomeCats = cats.filter((c) => c.category_type === 'income');
  const expenseCats = cats.filter((c) => c.category_type === 'expense');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ category_type: 'expense', color: '#6366f1' })}>
          <Plus className="w-4 h-4 mr-2" /> Nova categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base text-emerald-500">Entradas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {incomeCats.map((c) => (
              <CategoryRow key={c.id} cat={c} onEdit={() => setEditing(c)} />
            ))}
            {incomeCats.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma categoria.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-red-500">Saídas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expenseCats.map((c) => (
              <CategoryRow key={c.id} cat={c} onEdit={() => setEditing(c)} />
            ))}
            {expenseCats.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma categoria.</p>}
          </CardContent>
        </Card>
      </div>

      {editing && <CategoryDialog cat={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryRow({ cat, onEdit }: { cat: FinancialCategory; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
        <span>{cat.name}</span>
        {cat.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
    </div>
  );
}

function CategoryDialog({ cat, onClose }: { cat: Partial<FinancialCategory>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<FinancialCategory>>(cat);
  const upsert = useUpsertCategory();

  const submit = async () => {
    if (!form.name?.trim()) { alert('Informe o nome'); return; }
    await upsert.mutateAsync(form);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{cat.id ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.category_type || 'expense'} onValueChange={(v: any) => setForm({ ...form, category_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="expense">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.color || '#6366f1'} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== RECURRENCES TAB =====================
function RecurrencesTab() {
  const { data: recs = [], isLoading } = useFinancialRecurrences();
  const { data: accounts = [] } = useFinancialAccounts();
  const [editing, setEditing] = useState<Partial<FinancialRecurrence> | null>(null);
  const del = useDeleteRecurrence();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          As recorrências são geradas automaticamente nas datas configuradas.
        </div>
        <Button
          onClick={() =>
            setEditing({
              transaction_type: 'expense',
              frequency: 'monthly',
              interval_count: 1,
              start_date: format(new Date(), 'yyyy-MM-dd'),
              next_run_date: format(new Date(), 'yyyy-MM-dd'),
              is_active: true,
            })
          }
        >
          <Plus className="w-4 h-4 mr-2" /> Nova recorrência
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : recs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma recorrência cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.description}</div>
                      {!r.is_active && <Badge variant="outline" className="text-xs mt-1">Pausada</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.transaction_type === 'income' ? 'default' : 'secondary'}>
                        {TRANSACTION_TYPE_LABELS[r.transaction_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{FREQUENCY_LABELS[r.frequency]} (×{r.interval_count})</TableCell>
                    <TableCell>{format(new Date(r.next_run_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtBRL(Number(r.amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm('Remover?')) del.mutate(r.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <RecurrenceDialog rec={editing} accounts={accounts} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurrenceDialog({
  rec,
  accounts,
  onClose,
}: {
  rec: Partial<FinancialRecurrence>;
  accounts: FinancialAccount[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<FinancialRecurrence>>(rec);
  const { data: cats = [] } = useFinancialCategories(form.transaction_type);
  const upsert = useUpsertRecurrence();

  const submit = async () => {
    if (!form.description?.trim() || !form.amount || !form.account_id) {
      alert('Preencha descrição, valor e conta');
      return;
    }
    await upsert.mutateAsync({
      ...form,
      amount: Number(form.amount),
      interval_count: Number(form.interval_count) || 1,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{rec.id ? 'Editar recorrência' : 'Nova recorrência'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={form.transaction_type === 'income' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, transaction_type: 'income', category_id: null })}>
              <TrendingUp className="w-4 h-4 mr-2" /> Entrada
            </Button>
            <Button type="button" variant={form.transaction_type === 'expense' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, transaction_type: 'expense', category_id: null })}>
              <TrendingDown className="w-4 h-4 mr-2" /> Saída
            </Button>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <Input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Conta *</Label>
              <Select value={form.account_id || ''} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequência</Label>
              <Select value={form.frequency || 'monthly'} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value, next_run_date: form.next_run_date || e.target.value })} />
            </div>
            <div>
              <Label>Fim (opcional)</Label>
              <Input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

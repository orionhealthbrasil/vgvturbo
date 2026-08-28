import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VGVTurboLogo } from '@/components/brand/VGVTurboLogo';
import { format, parseISO } from 'date-fns';
import { AnalysesDashboard } from '@/components/analytics/AnalysesDashboard';
import { AnalysesPagination } from '@/components/analytics/AnalysesPagination';

const STATUS_COLORS: Record<string, string> = {
  'VENDA': 'bg-green-500/20 text-green-700',
  'ORCAMENTO': 'bg-blue-500/20 text-blue-700',
  'PECA NAO ENCONTRADA': 'bg-red-500/20 text-red-700',
  'SEM RESPOSTA': 'bg-yellow-500/20 text-yellow-700',
  'NAO TRABALHAMOS COM A PECA': 'bg-orange-500/20 text-orange-700',
  'NAO SELECIONOU OPCAO': 'bg-muted text-muted-foreground',
};

export default function SharedAnalyses() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['shared-analyses', token],
    queryFn: async () => {
      if (!token) return [];
      const { data, error } = await supabase.rpc('get_shared_analyses', { p_token: token });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!token,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (!token) return;
    const channel = supabase
      .channel(`shared-analyses-${token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_analyses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shared-analyses', token] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token, queryClient]);

  const list = (analyses ?? []) as any[];

  const filtered = useMemo(() => {
    return list.filter((a) => {
      const matchesSearch = !search ||
        a.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        (a.phone && a.phone.includes(search));
      const matchesStatus = statusFilter === 'all' || a.sale_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [list, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <VGVTurboLogo />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !analyses) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <VGVTurboLogo />
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análises de Conversa</h1>
            <p className="text-muted-foreground text-sm">Atualização em tempo real</p>
          </div>
          <VGVTurboLogo />
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="table">Tabela</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <AnalysesDashboard analyses={list} />
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="VENDA">Venda</SelectItem>
                  <SelectItem value="ORCAMENTO">Orçamento</SelectItem>
                  <SelectItem value="PECA NAO ENCONTRADA">Peça não encontrada</SelectItem>
                  <SelectItem value="SEM RESPOSTA">Sem resposta</SelectItem>
                  <SelectItem value="NAO TRABALHAMOS COM A PECA">Não trabalhamos</SelectItem>
                  <SelectItem value="NAO SELECIONOU OPCAO">Não selecionou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Criado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhuma análise registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(a.analysis_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{a.customer_name}</TableCell>
                        <TableCell>{a.phone ?? '-'}</TableCell>
                        <TableCell>{a.lead_source ?? '-'}</TableCell>
                        <TableCell>
                          {a.sale_status ? (
                            <Badge variant="secondary" className={STATUS_COLORS[a.sale_status] ?? ''}>
                              {a.sale_status}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{a.product_line ?? '-'}</TableCell>
                        <TableCell>{a.part_searched ?? '-'}</TableCell>
                        <TableCell className="text-right">{a.quantity ?? '-'}</TableCell>
                        <TableCell className="text-right">
                          {a.sale_value != null
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(a.sale_value))
                            : '-'}
                        </TableCell>
                        <TableCell>{a.created_by ?? '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <AnalysesPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

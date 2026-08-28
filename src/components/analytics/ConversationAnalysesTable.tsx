import { useState, useMemo, useEffect } from 'react';
import { useConversationAnalyses, useShareAnalysisToken, type ConversationAnalysis } from '@/hooks/useConversationAnalyses';
import { AnalysesPagination } from './AnalysesPagination';
import { EditAnalysisDialog } from './EditAnalysisDialog';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useIsSuperAdmin } from '@/hooks/useSuperAdmin';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, Share2, Trash2, Copy, Check, Link2Off, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  'VENDA': 'bg-green-500/20 text-green-700',
  'ORCAMENTO': 'bg-blue-500/20 text-blue-700',
  'PECA NAO ENCONTRADA': 'bg-red-500/20 text-red-700',
  'SEM RESPOSTA': 'bg-yellow-500/20 text-yellow-700',
  'NAO TRABALHAMOS COM A PECA': 'bg-orange-500/20 text-orange-700',
  'NAO SELECIONOU OPCAO': 'bg-muted text-muted-foreground',
};

export function ConversationAnalysesTable() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const isOwner = orgData?.membership?.role === 'owner' || !!isSuperAdmin;
  const isAdmin = isOwner || orgData?.membership?.role === 'admin' || orgData?.membership?.member_role === 'admin';

  const { analyses, isLoading, deleteAnalysis } = useConversationAnalyses(orgId);
  const { shareToken, createToken, deactivateToken, isCreating } = useShareAnalysisToken(orgId);

  const [editing, setEditing] = useState<ConversationAnalysis | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const handleReanalyze = async (a: ConversationAnalysis) => {
    if (!a.contact_id) {
      toast.error('Esta análise não tem conversa vinculada para reanalisar.');
      return;
    }
    setReanalyzingId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke('reanalyze-conversation', {
        body: { analysis_id: a.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Análise reprocessada com sucesso');
    } catch (e: any) {
      toast.error('Erro ao reanalisar: ' + (e.message || e));
    } finally {
      setReanalyzingId(null);
    }
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    return analyses.filter(a => {
      const matchesSearch = !search ||
        a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (a.phone && a.phone.includes(search));
      const matchesStatus = statusFilter === 'all' || a.sale_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [analyses, search, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const exportCSV = () => {
    const headers = ['Data', 'Cliente', 'Telefone', 'Origem', 'Status Venda', 'Linha', 'Peça Buscada', 'Qtd', 'Valor', 'Atendente'];
    const rows = filtered.map(a => [
      a.analysis_date,
      a.customer_name,
      a.phone ?? '',
      a.lead_source ?? '',
      a.sale_status ?? '',
      a.product_line ?? '',
      a.part_searched ?? '',
      a.quantity?.toString() ?? '',
      a.sale_value?.toString() ?? '',
      a.created_by ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analises_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const shareUrl = shareToken
    ? `${window.location.origin}/analises-compartilhadas/${shareToken.share_token}`
    : null;

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[300px] w-full" />
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-1 min-w-0">
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          {isOwner && (
            <>
              {shareToken ? (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? 'Copiado' : 'Copiar Link'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deactivateToken(shareToken.id)}
                    title="Desativar link"
                  >
                    <Link2Off className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => createToken()} disabled={isCreating}>
                  <Share2 className="h-4 w-4 mr-1" /> Compartilhar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Table */}
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
              <TableHead>Atendente</TableHead>
              {isAdmin && <TableHead className="w-40 min-w-[140px] text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 11 : 10} className="text-center text-muted-foreground py-8">
                  Nenhuma análise registrada
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {format(parseISO(a.analysis_date), 'dd/MM/yyyy')}
                      {a.is_corrected && (
                        <Sparkles className="h-3 w-3 text-primary" aria-label="Corrigida" />
                      )}
                    </div>
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
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditing(a)}
                          title="Editar análise"
                          aria-label="Editar análise"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleReanalyze(a)}
                          disabled={reanalyzingId === a.id || !a.contact_id}
                          title="Reanalisar com IA"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${reanalyzingId === a.id ? 'animate-spin' : ''}`} />
                        </Button>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteAnalysis(a.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
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

      {orgId && (
        <EditAnalysisDialog
          analysis={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          organizationId={orgId}
        />
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, MessageSquareText, Phone, Trash2, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useDeleteReview } from '@/hooks/useReviews';
import { toast } from 'sonner';
import type { ReviewWithSalesperson } from '@/types/database';
import { getDefectColor, getDefectLabel } from '@/types/database';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface ReviewsTableProps {
  reviews: ReviewWithSalesperson[];
  hideSalespersonColumn?: boolean;
}

export function ReviewsTable({ reviews, hideSalespersonColumn = false }: ReviewsTableProps) {
  const { data: orgData } = useUserOrganization();
  const deleteReview = useDeleteReview();
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewWithSalesperson | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Selection state
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const canDelete = orgData?.membership.role === 'owner' || orgData?.membership.role === 'admin';

  // Pagination
  const totalPages = Math.ceil(reviews.length / itemsPerPage);
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return reviews.slice(start, start + itemsPerPage);
  }, [reviews, currentPage, itemsPerPage]);

  // Selection helpers
  const allPageSelected = paginatedReviews.length > 0 && 
    paginatedReviews.every(r => selectedReviews.has(r.id));
  const somePageSelected = paginatedReviews.some(r => selectedReviews.has(r.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const newSelected = new Set(selectedReviews);
      paginatedReviews.forEach(r => newSelected.delete(r.id));
      setSelectedReviews(newSelected);
    } else {
      const newSelected = new Set(selectedReviews);
      paginatedReviews.forEach(r => newSelected.add(r.id));
      setSelectedReviews(newSelected);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedReviews);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReviews(newSelected);
  };

  const clearSelection = () => {
    setSelectedReviews(new Set());
  };

  // Single delete handler
  const handleDelete = async () => {
    if (!reviewToDelete) return;
    try {
      await deleteReview.mutateAsync(reviewToDelete);
      toast.success('Avaliação excluída com sucesso');
    } catch {
      toast.error('Erro ao excluir avaliação');
    } finally {
      setReviewToDelete(null);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedReviews).map(id => 
        deleteReview.mutateAsync(id)
      );
      await Promise.all(deletePromises);
      toast.success(`${selectedReviews.size} avaliação(ões) excluída(s) com sucesso`);
      clearSelection();
    } catch {
      toast.error('Erro ao excluir algumas avaliações');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Export handler
  const handleExport = () => {
    const reviewsToExport = selectedReviews.size > 0 
      ? reviews.filter(r => selectedReviews.has(r.id))
      : reviews;
    
    const headers = ['Vendedor', 'Categoria', 'Tempo de Resposta (min)', 'Data', 'Telefone', 'Observações'];
    const csvContent = [
      headers.join(','),
      ...reviewsToExport.map(r => [
        `"${r.salespeople?.name || 'Desconhecido'}"`,
        `"${getDefectLabel(r.defect_type)}"`,
        r.response_time_minutes,
        format(new Date(r.review_date), 'yyyy-MM-dd'),
        r.phone || '',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `avaliacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`${reviewsToExport.length} avaliação(ões) exportada(s)`);
  };

  const columnCount = hideSalespersonColumn ? 8 : 9;

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            {hideSalespersonColumn ? 'Minhas Avaliações' : 'Todas as Avaliações'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar {selectedReviews.size > 0 ? `(${selectedReviews.size})` : 'Tudo'}
            </Button>
            <Select 
              value={String(itemsPerPage)} 
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} por pág.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* Bulk Actions Bar */}
        {selectedReviews.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary/10 border-y">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedReviews.size} avaliação(ões) selecionada(s)
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            </div>
            {canDelete && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Selecionados
              </Button>
            )}
          </div>
        )}

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                      className={somePageSelected && !allPageSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    />
                  </TableHead>
                  {!hideSalespersonColumn && <TableHead>Vendedor</TableHead>}
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tempo de Resposta</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                      Nenhuma avaliação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedReviews.map((review) => (
                    <TableRow 
                      key={review.id}
                      className={selectedReviews.has(review.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedReviews.has(review.id)}
                          onCheckedChange={() => toggleSelect(review.id)}
                          aria-label={`Selecionar avaliação`}
                        />
                      </TableCell>
                      {!hideSalespersonColumn && (
                        <TableCell className="font-medium">
                          {review.salespeople?.name || 'Desconhecido'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={getDefectColor(review.defect_type)}>
                          {getDefectLabel(review.defect_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{review.response_time_minutes} min</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(review.review_date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {review.phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {review.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {review.conversation_history ? (
                          <div className="flex items-center gap-1 text-primary">
                            <MessageSquareText className="w-4 h-4" />
                            <span className="text-xs">Ver</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {review.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedReview(review)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setReviewToDelete(review.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {reviews.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, reviews.length)} de {reviews.length} avaliações
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-2">
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => setSelectedReview(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Vendedor</p>
                  <p className="font-medium">{selectedReview.salespeople?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(new Date(selectedReview.review_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <Badge variant="outline" className={getDefectColor(selectedReview.defect_type)}>
                    {getDefectLabel(selectedReview.defect_type)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo de Resposta</p>
                  <p className="font-medium">{selectedReview.response_time_minutes} minutos</p>
                </div>
              {selectedReview.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone do Cliente</p>
                    <p className="font-medium">{selectedReview.phone}</p>
                  </div>
                )}
              </div>

              {selectedReview.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedReview.notes}</p>
                </div>
              )}

              {selectedReview.conversation_history && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Histórico da Conversa</p>
                  <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{selectedReview.conversation_history}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
      <AlertDialog open={!!reviewToDelete} onOpenChange={() => setReviewToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A avaliação será permanentemente removida do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedReviews.size} avaliação(ões)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as avaliações selecionadas serão permanentemente removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

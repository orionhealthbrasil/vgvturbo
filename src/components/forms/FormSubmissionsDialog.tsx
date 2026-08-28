import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFormSubmissions } from '@/hooks/useFormSubmissions';
import type { LeadForm } from '@/types/forms';

interface FormSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LeadForm | null;
}

export function FormSubmissionsDialog({ open, onOpenChange, form }: FormSubmissionsDialogProps) {
  const { data: submissions, isLoading } = useFormSubmissions(form?.id);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respostas — {form?.title}</DialogTitle>
          <DialogDescription>
            {submissions?.length || 0} submissão(ões). Atualiza em tempo real.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !submissions || submissions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma submissão ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Quando</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => {
                const isOpen = expanded.has(s.id);
                const summary = Object.entries(s.payload || {})
                  .slice(0, 2)
                  .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                  .join(' • ');
                return (
                  <>
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggle(s.id)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(s.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === 'processed'
                              ? 'default'
                              : s.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.contact_id ? (
                          <Button asChild size="sm" variant="link" className="h-auto p-0">
                            <Link to={`/chat?contact=${s.contact_id}`}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir chat
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                        {summary}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${s.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <pre className="text-xs whitespace-pre-wrap break-all p-2">
                            {JSON.stringify(s.payload, null, 2)}
                          </pre>
                          {s.error_message && (
                            <p className="text-xs text-destructive p-2">
                              Erro: {s.error_message}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

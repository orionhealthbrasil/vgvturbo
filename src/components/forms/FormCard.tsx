import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ClipboardList, Copy, Edit, ExternalLink, MoreVertical, Power, PowerOff, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadForm } from '@/types/forms';
import { useDeleteLeadForm, useUpdateLeadForm } from '@/hooks/useLeadForms';

interface FormCardProps {
  form: LeadForm;
  onEdit: (form: LeadForm) => void;
  onViewSubmissions: (form: LeadForm) => void;
}

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://vgvturbo.com.br';

export function FormCard({ form, onEdit, onViewSubmissions }: FormCardProps) {
  const updateMut = useUpdateLeadForm();
  const deleteMut = useDeleteLeadForm();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const publicUrl = `${PUBLIC_BASE}/f/${form.slug}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  const toggleActive = () => {
    updateMut.mutate({ id: form.id, is_active: !form.is_active });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      toast.warning('Clique novamente para confirmar exclusão');
      return;
    }
    deleteMut.mutate(form.id);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{form.title}</h3>
              <p className="text-xs text-muted-foreground truncate">/f/{form.slug}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(form)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewSubmissions(form)}>
                <Eye className="w-4 h-4 mr-2" /> Ver respostas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(publicUrl, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir página pública
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink}>
                <Copy className="w-4 h-4 mr-2" /> Copiar link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleActive}>
                {form.is_active ? (
                  <>
                    <PowerOff className="w-4 h-4 mr-2" /> Desativar
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 mr-2" /> Ativar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> {confirmDelete ? 'Confirmar?' : 'Excluir'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{form.submission_count}</strong> submissões
          </span>
          <span>•</span>
          <span>
            Atualizado{' '}
            {formatDistanceToNow(new Date(form.updated_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge variant={form.is_active ? 'default' : 'secondary'} className="text-xs">
            {form.is_active ? '● Ativo' : '○ Inativo'}
          </Badge>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => onViewSubmissions(form)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> Respostas
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

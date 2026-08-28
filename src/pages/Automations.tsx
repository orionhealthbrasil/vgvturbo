import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Loader2, Workflow, Power, PowerOff, Download, Upload, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
  useDuplicateAutomation,
  Automation,
  FlowData,
} from '@/hooks/useAutomations';

export default function Automations() {
  const navigate = useNavigate();
  const { data: automations = [], isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const updateAutomation = useUpdateAutomation();
  const duplicateAutomation = useDuplicateAutomation();

  const [deletingAutomation, setDeletingAutomation] = useState<Automation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    try {
      const automation = await createAutomation.mutateAsync('Nova Automação');
      navigate(`/automations/${automation.id}`);
      toast.success('Automação criada!');
    } catch (error) {
      toast.error('Erro ao criar automação');
    }
  };

  const handleDelete = async () => {
    if (!deletingAutomation) return;

    try {
      await deleteAutomation.mutateAsync(deletingAutomation.id);
      toast.success('Automação removida');
      setDeletingAutomation(null);
    } catch (error) {
      toast.error('Erro ao remover automação');
    }
  };

  const handleToggleActive = async (automation: Automation) => {
    try {
      await updateAutomation.mutateAsync({
        id: automation.id,
        is_active: !automation.is_active,
      });
      toast.success(automation.is_active ? 'Automação desativada' : 'Automação ativada');
    } catch (error) {
      toast.error('Erro ao atualizar automação');
    }
  };

  const handleDuplicate = async (automation: Automation) => {
    try {
      await duplicateAutomation.mutateAsync(automation);
      toast.success('Automação duplicada como rascunho!');
    } catch (error) {
      toast.error('Erro ao duplicar automação');
    }
  };

  const handleExport = (automation: Automation) => {
    const exportData = {
      name: automation.name,
      flow_data: automation.flow_data,
      exported_at: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${automation.name.replace(/[^a-zA-Z0-9]/g, '_')}_automacao.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Automação exportada!');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate required fields
      if (!data.name || !data.flow_data) {
        throw new Error('Arquivo inválido: campos obrigatórios ausentes');
      }

      // Validate flow_data structure
      const flowData = data.flow_data as FlowData;
      if (!Array.isArray(flowData.nodes) || !Array.isArray(flowData.edges)) {
        throw new Error('Arquivo inválido: estrutura de fluxo incorreta');
      }

      // Create new automation with imported data
      const automation = await createAutomation.mutateAsync(data.name + ' (Importado)');
      
      // Update with flow data
      await updateAutomation.mutateAsync({
        id: automation.id,
        flow_data: flowData,
      });

      toast.success('Automação importada com sucesso!');
      navigate(`/automations/${automation.id}`);
    } catch (error) {
      console.error('Import error:', error);
      if (error instanceof SyntaxError) {
        toast.error('Erro: arquivo JSON inválido');
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao importar automação');
      }
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Gerencie seus fluxos de automação</p>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Crie fluxos de conversa automatizados para WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button onClick={handleCreate} disabled={createAutomation.isPending}>
            {createAutomation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Nova Automação
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Fluxos de Automação
          </CardTitle>
          <CardDescription>
            {automations.length} automação{automations.length !== 1 ? 'ões' : ''} criada{automations.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[100px] text-center">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">Prioridade</TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      Automações com maior prioridade são executadas primeiro quando há múltiplos matches
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead>Atualizada em</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma automação criada. Crie a primeira!
                  </TableCell>
                </TableRow>
              ) : (
                automations.map((automation) => (
                  <TableRow key={automation.id}>
                    <TableCell className="font-medium">{automation.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateAutomation.mutate({ id: automation.id, priority: automation.priority + 1 })}
                          disabled={updateAutomation.isPending}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[24px]">{automation.priority}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateAutomation.mutate({ id: automation.id, priority: Math.max(0, automation.priority - 1) })}
                          disabled={updateAutomation.isPending || automation.priority === 0}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                        {automation.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(automation.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(automation.updated_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(automation)}
                            >
                              {automation.is_active ? (
                                <PowerOff className="w-4 h-4 text-destructive" />
                              ) : (
                                <Power className="w-4 h-4 text-primary" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{automation.is_active ? 'Desativar' : 'Ativar'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicate(automation)}
                              disabled={duplicateAutomation.isPending}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExport(automation)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar JSON</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/automations/${automation.id}`)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingAutomation(automation)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remover</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingAutomation} onOpenChange={() => setDeletingAutomation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletingAutomation?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

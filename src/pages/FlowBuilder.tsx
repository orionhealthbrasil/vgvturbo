import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Node, Edge } from '@xyflow/react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FlowCanvas } from '@/components/automations/FlowCanvas';
import { useAutomation, useUpdateAutomation } from '@/hooks/useAutomations';

export default function FlowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: automation, isLoading } = useAutomation(id);
  const updateAutomation = useUpdateAutomation();

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Store flow data in refs to avoid re-renders but keep latest values for save
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setIsActive(automation.is_active);
      const loadedNodes = (automation.flow_data?.nodes || []) as Node[];
      const loadedEdges = (automation.flow_data?.edges || []) as Edge[];
      nodesRef.current = loadedNodes;
      edgesRef.current = loadedEdges;
      setInitialNodes(loadedNodes);
      setInitialEdges(loadedEdges);
      isInitialLoadRef.current = true;
    }
  }, [automation]);

  const handleFlowChange = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    
    // Don't mark as unsaved on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = async () => {
    if (!id) return;

    try {
      await updateAutomation.mutateAsync({
        id,
        name,
        is_active: isActive,
        flow_data: { nodes: nodesRef.current, edges: edgesRef.current },
      });
      setHasUnsavedChanges(false);
      toast.success('Automação salva com sucesso!');
    } catch (error) {
      console.error('Error saving automation:', error);
      toast.error('Erro ao salvar automação');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Automação não encontrada</p>
          <Button onClick={() => navigate('/automations')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="text-lg font-semibold w-64"
            placeholder="Nome da Automação"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked);
                setHasUnsavedChanges(true);
              }}
            />
            <Label htmlFor="active" className="text-sm">
              {isActive ? 'Ativa' : 'Inativa'}
            </Label>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateAutomation.isPending}>
          {updateAutomation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {hasUnsavedChanges ? 'Salvar Alterações' : 'Salvar Fluxo'}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onFlowChange={handleFlowChange}
        />
      </div>
    </div>
  );
}

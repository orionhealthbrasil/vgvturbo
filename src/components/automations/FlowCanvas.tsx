import { useCallback, useRef, useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Undo2, Redo2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { useFlowHistory } from '@/hooks/useFlowHistory';

import DeletableEdge from './edges/DeletableEdge';

import TriggerNode from './nodes/TriggerNode';
import SendMessageNode from './nodes/SendMessageNode';
import DelayNode from './nodes/DelayNode';
import ManageTagNode from './nodes/ManageTagNode';
import ConditionNode from './nodes/ConditionNode';
import MoveColumnNode from './nodes/MoveColumnNode';
import WebhookNode from './nodes/WebhookNode';
import AssignNode from './nodes/AssignNode';
import WaitResponseNode from './nodes/WaitResponseNode';
import ConnectFlowNode from './nodes/ConnectFlowNode';
import { SaveResponseNode } from './nodes/SaveResponseNode';
import SendSurveyNode from './nodes/SendSurveyNode';
import ToggleAiNode from './nodes/ToggleAiNode';
import AnalyzeConversationNode from './nodes/AnalyzeConversationNode';
import ScheduleMessageNode from './nodes/ScheduleMessageNode';
import MoveFunnelStageNode from './nodes/MoveFunnelStageNode';
import SetDealValueNode from './nodes/SetDealValueNode';
import SetSaleResultNode from './nodes/SetSaleResultNode';
import SendEmailNode from './nodes/SendEmailNode';
import TriggerSdrNode from './nodes/TriggerSdrNode';
import CreateTaskNode from './nodes/CreateTaskNode';
import NotifyManagerNode from './nodes/NotifyManagerNode';
import { ElementsPalette } from './ElementsPalette';
import { PropertiesPanel } from './PropertiesPanel';

// Error Boundary for PropertiesPanel
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PropertiesPanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PropertiesPanel error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when children change (e.g., different node selected)
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-80 h-full border-l rounded-none flex flex-col">
          <CardContent className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <div>
              <p className="font-semibold text-sm">Erro ao carregar propriedades</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ocorreu um erro ao exibir as opções deste nó.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset();
              }}
            >
              Fechar painel
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  delay: DelayNode,
  manageTag: ManageTagNode,
  condition: ConditionNode,
  moveColumn: MoveColumnNode,
  webhook: WebhookNode,
  assign: AssignNode,
  waitResponse: WaitResponseNode,
  connectFlow: ConnectFlowNode,
  saveResponse: SaveResponseNode,
  sendSurvey: SendSurveyNode,
  toggleAi: ToggleAiNode,
  analyzeConversation: AnalyzeConversationNode,
  scheduleMessage: ScheduleMessageNode,
  moveFunnelStage: MoveFunnelStageNode,
  setDealValue: SetDealValueNode,
  setSaleResult: SetSaleResultNode,
  sendEmail: SendEmailNode,
  triggerSdr: TriggerSdrNode,
  createTask: CreateTaskNode,
  notify_manager: NotifyManagerNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  type: 'deletable',
  animated: true,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
};

interface FlowCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onFlowChange?: (nodes: Node[], edges: Edge[]) => void;
}

export function FlowCanvas({ initialNodes = [], initialEdges = [], onFlowChange }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const isInitializedRef = useRef(false);
  const prevInitialNodesRef = useRef<string>('');
  const prevInitialEdgesRef = useRef<string>('');
  
  // History for undo/redo
  const { saveState, undo, redo, canUndo, canRedo, clearHistory } = useFlowHistory();
  const isHistoryActionRef = useRef(false);

  // Sync with initial data when it changes (e.g., after loading from DB)
  useEffect(() => {
    const nodesKey = JSON.stringify(initialNodes);
    const edgesKey = JSON.stringify(initialEdges);
    
    // Only update if initialNodes/initialEdges actually changed from external source
    if (nodesKey !== prevInitialNodesRef.current || edgesKey !== prevInitialEdgesRef.current) {
      prevInitialNodesRef.current = nodesKey;
      prevInitialEdgesRef.current = edgesKey;
      setNodes(initialNodes);
      setEdges(initialEdges);
      isInitializedRef.current = true;
      clearHistory();
      // Save initial state
      if (initialNodes.length > 0 || initialEdges.length > 0) {
        saveState(initialNodes, initialEdges);
      }
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, clearHistory, saveState]);

  // Notify parent and save to history whenever nodes or edges change
  useEffect(() => {
    if (isInitializedRef.current) {
      onFlowChange?.(nodes, edges);
      
      // Save to history unless this was an undo/redo action
      if (!isHistoryActionRef.current) {
        saveState(nodes, edges);
      }
      isHistoryActionRef.current = false;
    }
  }, [nodes, edges, onFlowChange, saveState]);

  // Handle undo
  const handleUndo = useCallback(() => {
    const state = undo();
    if (state) {
      isHistoryActionRef.current = true;
      setNodes(state.nodes);
      setEdges(state.edges);
      setSelectedNode(null);
    }
  }, [undo, setNodes, setEdges]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const state = redo();
    if (state) {
      isHistoryActionRef.current = true;
      setNodes(state.nodes);
      setEdges(state.edges);
      setSelectedNode(null);
    }
  }, [redo, setNodes, setEdges]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const defaultData: Record<string, unknown> = {};
      
      switch (type) {
        case 'trigger':
          defaultData.label = 'Gatilho';
          defaultData.triggerType = '';
          break;
        case 'sendMessage':
          defaultData.label = 'Enviar Mensagem';
          defaultData.message = '';
          defaultData.mediaUrl = '';
          break;
        case 'delay':
          defaultData.label = 'Delay';
          defaultData.duration = 0;
          defaultData.unit = 'minutes';
          break;
        case 'manageTag':
          defaultData.label = 'Gerenciar Tag';
          defaultData.action = 'add';
          defaultData.tagName = '';
          break;
        case 'condition':
          defaultData.label = 'Condição';
          defaultData.conditionType = 'contains';
          defaultData.value = '';
          defaultData.caseSensitive = false;
          break;
        case 'moveColumn':
          defaultData.label = 'Mover no Kanban';
          defaultData.columnName = '';
          break;
        case 'webhook':
          defaultData.label = 'Webhook';
          defaultData.method = 'POST';
          defaultData.url = '';
          break;
        case 'assign':
          defaultData.label = 'Atribuir Conversa';
          defaultData.assignTo = 'specific';
          defaultData.memberName = '';
          break;
        case 'waitResponse':
          defaultData.label = 'Aguardar Resposta';
          defaultData.timeout = 5;
          defaultData.timeoutUnit = 'minutes';
          break;
        case 'connectFlow':
          defaultData.label = 'Conectar Fluxo';
          defaultData.targetFlowId = '';
          defaultData.targetFlowName = '';
          break;
        case 'saveResponse':
          defaultData.label = 'Salvar Resposta';
          defaultData.variableName = '';
          defaultData.timeout = 5;
          defaultData.timeoutUnit = 'minutes';
          break;
        case 'sendSurvey':
          defaultData.label = 'Pesquisa de Satisfação';
          defaultData.message = '{saudacao}, {primeiro_nome}! Gostaríamos de saber como foi seu atendimento. Acesse: {link_pesquisa}';
          break;
        case 'analyzeConversation':
          defaultData.label = 'Analisar Conversa';
          defaultData.agentId = '';
          defaultData.contextMessages = 20;
          defaultData.additionalPrompt = '';
          break;
        case 'scheduleMessage':
          defaultData.label = 'Agendar Mensagem';
          defaultData.message = '';
          defaultData.offsetDays = 1;
          break;
        case 'moveFunnelStage':
          defaultData.label = 'Mover Etapa do Funil';
          defaultData.stageName = '';
          break;
        case 'setDealValue':
          defaultData.label = 'Definir Valor Potencial';
          defaultData.operation = 'set';
          defaultData.value = '';
          break;
        case 'setSaleResult':
          defaultData.label = 'Marcar Resultado';
          defaultData.result = 'won';
          defaultData.lossReason = '';
          break;
        case 'sendEmail':
          defaultData.label = 'Enviar Email';
          defaultData.to = '{email}';
          defaultData.customTo = '';
          defaultData.subject = '';
          defaultData.content = '';
          defaultData.htmlMode = false;
          defaultData.cc = '';
          defaultData.bcc = '';
          break;
        case 'triggerSdr':
          defaultData.label = 'Acionar SDR';
          defaultData.agentId = '';
          defaultData.additionalInstructions = '';
          break;
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: defaultData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNode = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...newData },
            };
          }
          return node;
        })
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...prev.data, ...newData } }
          : prev
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const nodeToDuplicate = nodes.find((n) => n.id === nodeId);
      if (!nodeToDuplicate) return;

      const newNode: Node = {
        id: `${nodeToDuplicate.type}-${Date.now()}`,
        type: nodeToDuplicate.type,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
        data: { ...nodeToDuplicate.data },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [nodes, setNodes]
  );

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0">
        <ElementsPalette onDragStart={onDragStart} />
      </div>
      
      <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
        {/* Undo/Redo buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleUndo}
                disabled={!canUndo}
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRedo}
                disabled={!canRedo}
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          deleteKeyCode={['Backspace', 'Delete']}
          className="bg-muted/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-background border"
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="w-80 shrink-0">
          <PropertiesPanelErrorBoundary 
            key={selectedNode.id}
            onReset={() => setSelectedNode(null)}
          >
            <PropertiesPanel
              selectedNode={selectedNode}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onClose={() => setSelectedNode(null)}
            />
          </PropertiesPanelErrorBoundary>
        </div>
      )}
    </div>
  );
}

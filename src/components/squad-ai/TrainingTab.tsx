import { useState, useRef } from 'react';
import {
  Plus, Trash2, Upload, MessageSquare, ChevronDown, ChevronRight,
  Loader2, ArrowLeft, Send, Image as ImageIcon, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useTrainingConversations,
  useCreateTrainingConversation,
  useDeleteTrainingConversation,
  useExtractConversationFromImage,
  TrainingMessage,
  TrainingConversation,
} from '@/hooks/useAiTraining';

// ── Helpers ────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MsgBubble({
  msg,
  onEdit,
  onRemove,
  onChangeRole,
}: {
  msg: TrainingMessage & { _id: number };
  onEdit: (content: string) => void;
  onRemove: () => void;
  onChangeRole: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const isOut = msg.role === 'outbound';

  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn('group relative max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm', isOut ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[60px] text-sm bg-background text-foreground"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setDraft(msg.content); setEditing(false); }}>
                Cancelar
              </Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => { onEdit(draft); setEditing(false); }}>
                <Check className="h-3 w-3 mr-1" /> OK
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        )}
        {!editing && (
          <div className={cn(
            'absolute top-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
            isOut ? '-left-20' : '-right-20',
          )}>
            <button type="button" title="Editar" onClick={() => setEditing(true)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <MessageSquare className="h-3 w-3" />
            </button>
            <button type="button" title={isOut ? 'Marcar como recebida' : 'Marcar como enviada'} onClick={onChangeRole}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-mono">
              {isOut ? '←' : '→'}
            </button>
            <button type="button" title="Remover" onClick={onRemove}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <span className={cn('text-[10px] mt-0.5 block', isOut ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
          {isOut ? 'Enviada' : 'Recebida'}
        </span>
      </div>
    </div>
  );
}

// ── Conversation card (collapsed) ─────────────────────────────────────────

function ConversationCard({
  conv,
  agentId,
  onDelete,
}: {
  conv: TrainingConversation;
  agentId: string;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const msgs = conv.messages || [];

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium truncate">{conv.title}</span>
        <Badge variant="secondary" className="text-[11px] shrink-0">{msgs.length} msgs</Badge>
        {conv.source === 'screenshot' && (
          <Badge variant="outline" className="text-[11px] shrink-0"><ImageIcon className="h-3 w-3 mr-1" />Print</Badge>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Excluir conversa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </button>

      {expanded && msgs.length > 0 && (
        <div className="border-t px-3 py-3 space-y-2">
          {msgs.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'outbound' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                m.role === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <span className={cn('text-[10px] mt-0.5 block', m.role === 'outbound' ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {m.role === 'outbound' ? 'Enviada' : 'Recebida'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Conversation editor (new conversation flow) ────────────────────────────

type EditorMsg = TrainingMessage & { _id: number };

function ConversationEditor({
  agentId,
  onDone,
}: {
  agentId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [msgs, setMsgs] = useState<EditorMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [draftRole, setDraftRole] = useState<'inbound' | 'outbound'>('inbound');
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const createConv = useCreateTrainingConversation();
  const extractVision = useExtractConversationFromImage();

  const mkId = () => ++nextId.current;

  const addMsg = () => {
    if (!draft.trim()) return;
    setMsgs((prev) => [...prev, { _id: mkId(), role: draftRole, content: draft.trim(), position: prev.length }]);
    setDraft('');
    // alternate role for faster input
    setDraftRole((r) => r === 'inbound' ? 'outbound' : 'inbound');
  };

  const editMsg = (id: number, content: string) =>
    setMsgs((prev) => prev.map((m) => m._id === id ? { ...m, content } : m));

  const removeMsg = (id: number) =>
    setMsgs((prev) => prev.filter((m) => m._id !== id));

  const changeRole = (id: number) =>
    setMsgs((prev) => prev.map((m) => m._id === id ? { ...m, role: m.role === 'inbound' ? 'outbound' : 'inbound' } : m));

  const handleFile = async (file: File) => {
    setExtracting(true);
    try {
      const b64 = await fileToBase64(file);
      const extracted = await extractVision.mutateAsync(b64);
      if (extracted.length === 0) {
        toast.error('Não foi possível extrair mensagens. Tente um print mais claro.');
        return;
      }
      setMsgs((prev) => [
        ...prev,
        ...extracted.map((m, i) => ({ ...m, _id: mkId(), position: prev.length + i })),
      ]);
      toast.success(`${extracted.length} mensagens extraídas — edite se necessário.`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar print.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Dê um título para a conversa'); return; }
    if (msgs.length === 0) { toast.error('Adicione pelo menos uma mensagem'); return; }
    try {
      await createConv.mutateAsync({ agentId, title: title.trim(), source: 'manual', messages: msgs });
      toast.success('Conversa de treinamento salva!');
      onDone();
    } catch {
      toast.error('Erro ao salvar conversa');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back + title */}
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={onDone} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da conversa (ex: Cliente perguntando preço)"
          className="flex-1 h-8 text-sm"
        />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 border rounded-lg p-3 mb-3">
        <div className="space-y-2 min-h-[120px]">
          {msgs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Adicione mensagens abaixo ou importe um print de conversa.
            </p>
          )}
          {msgs.map((m) => (
            <MsgBubble
              key={m._id}
              msg={m}
              onEdit={(c) => editMsg(m._id, c)}
              onRemove={() => removeMsg(m._id)}
              onChangeRole={() => changeRole(m._id)}
            />
          ))}

        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="space-y-2">
        {/* Role toggle */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDraftRole('inbound')}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors border',
              draftRole === 'inbound' ? 'bg-muted border-muted-foreground/30 text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/50',
            )}
          >
            ← Recebida (cliente)
          </button>
          <button
            type="button"
            onClick={() => setDraftRole('outbound')}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors border',
              draftRole === 'outbound' ? 'bg-primary/10 border-primary/40 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/50',
            )}
          >
            Enviada (empresa) →
          </button>
        </div>

        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMsg(); } }}
            placeholder="Digite a mensagem... (Enter para adicionar)"
            className="flex-1 min-h-[60px] text-sm resize-none"
          />
          <div className="flex flex-col gap-1.5">
            <Button type="button" size="icon" onClick={addMsg} className="h-8 w-8 shrink-0" title="Adicionar mensagem">
              <Send className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              title="Importar print de conversa"
              disabled={extracting}
              onClick={() => fileRef.current?.click()}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <p className="text-[11px] text-muted-foreground">
          Shift+Enter para nova linha. Clique em <Upload className="inline h-3 w-3 mx-0.5" /> para importar um print de conversa via IA.
        </p>
      </div>

      {/* Save */}
      <div className="flex justify-end mt-3">
        <Button onClick={handleSave} disabled={createConv.isPending} size="sm">
          {createConv.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Salvar conversa
        </Button>
      </div>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────

export function TrainingTab({ agentId }: { agentId: string }) {
  const { data: conversations = [], isLoading } = useTrainingConversations(agentId);
  const deleteConv = useDeleteTrainingConversation();
  const [adding, setAdding] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteConv.mutateAsync({ id, agentId });
      toast.success('Conversa excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  if (adding) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[400px] flex flex-col">
        <ConversationEditor agentId={agentId} onDone={() => setAdding(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Conversas de treinamento</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exemplos reais de atendimento que a IA usa como referência de tom de voz e estilo de comunicação.
            Adicione prints de conversas ou insira manualmente.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova conversa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione exemplos reais para a IA aprender o tom de voz da empresa.
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar primeira conversa
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              agentId={agentId}
              onDelete={() => handleDelete(conv.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

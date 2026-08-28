import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Wrench, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AiAgent } from '@/hooks/useAiAgents';
import { useUserOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; result: any }[];
}

interface SystemAgentChatProps {
  agent: AiAgent;
  onClose: () => void;
}

export function SystemAgentChat({ agent, onClose }: SystemAgentChatProps) {
  const { data: orgData } = useUserOrganization();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !orgData) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build messages array for the API (just role + content)
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-system-agent', {
        body: {
          agent_id: agent.id,
          organization_id: orgData.organization.id,
          messages: apiMessages,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro desconhecido');
      }

      const data = fnData;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content || 'Sem resposta.',
        toolCalls: data.tool_calls?.length ? data.tool_calls : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Erro: ${(e as Error).message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className={`flex flex-col border rounded-lg bg-background overflow-hidden ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[500px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-md bg-violet-500 text-white">
            <Bot className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm truncate">{agent.name}</span>
          <Badge variant="secondary" className="text-xs">Sistema</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Converse com <strong>{agent.name}</strong> para executar ações no sistema.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ex: "Liste os contatos abertos", "Adicione a tag X ao contato Y"
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="p-1 rounded bg-violet-500/10 text-violet-500 h-fit mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'order-first' : ''}`}>
                {/* Tool calls badges */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.toolCalls.map((tc, j) => (
                      <Badge key={j} variant="outline" className="text-xs font-mono gap-1">
                        <Wrench className="w-3 h-3" />
                        {tc.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className={`rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="p-1 rounded bg-primary/10 text-primary h-fit mt-1">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="p-1 rounded bg-violet-500/10 text-violet-500 h-fit mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-muted-foreground">Processando...</span>
              </div>
            </div>
          )}
        </div>
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Loader2, MessageCircle, CheckCircle2, ExternalLink, Send, ArrowLeft, Inbox, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useCanAccess } from '@/hooks/usePermissions';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CommentRow = {
  id: string;
  organization_id: string;
  ig_comment_id: string;
  ig_media_id: string | null;
  parent_comment_id: string | null;
  from_username: string | null;
  text: string | null;
  permalink: string | null;
  received_at: string;
  replied_at: string | null;
  reply_text: string | null;
};

type Filter = 'pending' | 'replied' | 'all';

export default function InstagramComments() {
  const { data: orgData } = useUserOrganization();
  const queryClient = useQueryClient();
  const { canEdit } = useCanAccess('connection');
  const orgId = orgData?.organization?.id;
  const [filter, setFilter] = useState<Filter>('pending');

  const { data: comments, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['instagram-comments', orgId, filter],
    queryFn: async (): Promise<CommentRow[]> => {
      if (!orgId) return [];
      let query = supabase
        .from('instagram_comments')
        .select('id, organization_id, ig_comment_id, ig_media_id, parent_comment_id, from_username, text, permalink, received_at, replied_at, reply_text')
        .eq('organization_id', orgId)
        .order('received_at', { ascending: false })
        .limit(200);

      if (filter === 'pending') query = query.is('replied_at', null);
      if (filter === 'replied') query = query.not('replied_at', 'is', null);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CommentRow[];
    },
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const pendingCount = comments?.filter(c => !c.replied_at).length || 0;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/conexoes?tab=instagram"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6" /> Comentários do Instagram
          </h1>
          <p className="text-muted-foreground text-sm">
            Caixa de entrada de comentários nos seus posts. Responda diretamente daqui.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base">Caixa de entrada</CardTitle>
            <CardDescription>
              {pendingCount > 0
                ? `${pendingCount} comentário${pendingCount > 1 ? 's' : ''} aguardando resposta`
                : 'Nenhum comentário pendente'}
            </CardDescription>
          </div>
          <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="replied">Respondidos</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !comments || comments.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} canEdit={canEdit} orgId={orgId!} onReplied={() => queryClient.invalidateQueries({ queryKey: ['instagram-comments'] })} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { title: string; desc: string }> = {
    pending: {
      title: 'Tudo em dia!',
      desc: 'Nenhum comentário aguardando resposta.',
    },
    replied: {
      title: 'Sem respostas ainda',
      desc: 'Nenhum comentário respondido até o momento.',
    },
    all: {
      title: 'Sem comentários',
      desc: 'Quando alguém comentar nos seus posts, aparecerá aqui.',
    },
  };
  const m = messages[filter];
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium">{m.title}</p>
      <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  orgId,
  onReplied,
}: {
  comment: CommentRow;
  canEdit: boolean;
  orgId: string;
  onReplied: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const initials = (comment.from_username || '?').slice(0, 2).toUpperCase();
  const received = formatDistanceToNow(new Date(comment.received_at), { addSuffix: true, locale: ptBR });

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-reply-comment', {
        body: {
          organization_id: orgId,
          comment_id: comment.id,
          message: replyText.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Resposta enviada!');
      setReplying(false);
      setReplyText('');
      onReplied();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao enviar resposta');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-3 p-4 rounded-lg border bg-card">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">@{comment.from_username || 'desconhecido'}</span>
          <span className="text-xs text-muted-foreground">{received}</span>
          {comment.replied_at ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Respondido
            </Badge>
          ) : (
            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Pendente</Badge>
          )}
          {comment.permalink && (
            <a
              href={comment.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Ver post <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap break-words">{comment.text || <span className="text-muted-foreground italic">(sem texto)</span>}</p>

        {comment.replied_at && comment.reply_text && (
          <div className="mt-2 ml-2 pl-3 border-l-2 border-primary/40 bg-muted/30 rounded-r p-2">
            <div className="flex items-center gap-2 mb-1">
              <Instagram className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">Sua resposta</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.replied_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{comment.reply_text}</p>
          </div>
        )}

        {!comment.replied_at && canEdit && (
          <PermissionGuard permission="connection" requireEdit>
            {!replying ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplying(true)}
                className="mt-1"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Responder
              </Button>
            ) : (
              <div className="space-y-2 mt-2">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  rows={3}
                  maxLength={300}
                  autoFocus
                  disabled={sending}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{replyText.length}/300</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReplying(false); setReplyText(''); }}
                      disabled={sending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={sending || !replyText.trim()}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Enviar resposta
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </PermissionGuard>
        )}
      </div>
    </div>
  );
}

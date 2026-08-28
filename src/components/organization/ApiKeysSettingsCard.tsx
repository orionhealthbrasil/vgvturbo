import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Copy, Check, Loader2, Eye, EyeOff, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// SHA-256 hash
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'oc_';
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

interface ApiKeysSettingsCardProps {
  organizationId: string;
}

export function ApiKeysSettingsCard({ organizationId }: ApiKeysSettingsCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 11); // "oc_" + 8 chars

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('api_keys')
        .insert({
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          organization_id: organizationId,
          created_by: user.id,
        });

      if (error) throw error;
      return rawKey;
    },
    onSuccess: (rawKey) => {
      setNewlyCreatedKey(rawKey);
      setShowCreateDialog(false);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API Key criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating API key:', error);
      toast.error(`Erro ao criar API Key: ${error.message}`);
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase.from('api_keys').delete().eq('id', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setKeyToDelete(null);
      toast.success('API Key revogada');
    },
    onError: () => toast.error('Erro ao revogar API Key'),
  });

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const mcpUrl = 'https://atnjikvdbvyvyabsxctj.supabase.co/functions/v1/mcp-server';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">API Keys (MCP Server)</CardTitle>
                <CardDescription>
                  Gerencie chaves de API para agentes externos se conectarem ao VGV Turbo via MCP
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Chave
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MCP Endpoint Info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">Endpoint MCP:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                {mcpUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => {
                  navigator.clipboard.writeText(mcpUrl);
                  toast.success('URL copiada!');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Use este endpoint com o header <code className="bg-background px-1 rounded">x-api-key</code> para conectar agentes MCP.
              </p>
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs gap-1"
                onClick={() => window.open('/docs/mcp', '_blank')}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Ver documentação
              </Button>
            </div>
          </div>

          {/* Keys Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma API Key criada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {key.key_prefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setKeyToDelete({ id: key.id, name: key.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova API Key</DialogTitle>
            <DialogDescription>
              Dê um nome descritivo para identificar esta chave (ex: "Agente IA", "n8n").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome da chave</Label>
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Ex: Agente de Triagem"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createKeyMutation.mutate(keyName)}
              disabled={!keyName.trim() || createKeyMutation.isPending}
            >
              {createKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show newly created key */}
      <Dialog open={!!newlyCreatedKey} onOpenChange={() => setNewlyCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key criada! 🔑</DialogTitle>
            <DialogDescription>
              Copie esta chave agora. Ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <code className="text-sm flex-1 break-all">{newlyCreatedKey}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyKey(newlyCreatedKey!)}
              >
                {copiedKey ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-lg p-2">
              ⚠️ Esta é a única vez que você verá esta chave completa. Guarde-a em local seguro.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewlyCreatedKey(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar a chave "{keyToDelete?.name}"? 
              Agentes que usam esta chave perderão acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => keyToDelete && deleteKeyMutation.mutate(keyToDelete.id)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

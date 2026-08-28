import { useState } from 'react';
import { Plus, Copy, Power, Trash2, Calendar, Users, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useOwnerInvites,
  useCreateOwnerInvite,
  useDeactivateOwnerInvite,
  useDeleteOwnerInvite,
} from '@/hooks/useOrganizationInvites';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdminOwnerInvites() {
  const { data: invites, isLoading } = useOwnerInvites();
  const createInvite = useCreateOwnerInvite();
  const deactivateInvite = useDeactivateOwnerInvite();
  const deleteInvite = useDeleteOwnerInvite();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [maxUses, setMaxUses] = useState<string>('1');

  const buildLink = (code: string) =>
    `${window.location.origin}/auth?invite=${code}`;

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(buildLink(code));
    toast.success('Link copiado!');
  };

  const handleCreate = async () => {
    try {
      const opts: { expiresInDays?: number; maxUses?: number } = {};
      const days = parseInt(expiresInDays, 10);
      if (!isNaN(days) && days > 0) opts.expiresInDays = days;
      const uses = parseInt(maxUses, 10);
      if (!isNaN(uses) && uses > 0) opts.maxUses = uses;

      const invite = await createInvite.mutateAsync(opts);
      toast.success('Convite de owner criado!');
      setDialogOpen(false);
      // Auto-copy
      try {
        await navigator.clipboard.writeText(buildLink(invite.invite_code));
        toast.message('Link copiado para a área de transferência');
      } catch {/* ignore */}
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar convite');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateInvite.mutateAsync(id);
      toast.success('Convite desativado');
    } catch {
      toast.error('Erro ao desativar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvite.mutateAsync(id);
      toast.success('Convite removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Convites de Owner</h1>
          <p className="text-muted-foreground mt-1">
            Gere links de cadastro para novos donos de empresa. Cada link permite criar uma conta + nova empresa no VGV Turbo.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo convite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar convite de owner</DialogTitle>
              <DialogDescription>
                Configure validade e número máximo de usos. Após criar, o link será copiado automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="expires">Validade (em dias)</Label>
                <Input
                  id="expires"
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="Deixe vazio para sem expiração"
                />
                <p className="text-xs text-muted-foreground">Padrão: 30 dias.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-uses">Máximo de usos</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Sem limite"
                />
                <p className="text-xs text-muted-foreground">Padrão: 1 (uso único).</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createInvite.isPending}>
                {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar convite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !invites || invites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">Nenhum convite criado</p>
            <p className="text-sm text-muted-foreground">
              Gere o primeiro convite para liberar o cadastro de uma nova empresa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invites.map((invite) => {
            const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
            const isUsedUp = invite.max_uses != null && invite.use_count >= invite.max_uses;
            const isAvailable = invite.is_active && !isExpired && !isUsedUp;

            return (
              <Card key={invite.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="font-mono text-base">{invite.invite_code}</CardTitle>
                      <CardDescription className="break-all">
                        {buildLink(invite.invite_code)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isAvailable ? (
                        <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          Ativo
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary">Expirado</Badge>
                      ) : isUsedUp ? (
                        <Badge variant="secondary">Esgotado</Badge>
                      ) : (
                        <Badge variant="outline">Desativado</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Criado em</p>
                      <p className="flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(invite.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expira em</p>
                      <p className="font-medium">
                        {invite.expires_at
                          ? format(new Date(invite.expires_at), "dd 'de' MMM yyyy", { locale: ptBR })
                          : 'Sem expiração'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Usos</p>
                      <p className="flex items-center gap-1.5 font-medium">
                        <Users className="h-3.5 w-3.5" />
                        {invite.use_count}
                        {invite.max_uses != null ? ` / ${invite.max_uses}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(invite.invite_code)}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copiar link
                    </Button>

                    {invite.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivate(invite.id)}
                      >
                        <Power className="mr-2 h-3.5 w-3.5" />
                        Desativar
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover convite?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O link deixará de funcionar imediatamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(invite.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

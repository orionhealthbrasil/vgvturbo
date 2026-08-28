import { useState } from 'react';
import { Plus, Radio, Pause, Play, X, Trash2, Users, Clock, CheckCircle, AlertCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useBroadcastCampaigns, 
  useDeleteBroadcastCampaign,
  useStartBroadcast,
  usePauseBroadcast,
  useCancelBroadcast,
  BroadcastCampaign 
} from '@/hooks/useBroadcast';
import { NewCampaignDialog } from '@/components/broadcast/NewCampaignDialog';
import { CampaignDetailDialog } from '@/components/broadcast/CampaignDetailDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_LABELS: Record<BroadcastCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  running: 'Em execução',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<BroadcastCampaign['status'], string> = {
  draft: 'bg-gray-500',
  scheduled: 'bg-blue-500',
  running: 'bg-green-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

export default function Broadcast() {
  const { data: campaigns, isLoading } = useBroadcastCampaigns();
  const deleteCampaign = useDeleteBroadcastCampaign();
  const startBroadcast = useStartBroadcast();
  const pauseBroadcast = usePauseBroadcast();
  const cancelBroadcast = useCancelBroadcast();

  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaign | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleStart = (campaign: BroadcastCampaign) => {
    if (campaign.total_contacts === 0) {
      return;
    }
    startBroadcast.mutate(campaign.id);
  };

  const handlePause = (campaignId: string) => {
    pauseBroadcast.mutate(campaignId);
  };

  const handleCancel = (campaignId: string) => {
    cancelBroadcast.mutate(campaignId);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteCampaign.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6" />
            Disparo em Massa
          </h1>
          <p className="text-muted-foreground">
            Envie mensagens para múltiplos contatos com segurança anti-ban
          </p>
        </div>
        <Button onClick={() => setNewCampaignOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Safety Notice */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-500">Proteção Anti-Ban Ativa</p>
              <p className="text-muted-foreground">
                Intervalos de 5-15 min entre mensagens • Limite de 30 msgs/hora • Pausas automáticas a cada 20 mensagens
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Grid */}
      {campaigns?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma campanha</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira campanha de disparo em massa
            </p>
            <Button onClick={() => setNewCampaignOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns?.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedCampaign(campaign)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {campaign.message_content}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(campaign.status === 'draft' || campaign.status === 'paused') && (
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleStart(campaign); }}
                          disabled={campaign.total_contacts === 0}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar
                        </DropdownMenuItem>
                      )}
                      {campaign.status === 'running' && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePause(campaign.id); }}>
                          <Pause className="w-4 h-4 mr-2" />
                          Pausar
                        </DropdownMenuItem>
                      )}
                      {(campaign.status === 'running' || campaign.status === 'paused') && (
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleCancel(campaign.id); }}
                          className="text-destructive"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </DropdownMenuItem>
                      )}
                      {campaign.status !== 'running' && (
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(campaign.id); }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={STATUS_COLORS[campaign.status]}>
                    {STATUS_LABELS[campaign.status]}
                  </Badge>
                  {campaign.media_url && (
                    <Badge variant="outline">Com imagem</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{campaign.total_contacts}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-500">
                    <CheckCircle className="w-4 h-4" />
                    <span>{campaign.sent_count}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>{campaign.failed_count}</span>
                  </div>
                </div>

                {campaign.status === 'running' && campaign.total_contacts > 0 && (
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(campaign.sent_count / campaign.total_contacts) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((campaign.sent_count / campaign.total_contacts) * 100)}% concluído
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                  <Clock className="w-3 h-3" />
                  <span>
                    {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Campaign Dialog */}
      <NewCampaignDialog 
        open={newCampaignOpen} 
        onOpenChange={setNewCampaignOpen}
        onSuccess={(campaign) => {
          setNewCampaignOpen(false);
          setSelectedCampaign(campaign);
        }}
      />

      {/* Campaign Detail Dialog */}
      <CampaignDetailDialog
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        onStart={handleStart}
        onPause={handlePause}
        onCancel={handleCancel}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados da campanha serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

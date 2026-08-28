import { useMemo } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  Target,
  BarChart3,
  XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BroadcastCampaign, BroadcastRecipient } from '@/hooks/useBroadcast';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignPerformanceReportProps {
  campaign: BroadcastCampaign;
  recipients: BroadcastRecipient[] | undefined;
}

export function CampaignPerformanceReport({ campaign, recipients }: CampaignPerformanceReportProps) {
  const stats = useMemo(() => {
    const total = campaign.total_contacts;
    const sent = campaign.sent_count;
    const failed = campaign.failed_count;
    const pending = total - sent - failed;
    
    const deliveryRate = total > 0 ? (sent / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    const completionRate = total > 0 ? ((sent + failed) / total) * 100 : 0;

    // Calculate duration
    let duration = 0;
    if (campaign.started_at) {
      const endTime = campaign.completed_at ? new Date(campaign.completed_at) : new Date();
      duration = differenceInMinutes(endTime, new Date(campaign.started_at));
    }

    // Calculate average messages per hour
    const msgsPerHour = duration > 0 ? Math.round((sent / duration) * 60) : 0;

    // Get failed recipients for error analysis
    const failedRecipients = recipients?.filter(r => r.status === 'failed') || [];
    
    // Group errors by type
    const errorGroups: Record<string, number> = {};
    failedRecipients.forEach(r => {
      const errorType = r.error_message || 'Erro desconhecido';
      errorGroups[errorType] = (errorGroups[errorType] || 0) + 1;
    });

    return {
      total,
      sent,
      failed,
      pending,
      deliveryRate,
      failureRate,
      completionRate,
      duration,
      msgsPerHour,
      failedRecipients,
      errorGroups,
    };
  }, [campaign, recipients]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-4 px-1">
      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">
                  {stats.deliveryRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">
                  {stats.failureRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de Falha</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Progresso Geral</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {stats.completionRate.toFixed(0)}%
            </span>
          </div>
          <Progress value={stats.completionRate} className="h-3" />
          
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-semibold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-semibold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-sm font-semibold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Estatísticas de Execução</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duração Total</p>
              <p className="text-lg font-semibold">
                {stats.duration > 0 ? formatDuration(stats.duration) : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Média msgs/hora</p>
              <p className="text-lg font-semibold">
                {stats.msgsPerHour > 0 ? stats.msgsPerHour : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Iniciado em</p>
              <p className="text-sm">
                {campaign.started_at 
                  ? format(new Date(campaign.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                  : '—'
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {campaign.completed_at ? 'Concluído em' : 'Previsão de término'}
              </p>
              <p className="text-sm">
                {campaign.completed_at 
                  ? format(new Date(campaign.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                  : stats.pending > 0 && stats.msgsPerHour > 0
                    ? `~${Math.ceil((stats.pending / stats.msgsPerHour) * 60)} min restantes`
                    : '—'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Analysis */}
      {stats.failed > 0 && (
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Análise de Falhas</span>
            </div>
            
            <div className="space-y-2">
              {Object.entries(stats.errorGroups)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([error, count]) => (
                  <div key={error} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate flex-1 mr-2">
                      {error}
                    </span>
                    <span className="font-medium text-red-500">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign not started yet */}
      {campaign.status === 'draft' && (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">O relatório estará disponível após iniciar a campanha</p>
        </div>
      )}
    </div>
  );
}

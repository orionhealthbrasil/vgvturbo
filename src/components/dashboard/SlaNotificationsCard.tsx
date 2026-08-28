import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCheck, User, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSlaNotifications } from '@/hooks/useSlaNotifications';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserOrganization } from '@/hooks/useOrganization';

export function SlaNotificationsCard() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useSlaNotifications();
  const { data: orgData } = useUserOrganization();
  const slaThreshold = (orgData?.organization as any)?.sla_threshold_minutes || 30;
  const navigate = useNavigate();

  const formatWaitBlocks = (minutes: number) => {
    const t = slaThreshold > 0 ? slaThreshold : 30;
    // Mostrar apenas o atraso do ciclo mais recente (cap no threshold) para evitar números irreais.
    const capped = Math.max(1, Math.min(minutes, t));
    if (capped < 60) return `${capped} min de atraso`;
    const h = Math.floor(capped / 60);
    const m = capped % 60;
    return m === 0 ? `${h} h de atraso` : `${h}h${String(m).padStart(2, '0')} de atraso`;
  };

  if (isLoading) {
    return <Skeleton className="h-[300px]" />;
  }

  if (notifications.length === 0) {
    return null;
  }

  const handleClick = (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    navigate(`/chat?contact=${notification.contact_id}`);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  return (
    <Card className="glass-card border-destructive/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Alertas de SLA
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] pr-3">
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent/50 group ${
                  n.is_read ? 'bg-background opacity-60' : 'bg-destructive/5 border-destructive/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">{n.contact_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatWaitBlocks(n.wait_time_minutes)}
                      </span>
                      {n.agent_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {n.agent_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

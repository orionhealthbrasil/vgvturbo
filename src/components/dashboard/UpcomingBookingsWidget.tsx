import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBookings } from '@/hooks/useBookings';

export function UpcomingBookingsWidget() {
  const navigate = useNavigate();
  const now = new Date().toISOString();
  const inAWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data, isLoading } = useBookings({ from: now, to: inAWeek });

  const upcoming = (data || [])
    .filter((b) => b.status === 'confirmed' || b.status === 'pending')
    .slice(0, 5);

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Próximos Agendamentos
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>
          Ver tudo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum agendamento próximo
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate('/agenda')}
                className="w-full text-left p-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.starts_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {b.status === 'pending' && (
                    <Badge variant="secondary" className="text-xs">
                      Aguardando
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

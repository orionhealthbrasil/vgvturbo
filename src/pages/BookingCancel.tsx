import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CheckCircle2, XCircle, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

type Result = {
  booking_id: string;
  customer_name: string;
  starts_at: string;
  ends_at: string;
  calendar_name: string;
  was_cancelled: boolean;
};

export default function BookingCancel() {
  const { token } = useParams<{ token: string }>();
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Token inválido');
      const { data, error } = await supabase.rpc('cancel_booking_by_token' as any, {
        p_token: token,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) throw new Error('Agendamento não encontrado');
      return row as Result;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      if (data.was_cancelled) {
        toast.success('Agendamento cancelado');
      }
    },
    onError: (e: any) => {
      setError(e.message || 'Erro ao cancelar');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Cancelar agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <div className="text-center space-y-3 py-4">
              {result.was_cancelled ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
                  <p className="font-medium">Cancelamento confirmado</p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="font-medium">Este agendamento já estava cancelado</p>
                </>
              )}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{result.customer_name}</p>
                <p>{result.calendar_name}</p>
                <p>{format(new Date(result.starts_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center space-y-3 py-4">
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja cancelar este agendamento? Você pode informar o motivo abaixo.
              </p>
              <div>
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={() => cancel.mutate()}
                variant="destructive"
                className="w-full"
                disabled={cancel.isPending}
              >
                {cancel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar cancelamento
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

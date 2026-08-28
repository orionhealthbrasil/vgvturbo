import { useState, useEffect } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUserOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function BookingsSettingsCard() {
  const { data: orgData } = useUserOrganization();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!!(orgData?.organization as any)?.bookings_email_enabled);
  }, [orgData]);

  const update = useMutation({
    mutationFn: async (value: boolean) => {
      if (!orgData) throw new Error('Sem organização');
      const { error } = await supabase
        .from('organizations')
        .update({ bookings_email_enabled: value } as any)
        .eq('id', orgData.organization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Configuração atualizada');
    },
    onError: (e: any) => {
      toast.error(e.message || 'Erro ao salvar');
      setEnabled((v) => !v);
    },
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Lembretes de Agendamento
        </CardTitle>
        <CardDescription>
          Configure como os lembretes de agendamento serão enviados aos clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex-1">
            <Label htmlFor="email-toggle" className="text-base">
              Enviar lembretes por email
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativo, lembretes serão enviados por email além do WhatsApp (se o cliente fornecer email).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Switch
              id="email-toggle"
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                update.mutate(v);
              }}
              disabled={update.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Shield, Users, Clock, ToggleLeft, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OrgPrefs {
  id: string;
  vendor_offline_auto_reactivate: boolean;
  vendor_offline_reactivate_minutes: number;
  allow_vendor_assignment: boolean;
  manager_whatsapp_phone?: string | null;
}

interface Member {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  member_role: string | null;
  is_available: boolean;
  offline_set_by_admin: boolean;
  offline_until: string | null;
}

interface OrganizationPreferencesProps {
  org: OrgPrefs;
}

export function OrganizationPreferences({ org }: OrganizationPreferencesProps) {
  const queryClient = useQueryClient();

  const { data: membersWithProfiles = [] } = useQuery({
    queryKey: ['org-members-availability', org.id],
    queryFn: async (): Promise<Member[]> => {
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('id, user_id, member_role, is_available, offline_set_by_admin, offline_until')
        .eq('organization_id', org.id)
        .order('created_at');
      if (error) throw error;

      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (members || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        member_role: m.member_role,
        is_available: m.is_available ?? true,
        offline_set_by_admin: m.offline_set_by_admin ?? false,
        offline_until: m.offline_until ?? null,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
      }));
    },
  });

  const members = membersWithProfiles;

  const [autoReactivate, setAutoReactivate] = useState(org.vendor_offline_auto_reactivate);
  const [reactivateMinutes, setReactivateMinutes] = useState(org.vendor_offline_reactivate_minutes);
  const [allowAssignment, setAllowAssignment] = useState(org.allow_vendor_assignment);
  const [managerPhone, setManagerPhone] = useState(org.manager_whatsapp_phone || '');

  const savePrefs = useMutation({
    mutationFn: async (patch: Partial<OrgPrefs>) => {
      const { error } = await supabase
        .from('organizations')
        .update(patch as any)
        .eq('id', org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Preferências salvas');
    },
    onError: () => toast.error('Erro ao salvar preferências'),
  });

  const setMemberAvailability = useMutation({
    mutationFn: async ({ memberId, available }: { memberId: string; available: boolean }) => {
      const patch: Record<string, unknown> = {
        is_available: available,
        offline_until: null,
        offline_set_by_admin: !available,
      };
      const { error } = await supabase
        .from('organization_members')
        .update(patch as any)
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      queryClient.invalidateQueries({ queryKey: ['org-members-availability', org.id] });
      queryClient.invalidateQueries({ queryKey: ['member-availability'] });
    },
    onError: () => toast.error('Erro ao alterar disponibilidade'),
  });

  const handleSaveAutoReactivate = () => {
    savePrefs.mutate({
      vendor_offline_auto_reactivate: autoReactivate,
      vendor_offline_reactivate_minutes: reactivateMinutes,
    });
  };

  const handleSaveAssignment = () => {
    savePrefs.mutate({ allow_vendor_assignment: allowAssignment });
  };

  const handleSaveManagerPhone = () => {
    const cleaned = managerPhone.replace(/\D/g, '');
    savePrefs.mutate({ manager_whatsapp_phone: cleaned || null } as any);
  };

  const getInitials = (name: string | null) =>
    name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const roleLabel = (role: string | null) => {
    if (role === 'admin') return 'Admin';
    if (role === 'analyst') return 'Analista';
    return 'Vendedor';
  };

  return (
    <div className="space-y-6">
      {/* Auto-reactivation */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Controle de Disponibilidade
          </CardTitle>
          <CardDescription>
            Quando ativo, vendedores que se marcam como Off voltam automaticamente após o tempo
            configurado. Admins e analistas podem definir Off permanente individualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-reactivate">
              Reativação automática de vendedores offline
            </Label>
            <Switch
              id="auto-reactivate"
              checked={autoReactivate}
              onCheckedChange={setAutoReactivate}
            />
          </div>
          {autoReactivate && (
            <div className="space-y-1">
              <Label htmlFor="reactivate-minutes">Reativar após (minutos)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="reactivate-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={reactivateMinutes}
                  onChange={(e) => setReactivateMinutes(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
          )}
          <Button onClick={handleSaveAutoReactivate} disabled={savePrefs.isPending} size="sm">
            Salvar
          </Button>

          {/* Member availability table */}
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">Disponibilidade dos membros</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(m.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{m.full_name ?? m.email ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {roleLabel(m.member_role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.is_available ? (
                        <Badge variant="default" className="text-xs bg-green-500">On</Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">Off</Badge>
                          {m.offline_set_by_admin && (
                            <span className="text-xs text-muted-foreground">(admin)</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={m.is_available}
                        onCheckedChange={(val) =>
                          setMemberAvailability.mutate({ memberId: m.id, available: val })
                        }
                        disabled={setMemberAvailability.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assignment permission */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Permissão de Atribuição
          </CardTitle>
          <CardDescription>
            Quando desativado, apenas admin e analista podem atribuir ou remover atribuições de
            conversas. Vendedores ficam bloqueados de fazer isso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="allow-assignment">
              Vendedores podem alterar atribuições
            </Label>
            <Switch
              id="allow-assignment"
              checked={allowAssignment}
              onCheckedChange={setAllowAssignment}
            />
          </div>
          <Button onClick={handleSaveAssignment} disabled={savePrefs.isPending} size="sm">
            Salvar
          </Button>
        </CardContent>
      </Card>
      {/* Manager AI phone */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            IA do Gestor
          </CardTitle>
          <CardDescription>
            Número de WhatsApp do gestor. Quando configurado, a IA do sistema envia notificações
            de vendas e tensões, e o gestor pode conversar diretamente com a IA para consultar
            dados e executar ações no CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="manager-phone">Número do gestor (com DDI)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="manager-phone"
                type="tel"
                placeholder="5511999999999"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                className="max-w-64"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Somente dígitos, incluindo código do país. Ex: 5511999999999
            </p>
          </div>
          <Button onClick={handleSaveManagerPhone} disabled={savePrefs.isPending} size="sm">
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

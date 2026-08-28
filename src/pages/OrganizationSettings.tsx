import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Building2, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Link2, 
  Users, 
  Loader2,
  Settings,
  XCircle,
  Crown,
  Shield,
  User as UserIcon,
  Eye,
  PenLine,
  Clock,
  Star,
  Sparkles,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserOrganization, useOrganizationMembers } from '@/hooks/useOrganization';
import { 
  useOrganizationInvites, 
  useCreateInvite, 
  useDeactivateInvite,
  useDeleteInvite,
  type OrganizationInvite,
  type MemberRole
} from '@/hooks/useOrganizationInvites';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SlaSettingsCard } from '@/components/organization/SlaSettingsCard';
import { BusinessHoursSettingsCard } from '@/components/organization/BusinessHoursSettingsCard';
import { HolidaysSettingsCard } from '@/components/organization/HolidaysSettingsCard';
import { SatisfactionSettingsCard } from '@/components/organization/SatisfactionSettingsCard';
import { GoogleReviewsLinkCard } from '@/components/organization/GoogleReviewsLinkCard';
import { CurationRulesCard } from '@/components/organization/CurationRulesCard';
import { LossReasonsSettingsCard } from '@/components/organization/LossReasonsSettingsCard';
import { WinReasonsSettingsCard } from '@/components/organization/WinReasonsSettingsCard';
import { useOutcomeQuestions, DEFAULT_WIN_QUESTION, DEFAULT_LOSS_QUESTION } from '@/hooks/useWinReasons';
import { PermissionsMatrix } from '@/components/organization/PermissionsMatrix';
import { OrganizationPreferences } from '@/components/organization/OrganizationPreferences';
import { cn } from '@/lib/utils';

type SectionKey = 'empresa' | 'equipe' | 'sla' | 'avaliacoes' | 'ganhos' | 'perdas' | 'curadoria' | 'preferencias';
const VALID_SECTIONS: SectionKey[] = ['empresa', 'equipe', 'sla', 'avaliacoes', 'ganhos', 'perdas', 'curadoria', 'preferencias'];

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'empresa', label: 'Sobre a empresa', icon: Building2 },
  { key: 'equipe', label: 'Equipe', icon: Users },
  { key: 'sla', label: 'SLA', icon: Clock },
  { key: 'avaliacoes', label: 'Avaliações', icon: Star },
  { key: 'ganhos', label: 'Análise de Ganhos', icon: TrendingDown },
  { key: 'perdas', label: 'Análise de Perdas', icon: TrendingDown },
  { key: 'curadoria', label: 'Curadoria de análises', icon: Sparkles },
  { key: 'preferencias', label: 'Preferências', icon: SlidersHorizontal },
];

const ADMIN_ONLY_SECTIONS: SectionKey[] = ['preferencias'];


// Extended organization type with SLA and business hours fields
interface OrganizationWithSettings {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  sla_threshold_minutes?: number;
  sla_alert_phone?: string | null;
  sla_alert_template?: string;
  snooze_reactivation_message?: string | null;
  ticket_farewell_message?: string | null;
  // Business hours fields
  business_hours_start?: string;
  business_hours_end?: string;
  lunch_break_start?: string;
  lunch_break_end?: string;
  lunch_break_enabled?: boolean;
  lunch_break_days?: number[];
  working_days?: number[];
  // Weekend hours fields
  weekend_hours_enabled?: boolean;
  weekend_hours_start?: string;
  weekend_hours_end?: string;
  // AI closed hours message
  closed_hours_message?: string | null;
  // Google reviews
  google_reviews_url?: string | null;
}

export default function OrganizationSettings() {
  const { data: orgData, isLoading: isLoadingOrg } = useUserOrganization();
  const { data: members = [], isLoading: isLoadingMembers } = useOrganizationMembers();
  const { data: invites = [], isLoading: isLoadingInvites } = useOrganizationInvites();
  const createInvite = useCreateInvite();
  const deactivateInvite = useDeactivateInvite();
  const deleteInvite = useDeleteInvite();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') as SectionKey | null;
  const activeSection: SectionKey = sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'empresa';
  const handleSectionChange = (key: SectionKey) => setSearchParams({ section: key }, { replace: true });

  const [orgName, setOrgName] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showCreateInviteDialog, setShowCreateInviteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MemberRole>('viewer');
  const [memberToEditRole, setMemberToEditRole] = useState<{ id: string; name: string; currentRole: MemberRole | null } | null>(null);
  const [editingRole, setEditingRole] = useState<MemberRole>('viewer');

  const isOwner = orgData?.membership.role === 'owner';
  const isAdmin = orgData?.membership.role === 'admin' || isOwner;
  const isAnalyst = orgData?.membership.member_role === 'analyst' || orgData?.membership.member_role === 'admin';
  const canSeePreferences = isAdmin || isAnalyst;

  // Update organization name
  const updateOrgName = useMutation({
    mutationFn: async (name: string) => {
      if (!orgData) throw new Error('No organization');
      
      const { error } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', orgData.organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Nome da organização atualizado!');
      setIsUpdatingName(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar nome');
    },
  });

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast.success('Membro removido com sucesso');
      setMemberToRemove(null);
    },
    onError: () => {
      toast.error('Erro ao remover membro');
    },
  });

  // Update member role
  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, memberRole }: { memberId: string; memberRole: MemberRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ member_role: memberRole })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast.success('Cargo atualizado com sucesso');
      setMemberToEditRole(null);
    },
    onError: () => {
      toast.error('Erro ao atualizar cargo');
    },
  });

  const handleCopyInviteLink = async (invite: OrganizationInvite) => {
    const inviteUrl = `${window.location.origin}/auth?invite=${invite.invite_code}`;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteId(invite.id);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleCreateInvite = async () => {
    try {
      await createInvite.mutateAsync({ memberRole: selectedRole });
      toast.success('Link de convite criado!');
      setShowCreateInviteDialog(false);
      setSelectedRole('viewer');
    } catch {
      toast.error('Erro ao criar convite');
    }
  };

  const getMemberRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-primary" />;
      case 'analyst':
        return <PenLine className="w-4 h-4 text-accent-foreground" />;
      default:
        return <Eye className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getMemberRoleBadge = (role: MemberRole) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default">{ROLE_LABELS.admin}</Badge>;
      case 'analyst':
        return <Badge variant="secondary">{ROLE_LABELS.analyst}</Badge>;
      default:
        return <Badge variant="outline">{ROLE_LABELS.viewer}</Badge>;
    }
  };

  const handleSaveOrgName = () => {
    if (!orgName.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }
    updateOrgName.mutate(orgName.trim());
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-primary" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-accent-foreground" />;
      default:
        return <UserIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default">Proprietário</Badge>;
      case 'admin':
        return <Badge variant="secondary">Administrador</Badge>;
      default:
        return <Badge variant="outline">Membro</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!orgData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Organização não encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      {/* Internal sidebar */}
      <aside className="lg:w-60 lg:shrink-0">
        <div className="mb-4 lg:mb-6 px-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Ajustes
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gerencie sua empresa</p>
        </div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {SECTIONS.filter((s) => {
            if (ADMIN_ONLY_SECTIONS.includes(s.key)) {
              return canSeePreferences;
            }
            return true;
          }).map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => handleSectionChange(s.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:w-full',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {activeSection === 'empresa' && (<>
        {/* === SOBRE A EMPRESA === */}

      {/* Organization Info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            {isUpdatingName ? (
              <div className="flex gap-2">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Nome da empresa"
                />
                <Button onClick={handleSaveOrgName} disabled={updateOrgName.isPending}>
                  {updateOrgName.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
                <Button variant="outline" onClick={() => setIsUpdatingName(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <Input value={orgData.organization.name} disabled className="bg-muted" />
                {isOwner && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setOrgName(orgData.organization.name);
                      setIsUpdatingName(true);
                    }}
                  >
                    Editar
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>ID da Organização</Label>
            <Input value={orgData.organization.id} disabled className="bg-muted font-mono text-sm" />
            <p className="text-xs text-muted-foreground">
              Use este ID para integrações via API
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      {(() => {
        const org = orgData.organization as unknown as OrganizationWithSettings;
        return (
          <BusinessHoursSettingsCard
            organizationId={org.id}
            businessHoursStart={org.business_hours_start ?? '08:00:00'}
            businessHoursEnd={org.business_hours_end ?? '18:00:00'}
            lunchBreakStart={org.lunch_break_start ?? '12:00:00'}
            lunchBreakEnd={org.lunch_break_end ?? '13:00:00'}
            lunchBreakEnabled={org.lunch_break_enabled ?? false}
            lunchBreakDays={org.lunch_break_days ?? [1, 2, 3, 4, 5]}
            workingDays={org.working_days ?? [1, 2, 3, 4, 5]}
            weekendHoursEnabled={org.weekend_hours_enabled ?? false}
            weekendHoursStart={org.weekend_hours_start ?? '09:00:00'}
            weekendHoursEnd={org.weekend_hours_end ?? '13:00:00'}
            closedHoursMessage={org.closed_hours_message ?? null}
            isOwner={isOwner}
          />
        );
      })()}

      {/* Holidays */}
      <HolidaysSettingsCard isOwner={isOwner} />
        </>)}

        {activeSection === 'equipe' && (<>
        {/* === EQUIPE === */}
      {/* Invite Links */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Links de Convite
              </CardTitle>
              <CardDescription>
                Compartilhe links para convidar novos membros
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowCreateInviteDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingInvites ? (
            <Skeleton className="h-[100px] w-full" />
          ) : invites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum link de convite criado</p>
              {isAdmin && (
                <Button variant="link" onClick={() => setShowCreateInviteDialog(true)}>
                  Criar primeiro link
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono">{invite.invite_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getMemberRoleIcon(invite.member_role)}
                        {getMemberRoleBadge(invite.member_role)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invite.use_count}
                      {invite.max_uses && ` / ${invite.max_uses}`}
                    </TableCell>
                    <TableCell>
                      {invite.is_active ? (
                        <Badge variant="default" className="bg-primary/10 text-primary">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invite.created_at), "d MMM yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyInviteLink(invite)}
                          disabled={!invite.is_active}
                        >
                          {copiedInviteId === invite.id ? (
                            <Check className="w-4 h-4 text-primary" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {isAdmin && invite.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deactivateInvite.mutate(invite.id)}
                          >
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                        {isAdmin && !invite.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInvite.mutate(invite.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Membros da Equipe
          </CardTitle>
          <CardDescription>
            {members.length} membro{members.length !== 1 ? 's' : ''} na organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Entrou em</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {member.full_name || 'Usuário'}
                          </span>
                          {member.email && (
                            <span className="text-xs text-muted-foreground">
                              {member.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        {getRoleBadge(member.role)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === 'owner' ? (
                        <Badge variant="default" className="bg-primary/10 text-primary">
                          Acesso Total
                        </Badge>
                      ) : member.member_role ? (
                        <div className="flex items-center gap-2">
                          {getMemberRoleIcon(member.member_role)}
                          {getMemberRoleBadge(member.member_role)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não definido</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          {member.role !== 'owner' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Alterar cargo"
                                onClick={() => {
                                  setMemberToEditRole({
                                    id: member.id,
                                    name: member.full_name || 'Usuário',
                                    currentRole: member.member_role
                                  });
                                  setEditingRole(member.member_role || 'viewer');
                                }}
                              >
                                <PenLine className="w-4 h-4" />
                              </Button>
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                onClick={() => setMemberToRemove({
                                  id: member.id,
                                  name: member.full_name || 'Usuário'
                                })}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permissions Matrix (owner only) */}
      {isOwner && orgData && (
        <PermissionsMatrix organizationId={orgData.organization.id} />
      )}

        </>)}

        {activeSection === 'sla' && (<>
        {/* === SLA === */}
        {(() => {
          const org = orgData.organization as unknown as OrganizationWithSettings;
          return (
            <SlaSettingsCard
              organizationId={org.id}
              slaEnabled={(org as any).sla_enabled ?? false}
              slaThresholdMinutes={org.sla_threshold_minutes ?? 30}
              slaAlertTemplate={org.sla_alert_template ?? '🚨 *ALERTA DE SLA* 🚨\nO cliente *{{customer_name}}* está aguardando há *{{wait_time}}* minutos.\nVendedor responsável: *{{agent_name}}*.'}
              slaExcludedTagIds={(org as any).sla_excluded_tag_ids ?? []}
              slaAlertWhatsappEnabled={(org as any).sla_alert_whatsapp_enabled ?? false}
              slaAlertPhones={(org as any).sla_alert_phones ?? ((org as any).sla_alert_phone ? [(org as any).sla_alert_phone] : [])}
              slaAlertDestinations={(org as any).sla_alert_destinations ?? []}
              isOwner={isOwner}
            />
          );
        })()}
        </>)}

        {activeSection === 'avaliacoes' && (<>
        {/* === AVALIAÇÕES === */}
        {isOwner && <SatisfactionSettingsCard />}
        {(() => {
          const org = orgData.organization as unknown as OrganizationWithSettings;
          return (
            <GoogleReviewsLinkCard
              organizationId={org.id}
              googleReviewsUrl={org.google_reviews_url ?? null}
              isOwner={isOwner}
            />
          );
        })()}
        </>)}

        {activeSection === 'ganhos' && (<>
          <OutcomeQuestionEditor kind="win" />
          <WinReasonsSettingsCard />
        </>)}

        {activeSection === 'perdas' && (<>
          <OutcomeQuestionEditor kind="loss" />
          <LossReasonsSettingsCard />
        </>)}

        {activeSection === 'curadoria' && (<>
          <CurationRulesCard />
        </>)}

        {activeSection === 'preferencias' && canSeePreferences && (() => {
          const org = orgData.organization as any;
          return (
            <OrganizationPreferences
              org={{
                id: org.id,
                vendor_offline_auto_reactivate: org.vendor_offline_auto_reactivate ?? false,
                vendor_offline_reactivate_minutes: org.vendor_offline_reactivate_minutes ?? 30,
                allow_vendor_assignment: org.allow_vendor_assignment ?? true,
                manager_whatsapp_phone: org.manager_whatsapp_phone ?? null,
              }}
            />
          );
        })()}

      </div>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{memberToRemove?.name}</strong> da organização?
              Esta pessoa perderá acesso a todos os dados da empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && removeMember.mutate(memberToRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Invite Dialog */}
      <Dialog open={showCreateInviteDialog} onOpenChange={setShowCreateInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Link de Convite</DialogTitle>
            <DialogDescription>
              Selecione o cargo que o novo membro terá ao entrar na organização.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cargo do Convidado</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>{ROLE_LABELS.admin}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="analyst">
                    <div className="flex items-center gap-2">
                      <PenLine className="w-4 h-4" />
                      <span>{ROLE_LABELS.analyst}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>{ROLE_LABELS.viewer}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[selectedRole]}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-muted-foreground">Permissões do cargo</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedRole === 'admin' && (
                  <>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Chat (todos)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Contatos</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Analytics</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Conexão</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Ajustes</div>
                  </>
                )}
                {selectedRole === 'analyst' && (
                  <>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Chat (todos)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Contatos</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Analytics (ver)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Conexão</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Ajustes</div>
                  </>
                )}
                {selectedRole === 'viewer' && (
                  <>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Chat (atribuídos)</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Contatos (atribuídos)</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Analytics (próprias)</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Conexão</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Ajustes</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInvite} disabled={createInvite.isPending}>
              {createInvite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Role Dialog */}
      <Dialog open={!!memberToEditRole} onOpenChange={() => setMemberToEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Cargo</DialogTitle>
            <DialogDescription>
              Altere o cargo de <strong>{memberToEditRole?.name}</strong> na organização.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo Cargo</Label>
              <Select value={editingRole} onValueChange={(v) => setEditingRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>{ROLE_LABELS.admin}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="analyst">
                    <div className="flex items-center gap-2">
                      <PenLine className="w-4 h-4" />
                      <span>{ROLE_LABELS.analyst}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>{ROLE_LABELS.viewer}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[editingRole]}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-muted-foreground">Permissões do cargo</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {editingRole === 'admin' && (
                  <>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Chat (todos)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Contatos</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Analytics</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Conexão</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Ajustes</div>
                  </>
                )}
                {editingRole === 'analyst' && (
                  <>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Chat (todos)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Contatos</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Analytics (ver)</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Conexão</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Ajustes</div>
                  </>
                )}
                {editingRole === 'viewer' && (
                  <>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Chat (atribuídos)</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Contatos (atribuídos)</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Automações</div>
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Dashboard</div>
                    <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /> Analytics (próprias)</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Conexão</div>
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Ajustes</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToEditRole(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => memberToEditRole && updateMemberRole.mutate({ 
                memberId: memberToEditRole.id, 
                memberRole: editingRole 
              })} 
              disabled={updateMemberRole.isPending}
            >
              {updateMemberRole.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutcomeQuestionEditor({ kind }: { kind: 'win' | 'loss' }) {
  const { data, save } = useOutcomeQuestions();
  const defaultValue = kind === 'win' ? DEFAULT_WIN_QUESTION : DEFAULT_LOSS_QUESTION;
  const current = kind === 'win' ? data?.win : data?.loss;
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (current !== undefined && value === null) {
      setValue(current);
    }
  }, [current, value]);

  const effective = value ?? current ?? defaultValue;

  const handleSave = async () => {
    try {
      const payload = (effective || '').trim();
      await save.mutateAsync(
        kind === 'win'
          ? { win: payload || null }
          : { loss: payload || null }
      );
      toast.success('Pergunta atualizada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pergunta do pop-up de {kind === 'win' ? 'venda realizada' : 'venda perdida'}
        </CardTitle>
        <CardDescription>
          Esse texto aparece como pergunta quando o vendedor marca uma venda como {kind === 'win' ? 'ganha' : 'perdida'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={effective}
          onChange={(e) => setValue(e.target.value)}
          placeholder={defaultValue}
          maxLength={200}
        />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar pergunta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

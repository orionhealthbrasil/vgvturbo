import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export type MemberRole = 'admin' | 'analyst' | 'viewer';
export type Permission =
  | 'new_review'
  | 'analytics'
  | 'settings'
  | 'chat'
  | 'automations'
  | 'dashboard'
  | 'connection'
  | 'contacts'
  | 'pipeline'
  | 'pipeline_edit'
  | 'broadcast'
  | 'support'
  | 'internal_chat'
  | 'squad_ai'
  | 'goals'
  | 'forms'
  | 'bookings_view'
  | 'bookings_manage'
  | 'tasks'
  | 'projects';

export interface RolePermission {
  id: string;
  role: MemberRole;
  permission: Permission;
  can_view: boolean;
  can_edit: boolean;
  organization_id: string | null;
}

export interface UserPermissions {
  role: MemberRole | null;
  isOwner: boolean;
  isLoading: boolean;
  permissions: Record<Permission, { canView: boolean; canEdit: boolean }>;
}

const allPermissions: Permission[] = [
  'new_review',
  'analytics',
  'settings',
  'chat',
  'automations',
  'dashboard',
  'connection',
  'contacts',
  'pipeline',
  'pipeline_edit',
  'broadcast',
  'support',
  'internal_chat',
  'squad_ai',
  'goals',
  'forms',
  'bookings_view',
  'bookings_manage',
  'tasks',
  'projects',
];

const defaultPermissions: Record<Permission, { canView: boolean; canEdit: boolean }> =
  allPermissions.reduce((acc, p) => {
    acc[p] = { canView: false, canEdit: false };
    return acc;
  }, {} as Record<Permission, { canView: boolean; canEdit: boolean }>);

const ownerPermissions: Record<Permission, { canView: boolean; canEdit: boolean }> =
  allPermissions.reduce((acc, p) => {
    acc[p] = { canView: true, canEdit: true };
    return acc;
  }, {} as Record<Permission, { canView: boolean; canEdit: boolean }>);

/**
 * Loads role permissions, preferring org-specific overrides over global defaults.
 * The query returns ALL rows for the org (and globals), letting the caller resolve.
 */
export function useRolePermissions(organizationId?: string | null) {
  return useQuery({
    queryKey: ['role-permissions', organizationId ?? 'global'],
    queryFn: async (): Promise<RolePermission[]> => {
      let query = supabase.from('role_permissions').select('*');
      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      } else {
        query = query.is('organization_id', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RolePermission[];
    },
  });
}

export function useUserPermissions(): UserPermissions {
  const { data: orgData, isLoading: orgLoading } = useUserOrganization();
  const orgId = orgData?.organization.id ?? null;
  const { data: rolePermissions = [], isLoading: permissionsLoading } =
    useRolePermissions(orgId);

  const isLoading = orgLoading || permissionsLoading;

  const isOwner = orgData?.membership.role === 'owner';

  if (isOwner) {
    return {
      role: null,
      isOwner: true,
      isLoading: false,
      permissions: ownerPermissions,
    };
  }

  const memberRole = (orgData?.membership as any)?.member_role as MemberRole | null;

  if (!memberRole) {
    return {
      role: null,
      isOwner: false,
      isLoading,
      permissions: defaultPermissions,
    };
  }

  // Build map preferring org-specific overrides
  const permissions: Record<Permission, { canView: boolean; canEdit: boolean }> = {
    ...defaultPermissions,
  };

  // First pass: apply globals
  rolePermissions
    .filter((rp) => rp.role === memberRole && rp.organization_id == null)
    .forEach((rp) => {
      permissions[rp.permission] = { canView: rp.can_view, canEdit: rp.can_edit };
    });
  // Second pass: org overrides
  rolePermissions
    .filter((rp) => rp.role === memberRole && rp.organization_id === orgId)
    .forEach((rp) => {
      permissions[rp.permission] = { canView: rp.can_view, canEdit: rp.can_edit };
    });

  return {
    role: memberRole,
    isOwner: false,
    isLoading: false,
    permissions,
  };
}

export function useCanAccess(permission: Permission) {
  const { permissions, isOwner } = useUserPermissions();
  if (isOwner) return { canView: true, canEdit: true };
  return permissions[permission];
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Administrador',
  analyst: 'Analista',
  viewer: 'Vendedor',
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  admin: 'Acesso total: Chat, Contatos, Dashboard, Analytics, Automações, Conexão e Ajustes',
  analyst: 'Chat (todos), Contatos, Dashboard, Analytics (ver) e Conexão',
  viewer: 'Chat (apenas atribuídos), Contatos (atribuídos), Dashboard e Analytics (próprias)',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: 'Painel',
  chat: 'Chat',
  contacts: 'Contatos',
  pipeline: 'Funil',
  pipeline_edit: 'Funil — editar negócios',
  analytics: 'Análises',
  automations: 'Automações',
  broadcast: 'Disparo em massa',
  support: 'Suporte',
  internal_chat: 'Chat interno',
  squad_ai: 'Squad AI',
  goals: 'Metas',
  forms: 'Formulários',
  bookings_view: 'Agenda — visualizar',
  bookings_manage: 'Agenda — gerenciar',
  tasks: 'Tarefas',
  projects: 'Projetos',
  connection: 'Conexão',
  settings: 'Ajustes da organização',
  new_review: 'Nova avaliação',
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrganizationStats {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  contact_count: number;
  message_count: number;
  automation_count: number;
  has_whatsapp: number;
  last_message_at: string | null;
}

export interface GlobalStats {
  totalOrganizations: number;
  totalUsers: number;
  totalContacts: number;
  totalMessages: number;
  activeOrganizations: number;
  organizationsWithWhatsApp: number;
}

const STATS_STALE_TIME = 5 * 60 * 1000; // 5 min

export function useIsSuperAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Totais globais (1 linha) — vem da RPC `super_admin_totals` que lê da
 * materialized view. Fallback: agrega no client a partir da view.
 */
export function useGlobalStats(): GlobalStats {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  const { data } = useQuery({
    queryKey: ['super-admin-totals'],
    enabled: !!isSuperAdmin,
    staleTime: STATS_STALE_TIME,
    queryFn: async (): Promise<GlobalStats> => {
      const { data, error } = await (supabase.rpc as any)('super_admin_totals');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        totalOrganizations: Number(row?.total_organizations ?? 0),
        totalUsers: Number(row?.total_users ?? 0),
        totalContacts: Number(row?.total_contacts ?? 0),
        totalMessages: Number(row?.total_messages ?? 0),
        activeOrganizations: Number(row?.active_organizations ?? 0),
        organizationsWithWhatsApp: Number(row?.organizations_with_whatsapp ?? 0),
      };
    },
  });

  return data ?? {
    totalOrganizations: 0,
    totalUsers: 0,
    totalContacts: 0,
    totalMessages: 0,
    activeOrganizations: 0,
    organizationsWithWhatsApp: 0,
  };
}

/**
 * Lista completa de orgs — usada pela página de Organizações.
 * Lê da materialized view (`organization_stats_mv`); fallback para a view.
 */
export function useOrganizationStats() {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['organization-stats'],
    enabled: !!isSuperAdmin,
    staleTime: STATS_STALE_TIME,
    queryFn: async (): Promise<OrganizationStats[]> => {
      const mv = await (supabase as any)
        .from('organization_stats_mv')
        .select('*');
      if (!mv.error && mv.data) return mv.data as OrganizationStats[];

      const { data, error } = await supabase
        .from('organization_stats')
        .select('*');
      if (error) throw error;
      return (data || []) as OrganizationStats[];
    },
  });
}

/**
 * Top N organizações por mensagens (dashboard).
 */
export function useTopOrganizations(limit = 5) {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['super-admin-top-orgs', limit],
    enabled: !!isSuperAdmin,
    staleTime: STATS_STALE_TIME,
    queryFn: async (): Promise<OrganizationStats[]> => {
      const { data, error } = await (supabase.rpc as any)('super_admin_top_orgs', { p_limit: limit });
      if (error) throw error;
      return (data || []) as OrganizationStats[];
    },
  });
}

/**
 * Organizações mais recentes (dashboard).
 */
export function useRecentOrganizations(limit = 5) {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['super-admin-recent-orgs', limit],
    enabled: !!isSuperAdmin,
    staleTime: STATS_STALE_TIME,
    queryFn: async (): Promise<OrganizationStats[]> => {
      const { data, error } = await (supabase.rpc as any)('super_admin_recent_orgs', { p_limit: limit });
      if (error) throw error;
      return (data || []) as OrganizationStats[];
    },
  });
}

export function useOrganizationDetails(organizationId: string | null) {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['organization-details', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, created_at, updated_at, sla_threshold_minutes, sla_alert_phone, sla_alert_template, business_hours_start, business_hours_end, lunch_break_start, lunch_break_end, lunch_break_enabled, working_days, lunch_break_days, snooze_reactivation_message, ticket_farewell_message, weekend_hours_enabled, weekend_hours_start, weekend_hours_end, sla_enabled, sla_excluded_tag_ids, closed_hours_message, resend_from_email, resend_from_name, resend_reply_to, bookings_email_enabled, funnel_transitions_initialized')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role, member_role, created_at')
        .eq('organization_id', organizationId);

      if (membersError) throw membersError;

      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const membersWithProfiles = members?.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) || [];

      return {
        organization: org,
        members: membersWithProfiles,
      };
    },
    enabled: !!isSuperAdmin && !!organizationId,
  });
}

/**
 * Chave da OpenAI usada como fallback por todas as organizações que não têm
 * (ou não devem ter, no modelo de créditos VGVCash) sua própria chave.
 */
export function usePlatformOpenAiKey() {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['platform-openai-key'],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_platform_openai_api_key' as any);
      if (error) throw error;
      const key = data as unknown as string | null;
      return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
    },
  });
}

export function useUpdatePlatformOpenAiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string | null) => {
      const { error } = await supabase.rpc('set_platform_openai_api_key' as any, { p_key: key || '' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-openai-key'] });
    },
  });
}

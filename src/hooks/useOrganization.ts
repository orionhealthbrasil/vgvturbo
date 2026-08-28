import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  // SLA fields
  sla_threshold_minutes: number;
  sla_alert_phone: string | null;
  sla_alert_template: string;
  google_reviews_url?: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  member_role: 'admin' | 'analyst' | 'viewer' | null;
  created_at: string;
}

export function useUserOrganization() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async (): Promise<{ organization: Organization; membership: OrganizationMember } | null> => {
      if (!user) return null;

      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!membership) return null;

      return {
        organization: membership.organizations as unknown as Organization,
        membership: {
          id: membership.id,
          organization_id: membership.organization_id,
          user_id: membership.user_id,
          role: membership.role as 'owner' | 'admin' | 'member',
          member_role: membership.member_role as 'admin' | 'analyst' | 'viewer' | null,
          created_at: membership.created_at,
        },
      };
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('User not authenticated');

      // Use the atomic RPC function that creates both org and membership
      const { data, error } = await supabase.rpc('create_organization_with_owner', {
        p_name: name,
      });

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to create organization');

      return {
        id: data[0].organization_id,
        name: data[0].organization_name,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
    },
  });
}

export interface OrganizationMemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  member_role: 'admin' | 'analyst' | 'viewer' | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function useOrganizationMembers() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['organization-members', orgData?.organization.id],
    queryFn: async (): Promise<OrganizationMemberWithProfile[]> => {
      if (!orgData) return [];

      // First get organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, member_role, created_at')
        .eq('organization_id', orgData.organization.id)
        .order('created_at');

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Get user IDs to fetch profiles
      const userIds = members.map(m => m.user_id);

      // Fetch profiles separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id -> profile
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Merge members with profiles
      return members.map(member => ({
        id: member.id,
        organization_id: member.organization_id,
        user_id: member.user_id,
        role: member.role as 'owner' | 'admin' | 'member',
        member_role: member.member_role as 'admin' | 'analyst' | 'viewer' | null,
        created_at: member.created_at,
        full_name: profileMap.get(member.user_id)?.full_name || null,
        avatar_url: profileMap.get(member.user_id)?.avatar_url || null,
        email: profileMap.get(member.user_id)?.email || null,
      }));
    },
    enabled: !!orgData?.organization.id,
  });
}

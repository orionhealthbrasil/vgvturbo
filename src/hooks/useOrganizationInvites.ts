import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';

export type MemberRole = 'admin' | 'analyst' | 'viewer';

export interface OrganizationInvite {
  id: string;
  organization_id: string | null;
  invite_code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  member_role: MemberRole;
  invite_type?: 'member' | 'owner';
}

export function useOrganizationInvites() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['organization-invites', orgData?.organization.id],
    queryFn: async (): Promise<OrganizationInvite[]> => {
      if (!orgData) return [];

      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', orgData.organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrganizationInvite[];
    },
    enabled: !!orgData?.organization.id,
  });
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options?: { 
      expiresInDays?: number; 
      maxUses?: number;
      memberRole?: MemberRole;
    }) => {
      if (!orgData || !user) throw new Error('Not authenticated or no organization');

      const inviteCode = generateInviteCode();
      const expiresAt = options?.expiresInDays 
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: orgData.organization.id,
          invite_code: inviteCode,
          created_by: user.id,
          expires_at: expiresAt,
          max_uses: options?.maxUses || null,
          member_role: options?.memberRole || 'viewer',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites'] });
    },
  });
}

export function useDeactivateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .update({ is_active: false })
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites'] });
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites'] });
    },
  });
}

export function useJoinViaInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('join_organization_via_invite', {
        p_invite_code: inviteCode,
        p_user_id: user.id,
      });

      if (error) throw error;
      if (!data) throw new Error('Invalid or expired invite');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
    },
  });
}

export function useValidateInvite(inviteCode: string | null) {
  return useQuery({
    queryKey: ['validate-invite', inviteCode],
    queryFn: async () => {
      if (!inviteCode) return null;

      const { data, error } = await supabase.rpc('get_invite_organization', {
        invite_code: inviteCode,
      });

      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      return data[0] as {
        organization_id: string | null;
        organization_name: string;
        invite_type: 'member' | 'owner';
      };
    },
    enabled: !!inviteCode,
  });
}

// ─────────── Owner invites (Super Admin only) ───────────

export function useOwnerInvites() {
  return useQuery({
    queryKey: ['owner-invites'],
    queryFn: async (): Promise<OrganizationInvite[]> => {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('invite_type', 'owner')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as OrganizationInvite[];
    },
  });
}

export function useCreateOwnerInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options?: { expiresInDays?: number; maxUses?: number }) => {
      if (!user) throw new Error('Not authenticated');

      const inviteCode = generateInviteCode();
      const expiresAt = options?.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: null,
          invite_code: inviteCode,
          created_by: user.id,
          expires_at: expiresAt,
          max_uses: options?.maxUses || null,
          member_role: 'viewer',
          invite_type: 'owner',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-invites'] });
    },
  });
}

export function useDeactivateOwnerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .update({ is_active: false })
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-invites'] });
    },
  });
}

export function useDeleteOwnerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-invites'] });
    },
  });
}

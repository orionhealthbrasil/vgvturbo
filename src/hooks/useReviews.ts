import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import type { Review, ReviewWithSalesperson, Salesperson } from '@/types/database';

export function useSalespeople() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['salespeople', orgData?.organization.id],
    queryFn: async (): Promise<Salesperson[]> => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('*')
        .eq('organization_id', orgData!.organization.id)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgData?.organization.id,
  });
}

// Hook to get the salesperson linked to the current user
export function useLinkedSalesperson() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['linked-salesperson', user?.id, orgData?.organization.id],
    queryFn: async (): Promise<Salesperson | null> => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('*')
        .eq('organization_id', orgData!.organization.id)
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgData?.organization.id && !!user?.id,
  });
}

export function useCreateSalesperson() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!orgData) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('salespeople')
        .insert({ 
          name,
          organization_id: orgData.organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
    },
  });
}

export function useUpdateSalesperson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('salespeople')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
    },
  });
}

export function useDeleteSalesperson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('salespeople')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useReviews() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const { data: linkedSalesperson } = useLinkedSalesperson();
  
  // Check if user is a viewer (vendedor) - they should only see their own reviews
  const isViewer = orgData?.membership?.member_role === 'viewer';

  return useQuery({
    queryKey: ['reviews', orgData?.organization.id, isViewer ? linkedSalesperson?.id : 'all'],
    queryFn: async (): Promise<ReviewWithSalesperson[]> => {
      let query = supabase
        .from('reviews')
        .select('*, salespeople(*)')
        .eq('organization_id', orgData!.organization.id)
        .order('created_at', { ascending: false });
      
      // If user is a viewer, filter to only their linked salesperson's reviews
      if (isViewer && linkedSalesperson) {
        query = query.eq('salesperson_id', linkedSalesperson.id);
      } else if (isViewer && !linkedSalesperson) {
        // Viewer without linked salesperson sees no reviews
        return [];
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ReviewWithSalesperson[];
    },
    // Wait for linkedSalesperson check to complete for viewers
    enabled: !!orgData?.organization.id && (!isViewer || linkedSalesperson !== undefined),
  });
}

interface CreateReviewInput {
  salesperson_id: string;
  response_time_minutes: number;
  defect_type: string;
  review_date: string;
  phone?: string;
  notes?: string;
  evidence_urls?: string[];
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: CreateReviewInput) => {
      if (!orgData) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          salesperson_id: input.salesperson_id,
          response_time_minutes: input.response_time_minutes,
          defect_type: input.defect_type,
          review_date: input.review_date,
          phone: input.phone || null,
          notes: input.notes || null,
          evidence_urls: input.evidence_urls || [],
          organization_id: orgData.organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export async function uploadEvidence(file: File, organizationId: string): Promise<string> {
  if (!organizationId) throw new Error('organizationId é obrigatório para upload de evidência');
  const fileExt = file.name.split('.').pop();
  const fileName = `${organizationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error } = await supabase.storage
    .from('evidence')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('evidence')
    .getPublicUrl(fileName);

  return publicUrl;
}

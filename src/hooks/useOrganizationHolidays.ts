import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export interface OrganizationHoliday {
  id: string;
  organization_id: string;
  name: string;
  holiday_date: string;
  is_closed: boolean;
  custom_hours_start: string | null;
  custom_hours_end: string | null;
  return_date: string | null;
  created_at: string;
}

export function useOrganizationHolidays() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['organization-holidays', orgData?.organization.id],
    queryFn: async (): Promise<OrganizationHoliday[]> => {
      if (!orgData?.organization.id) return [];

      const { data, error } = await supabase
        .from('organization_holidays')
        .select('*')
        .eq('organization_id', orgData.organization.id)
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as OrganizationHoliday[];
    },
    enabled: !!orgData?.organization.id,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (holiday: {
      name: string;
      holiday_date: string;
      is_closed: boolean;
      custom_hours_start?: string | null;
      custom_hours_end?: string | null;
      return_date?: string | null;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('organization_holidays')
        .insert({
          organization_id: orgData.organization.id,
          name: holiday.name,
          holiday_date: holiday.holiday_date,
          is_closed: holiday.is_closed,
          custom_hours_start: holiday.custom_hours_start || null,
          custom_hours_end: holiday.custom_hours_end || null,
          return_date: holiday.return_date || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-holidays'] });
    },
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      holiday_date?: string;
      is_closed?: boolean;
      custom_hours_start?: string | null;
      custom_hours_end?: string | null;
      return_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('organization_holidays')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-holidays'] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-holidays'] });
    },
  });
}

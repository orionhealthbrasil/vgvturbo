import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export function useCustomFieldNames() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization?.id;
  
  return useQuery({
    queryKey: ['custom-field-names', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // Get distinct field names from contact_custom_fields
      const { data, error } = await supabase
        .from('contact_custom_fields')
        .select('field_name')
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      
      // Get unique field names
      const uniqueNames = [...new Set(data?.map(f => f.field_name) || [])];
      return uniqueNames.sort();
    },
    enabled: !!organizationId,
  });
}

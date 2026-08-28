import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  name: string;
  field_type: FieldType;
  options: string[];
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useCustomFieldDefinitions() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization?.id;

  return useQuery({
    queryKey: ['custom-field-definitions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : [],
      })) as CustomFieldDefinition[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: { name: string; field_type: FieldType; options?: string[]; is_required?: boolean }) => {
      const organizationId = orgData?.organization?.id;
      if (!organizationId) throw new Error('No organization');

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          field_type: input.field_type,
          options: input.options || [],
          is_required: input.is_required || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
    },
  });
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; field_type?: FieldType; options?: string[]; is_required?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.field_type !== undefined) updates.field_type = input.field_type;
      if (input.options !== undefined) updates.options = input.options;
      if (input.is_required !== undefined) updates.is_required = input.is_required;

      const { data, error } = await supabase
        .from('custom_field_definitions')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
    },
  });
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
    },
  });
}

// Hook to get/set custom field values for a contact
export function useContactCustomFields(contactId: string | undefined) {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization?.id;

  return useQuery({
    queryKey: ['contact-custom-fields', contactId],
    queryFn: async () => {
      if (!contactId || !organizationId) return [];

      const { data, error } = await supabase
        .from('contact_custom_fields')
        .select('id, field_name, field_value, field_definition_id')
        .eq('contact_id', contactId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId && !!organizationId,
  });
}

export function useUpsertContactCustomField() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (input: { contactId: string; fieldName: string; fieldValue: string | null; fieldDefinitionId?: string }) => {
      const organizationId = orgData?.organization?.id;
      if (!organizationId) throw new Error('No organization');

      // Check if field already exists
      const { data: existing } = await supabase
        .from('contact_custom_fields')
        .select('id')
        .eq('contact_id', input.contactId)
        .eq('field_name', input.fieldName)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('contact_custom_fields')
          .update({ field_value: input.fieldValue, field_definition_id: input.fieldDefinitionId || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_custom_fields')
          .insert({
            contact_id: input.contactId,
            organization_id: organizationId,
            field_name: input.fieldName,
            field_value: input.fieldValue,
            field_definition_id: input.fieldDefinitionId || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contact-custom-fields', vars.contactId] });
    },
  });
}

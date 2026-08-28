import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { CalendarTemplate, CalendarTemplateScope } from '@/types/booking';

export function useCalendarTemplates(opts?: { scope?: CalendarTemplateScope | 'all' }) {
  const scope = opts?.scope ?? 'all';
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['calendar-templates', scope, orgId],
    queryFn: async (): Promise<CalendarTemplate[]> => {
      let q = supabase
        .from('calendar_templates' as any)
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (scope === 'global') q = q.eq('scope', 'global');
      if (scope === 'organization') q = q.eq('scope', 'organization');
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CalendarTemplate[];
    },
  });
}

export function useAllGlobalTemplates() {
  // For super admin: includes inactive
  return useQuery({
    queryKey: ['calendar-templates-admin'],
    queryFn: async (): Promise<CalendarTemplate[]> => {
      const { data, error } = await supabase
        .from('calendar_templates' as any)
        .select('*')
        .eq('scope', 'global')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CalendarTemplate[];
    },
  });
}

export function useApplyCalendarTemplate() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: {
      template_id: string;
      calendar_name: string;
      slug: string;
      owner_user_id?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('apply_calendar_template' as any, {
        p_template_id: input.template_id,
        p_calendar_name: input.calendar_name,
        p_slug: input.slug,
        p_owner_user_id: input.owner_user_id ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendars', orgId] });
      toast.success('Calendário criado a partir do template');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao aplicar template'),
  });
}

export function useSaveCalendarAsTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      calendar_id: string;
      template_name: string;
      scope: CalendarTemplateScope;
      category?: string | null;
      description?: string | null;
      icon?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('save_calendar_as_template' as any, {
        p_calendar_id: input.calendar_id,
        p_template_name: input.template_name,
        p_scope: input.scope,
        p_category: input.category ?? null,
        p_description: input.description ?? null,
        p_icon: input.icon ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-templates'] });
      qc.invalidateQueries({ queryKey: ['calendar-templates-admin'] });
      toast.success('Template salvo com sucesso');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar template'),
  });
}

export function useDeleteCalendarTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-templates'] });
      qc.invalidateQueries({ queryKey: ['calendar-templates-admin'] });
      toast.success('Template removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
  });
}

export function useUpdateCalendarTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CalendarTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_templates' as any)
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CalendarTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-templates'] });
      qc.invalidateQueries({ queryKey: ['calendar-templates-admin'] });
      toast.success('Template atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { LeadForm } from '@/types/forms';

const TABLE = 'lead_forms' as any;

function rowToLeadForm(row: any): LeadForm {
  return {
    id: row.id,
    organization_id: row.organization_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    logo_url: row.logo_url,
    primary_color: row.primary_color,
    thank_you_message: row.thank_you_message,
    redirect_url: row.redirect_url,
    fields: Array.isArray(row.fields) ? row.fields : [],
    default_tags: row.default_tags || [],
    pipeline_id: row.pipeline_id,
    kanban_column_id: row.kanban_column_id,
    funnel_stage: row.funnel_stage,
    assignment_strategy: row.assignment_strategy,
    assigned_to: row.assigned_to,
    is_active: row.is_active,
    submission_count: row.submission_count ?? 0,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useLeadForms() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['lead-forms', orgId],
    queryFn: async (): Promise<LeadForm[]> => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToLeadForm);
    },
    enabled: !!orgId,
  });
}

export function useCreateLeadForm() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: Partial<LeadForm> & { title: string; slug: string }) => {
      if (!orgId || !user?.id) throw new Error('Sem organização ou usuário');
      const insertPayload: any = {
        organization_id: orgId,
        created_by: user.id,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? '#6366f1',
        thank_you_message: input.thank_you_message ?? 'Recebemos seu contato! Em breve retornaremos.',
        redirect_url: input.redirect_url ?? null,
        fields: input.fields ?? [],
        default_tags: input.default_tags ?? [],
        pipeline_id: input.pipeline_id ?? null,
        kanban_column_id: input.kanban_column_id ?? null,
        funnel_stage: input.funnel_stage ?? null,
        assignment_strategy: input.assignment_strategy ?? 'none',
        assigned_to: input.assigned_to ?? null,
        is_active: input.is_active ?? true,
      };
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert(insertPayload)
        .select('*')
        .single();
      if (error) throw error;
      return rowToLeadForm(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-forms', orgId] });
      toast.success('Formulário criado!');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar formulário'),
  });
}

export function useUpdateLeadForm() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LeadForm> & { id: string }) => {
      const updatePayload: any = { ...patch };
      delete updatePayload.id;
      delete updatePayload.created_at;
      delete updatePayload.updated_at;
      delete updatePayload.organization_id;
      delete updatePayload.created_by;
      delete updatePayload.submission_count;

      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return rowToLeadForm(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-forms', orgId] });
      toast.success('Formulário atualizado!');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar formulário'),
  });
}

export function useDeleteLeadForm() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-forms', orgId] });
      toast.success('Formulário removido');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });
}

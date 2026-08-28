import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface SurveyQuestion {
  id: string;
  type: 'stars' | 'text' | 'emoji' | 'nps' | 'multiple_choice';
  label: string;
  required: boolean;
  options?: string[];
}

export interface SatisfactionSurvey {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  thank_you_message: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SatisfactionResponse {
  id: string;
  organization_id: string;
  survey_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  token: string;
  rating: number | null;
  answers: Record<string, any>;
  submitted_at: string | null;
  created_at: string;
}

export function useSatisfactionSurvey() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const queryClient = useQueryClient();

  const { data: survey, isLoading } = useQuery({
    queryKey: ['satisfaction-survey', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        questions: data.questions as unknown as SurveyQuestion[],
      } as SatisfactionSurvey;
    },
    enabled: !!orgId,
  });

  const upsertSurvey = useMutation({
    mutationFn: async (values: Partial<SatisfactionSurvey>) => {
      if (survey) {
        const { error } = await supabase
          .from('satisfaction_surveys')
          .update({
            title: values.title,
            description: values.description,
            logo_url: values.logo_url,
            primary_color: values.primary_color,
            thank_you_message: values.thank_you_message,
            questions: values.questions as any,
            is_active: values.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', survey.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('satisfaction_surveys')
          .insert({
            organization_id: orgId!,
            title: values.title || 'Pesquisa de Satisfação',
            description: values.description,
            logo_url: values.logo_url,
            primary_color: values.primary_color || '#6366f1',
            thank_you_message: values.thank_you_message || 'Obrigado pela sua avaliação! 🎉',
            questions: (values.questions || []) as any,
            is_active: values.is_active ?? true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satisfaction-survey', orgId] });
    },
  });

  return { survey, isLoading, upsertSurvey };
}

export function useSatisfactionStats() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['satisfaction-stats', orgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase
        .from('satisfaction_responses')
        .select('rating, assigned_to')
        .eq('organization_id', orgId!)
        .not('submitted_at', 'is', null)
        .not('rating', 'is', null);
      if (error) throw error;
      if (!data || data.length === 0) return { average: 0, count: 0, userAverage: 0, userCount: 0 };

      const total = data.reduce((sum, r) => sum + (r.rating || 0), 0);

      // Filter for current user's ratings
      const userResponses = userId ? data.filter(r => r.assigned_to === userId) : [];
      const userTotal = userResponses.reduce((sum, r) => sum + (r.rating || 0), 0);

      return {
        average: Math.round((total / data.length) * 10) / 10,
        count: data.length,
        userAverage: userResponses.length > 0 ? Math.round((userTotal / userResponses.length) * 10) / 10 : 0,
        userCount: userResponses.length,
      };
    },
    enabled: !!orgId,
  });
}

export interface PublicSurveyData {
  response: {
    submitted_at: string | null;
  };
  survey: {
    id: string;
    title: string;
    description: string | null;
    logo_url: string | null;
    primary_color: string;
    thank_you_message: string;
    questions: SurveyQuestion[];
  };
}

// Public hook - fetches survey by token without requiring an authenticated session
export function usePublicSurvey(token: string) {
  return useQuery<PublicSurveyData | null>({
    queryKey: ['public-survey', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_satisfaction_survey' as any, {
        p_token: token,
      } as any);

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      const questions = Array.isArray((row as any).survey_questions)
        ? ((row as any).survey_questions as SurveyQuestion[])
        : [];

      return {
        response: {
          submitted_at: (row as any).response_submitted_at ?? null,
        },
        survey: {
          id: (row as any).survey_id,
          title: (row as any).survey_title || 'Pesquisa de Satisfação',
          description: (row as any).survey_description ?? null,
          logo_url: (row as any).survey_logo_url ?? null,
          primary_color: (row as any).survey_primary_color || '#6366f1',
          thank_you_message: (row as any).survey_thank_you_message || 'Obrigado pela sua avaliação! 🎉',
          questions,
        },
      };
    },
    enabled: !!token,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import type { SurveyQuestion } from '@/hooks/useSatisfactionSurvey';

export interface QuestionStats {
  questionId: string;
  label: string;
  type: 'stars' | 'text' | 'emoji' | 'nps' | 'multiple_choice';
  average: number;
  count: number;
  distribution: Record<number, number>; // value -> count
  textResponses: TextResponse[];
}

export interface TextResponse {
  text: string;
  contactName: string | null;
  assignedTo: string | null;
  submittedAt: string;
  rating: number | null;
}

export function useSatisfactionDetailedStats() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  // Fetch survey config
  const { data: survey } = useQuery({
    queryKey: ['satisfaction-survey-config', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('questions')
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (data.questions as unknown as SurveyQuestion[]) || [];
    },
    enabled: !!orgId,
  });

  // Fetch all submitted responses
  const { data: stats, isLoading } = useQuery({
    queryKey: ['satisfaction-detailed-stats', orgId],
    queryFn: async () => {
      // Paginate responses
      let allResponses: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('satisfaction_responses')
          .select('answers, rating, submitted_at, assigned_to, contact_id')
          .eq('organization_id', orgId!)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allResponses = allResponses.concat(data);
        if (data.length < pageSize) break;
        page++;
      }

      // Fetch contact names for text responses
      const contactIds = [...new Set(allResponses.map(r => r.contact_id).filter(Boolean))];
      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        // Batch fetch
        const batchSize = 100;
        for (let i = 0; i < contactIds.length; i += batchSize) {
          const batch = contactIds.slice(i, i + batchSize);
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name')
            .in('id', batch);
          if (contacts) {
            for (const c of contacts) {
              contactMap[c.id] = c.name;
            }
          }
        }
      }

      // Fetch assigned_to profiles
      const assignedIds = [...new Set(allResponses.map(r => r.assigned_to).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', assignedIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.full_name || 'Sem nome';
          }
        }
      }

      return { allResponses, contactMap, profileMap };
    },
    enabled: !!orgId,
  });

  // Build per-question stats
  const questionStats: QuestionStats[] = [];
  if (survey && stats) {
    for (const q of survey) {
      const qStats: QuestionStats = {
        questionId: q.id,
        label: q.label,
        type: q.type,
        average: 0,
        count: 0,
        distribution: {},
        textResponses: [],
      };

      if (q.type === 'text') {
        // Collect text responses
        for (const r of stats.allResponses) {
          const answers = r.answers as Record<string, any> | null;
          const text = answers?.[q.id];
          if (text && typeof text === 'string' && text.trim()) {
            qStats.textResponses.push({
              text: text.trim(),
              contactName: r.contact_id ? (stats.contactMap[r.contact_id] || null) : null,
              assignedTo: r.assigned_to ? (stats.profileMap[r.assigned_to] || null) : null,
              submittedAt: r.submitted_at,
              rating: r.rating,
            });
            qStats.count++;
          }
        }
      } else {
        // Numeric question (stars, emoji, nps)
        let total = 0;
        const maxVal = q.type === 'nps' ? 10 : 5;
        // Initialize distribution
        for (let i = (q.type === 'nps' ? 0 : 1); i <= maxVal; i++) {
          qStats.distribution[i] = 0;
        }

        for (const r of stats.allResponses) {
          const answers = r.answers as Record<string, any> | null;
          const val = answers?.[q.id];
          if (val !== undefined && val !== null && typeof val === 'number') {
            total += val;
            qStats.count++;
            qStats.distribution[val] = (qStats.distribution[val] || 0) + 1;
          }
        }
        qStats.average = qStats.count > 0 ? Math.round((total / qStats.count) * 10) / 10 : 0;
      }

      questionStats.push(qStats);
    }
  }

  return { questionStats, isLoading, hasData: (stats?.allResponses?.length || 0) > 0 };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface EmailHistoryEntry {
  id: string;
  to_email: string;
  from_email: string | null;
  subject: string | null;
  source: string;
  status: string;
  resend_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface UseEmailHistoryOptions {
  status?: string;
  source?: string;
  limit?: number;
}

export function useEmailHistory(options: UseEmailHistoryOptions = {}) {
  const { data: org } = useUserOrganization();
  const orgId = org?.organization?.id;
  const { status, source, limit = 100 } = options;

  return useQuery({
    queryKey: ['email-history', orgId, status, source, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<EmailHistoryEntry[]> => {
      if (!orgId) return [];
      let query = supabase
        .from('email_send_history')
        .select('id, to_email, from_email, subject, source, status, resend_message_id, error_message, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'all') query = query.eq('status', status);
      if (source && source !== 'all') query = query.eq('source', source);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EmailHistoryEntry[];
    },
  });
}

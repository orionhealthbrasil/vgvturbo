import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Instagram, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import Chat from './Chat';

export default function Direct() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;

  const { data: igInstance, isLoading } = useQuery({
    queryKey: ['direct-ig-instance', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from('instagram_instances')
        .select('id, account_name, ig_user_id')
        .eq('organization_id', orgId)
        .maybeSingle();
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  return <Chat channelFilter="instagram" />;
}

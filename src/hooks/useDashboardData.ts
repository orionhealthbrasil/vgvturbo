import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface FunnelStageCount {
  name: string;
  slug: string;
  color: string;
  count: number;
  position: number;
}

export interface TagCount {
  name: string;
  color: string;
  count: number;
}

export interface LeadTrendPoint {
  date: string;
  label: string;
  count: number;
}

export interface DashboardMetrics {
  totalContacts: number;
  newContactsToday: number;
  newContactsThisWeek: number;
  openContacts: number;
  closedContacts: number;
  closedToday: number;
  closedWon: number;
  closedLost: number;
  conversionRate: number;
  avgClosingDays: number;
  funnelStages: FunnelStageCount[];
  tagCounts: TagCount[];
  contactsByStatus: { status: string; count: number }[];
  leadTrend: LeadTrendPoint[];
  closedTrend: LeadTrendPoint[];
}

export function useDashboardData() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();

  // Realtime: invalidate dashboard queries on contacts/contact_tags changes (debounced)
  useEffect(() => {
    if (!orgId) return;

    const invalidateDashboard = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-total', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-today', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-week', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-open', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-closed', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-closed-today', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-avg-closing', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-lead-trend', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-closed-trend', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-funnel-stages', orgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-tag-counts', orgId] });
      }, 2000); // 2s debounce to batch rapid changes
    };

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, invalidateDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_tags' }, invalidateDashboard)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  // Total contacts count (server-side)
  const { data: totalContacts = 0, isLoading: l1 } = useQuery({
    queryKey: ['dashboard-total', orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // New contacts today
  const { data: newContactsToday = 0, isLoading: l2 } = useQuery({
    queryKey: ['dashboard-today', orgId, todayStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .gte('created_at', todayStart);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // New contacts this week
  const { data: newContactsThisWeek = 0, isLoading: l3 } = useQuery({
    queryKey: ['dashboard-week', orgId, weekStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .gte('created_at', weekStart);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // Open contacts
  const { data: openContacts = 0, isLoading: l4 } = useQuery({
    queryKey: ['dashboard-open', orgId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .eq('status', 'open');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // Closed contacts + won/lost
  const { data: closedData = { closed: 0, won: 0, lost: 0 }, isLoading: l5 } = useQuery({
    queryKey: ['dashboard-closed', orgId],
    queryFn: async () => {
      const [closedRes, wonRes, lostRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!).eq('status', 'closed'),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!).eq('status', 'closed').eq('sale_result', 'won'),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!).eq('status', 'closed').eq('sale_result', 'lost'),
      ]);
      if (closedRes.error) throw closedRes.error;
      if (wonRes.error) throw wonRes.error;
      if (lostRes.error) throw lostRes.error;
      return {
        closed: closedRes.count || 0,
        won: wonRes.count || 0,
        lost: lostRes.count || 0,
      };
    },
    enabled: !!orgId,
  });

  // Closed today
  const { data: closedToday = 0, isLoading: l5b } = useQuery({
    queryKey: ['dashboard-closed-today', orgId, todayStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .eq('status', 'closed')
        .gte('closed_at', todayStart);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // Avg closing days
  const { data: avgClosingDays = 0, isLoading: l6 } = useQuery({
    queryKey: ['dashboard-avg-closing', orgId],
    queryFn: async () => {
      let allClosed: { created_at: string; closed_at: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('created_at, closed_at')
          .eq('organization_id', orgId!)
          .eq('status', 'closed')
          .not('closed_at', 'is', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allClosed = allClosed.concat(data as { created_at: string; closed_at: string }[]);
        if (data.length < pageSize) break;
        page++;
      }
      if (allClosed.length === 0) return 0;
      const totalDays = allClosed.reduce((acc, c) => {
        const created = new Date(c.created_at).getTime();
        const closed = new Date(c.closed_at).getTime();
        return acc + (closed - created) / (1000 * 60 * 60 * 24);
      }, 0);
      return Math.round(totalDays / allClosed.length);
    },
    enabled: !!orgId,
  });

  // Lead trend: last 30 days
  const { data: leadTrend = [], isLoading: l7 } = useQuery({
    queryKey: ['dashboard-lead-trend', orgId, thirtyDaysAgo],
    queryFn: async () => {
      let allRecent: { created_at: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('created_at')
          .eq('organization_id', orgId!)
          .gte('created_at', thirtyDaysAgo)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRecent = allRecent.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      const trend: LeadTrendPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        const count = allRecent.filter(c => c.created_at.slice(0, 10) === dayStr).length;
        trend.push({ date: dayStr, label, count });
      }
      return trend;
    },
    enabled: !!orgId,
  });

  // Closed trend: last 30 days
  const { data: closedTrend = [], isLoading: l7b } = useQuery({
    queryKey: ['dashboard-closed-trend', orgId, thirtyDaysAgo],
    queryFn: async () => {
      let allClosed: { closed_at: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('closed_at')
          .eq('organization_id', orgId!)
          .eq('status', 'closed')
          .not('closed_at', 'is', null)
          .gte('closed_at', thirtyDaysAgo)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allClosed = allClosed.concat(data as { closed_at: string }[]);
        if (data.length < pageSize) break;
        page++;
      }
      const trend: LeadTrendPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        const count = allClosed.filter(c => c.closed_at.slice(0, 10) === dayStr).length;
        trend.push({ date: dayStr, label, count });
      }
      return trend;
    },
    enabled: !!orgId,
  });

  // Funnel stages with counts (server-side)
  const { data: funnelStageCounts = [], isLoading: l8 } = useQuery({
    queryKey: ['dashboard-funnel-stages', orgId],
    queryFn: async () => {
      const { data: stages, error } = await supabase
        .from('funnel_stages')
        .select('id, name, slug, color, position')
        .eq('organization_id', orgId!)
        .order('position');
      if (error) throw error;
      if (!stages || stages.length === 0) return [];

      // Get counts per stage using server-side count
      const counts = await Promise.all(
        stages.map(async (stage) => {
          const { count, error: cErr } = await supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId!)
            .eq('funnel_stage', stage.slug);
          if (cErr) throw cErr;
          return {
            name: stage.name,
            slug: stage.slug,
            color: stage.color,
            position: stage.position,
            count: count || 0,
          };
        })
      );
      return counts;
    },
    enabled: !!orgId,
  });

  // Tags with contact counts
  const { data: tagCounts = [], isLoading: l9 } = useQuery({
    queryKey: ['dashboard-tag-counts', orgId],
    queryFn: async () => {
      const { data: tags, error: tagsError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('organization_id', orgId!);
      if (tagsError) throw tagsError;
      if (!tags || tags.length === 0) return [];

      // Get contact_tags counts - paginated
      let allContactTags: { tag_id: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: ct, error: ctErr } = await supabase
          .from('contact_tags')
          .select('tag_id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (ctErr) throw ctErr;
        if (!ct || ct.length === 0) break;
        allContactTags = allContactTags.concat(ct);
        if (ct.length < pageSize) break;
        page++;
      }

      const countMap: Record<string, number> = {};
      for (const ct of allContactTags) {
        countMap[ct.tag_id] = (countMap[ct.tag_id] || 0) + 1;
      }

      return tags
        .map(t => ({ name: t.name, color: t.color, count: countMap[t.id] || 0 }))
        .filter(t => t.count > 0)
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!orgId,
  });

  const closedContacts = closedData.closed;
  const closedWon = closedData.won;
  const closedLost = closedData.lost;
  const conversionRate = closedContacts > 0
    ? Math.round((closedWon / closedContacts) * 100)
    : 0;

  const contactsByStatus: { status: string; count: number }[] = [];
  if (openContacts > 0) contactsByStatus.push({ status: 'open', count: openContacts });
  if (closedContacts > 0) contactsByStatus.push({ status: 'closed', count: closedContacts });

  const metrics: DashboardMetrics = {
    totalContacts,
    newContactsToday,
    newContactsThisWeek,
    openContacts,
    closedContacts,
    closedToday,
    closedWon,
    closedLost,
    conversionRate,
    avgClosingDays,
    funnelStages: funnelStageCounts,
    tagCounts,
    contactsByStatus,
    leadTrend,
    closedTrend,
  };

  return {
    metrics,
    isLoading: l1 || l2 || l3 || l4 || l5 || l5b || l6 || l7 || l7b || l8 || l9,
  };
}

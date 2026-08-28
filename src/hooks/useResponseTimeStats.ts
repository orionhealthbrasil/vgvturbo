import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export type EndedBy = 'human' | 'automation' | 'ai_agent' | 'conversation_closed';

export interface SlaResponseEvent {
  id: string;
  organization_id: string;
  contact_id: string;
  assigned_to: string | null;
  agent_name: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  wall_duration_minutes: number;
  ended_by: EndedBy;
  breached_sla: boolean;
  threshold_at_event: number | null;
  created_at: string;
}

export interface AgentStats {
  user_id: string | null;
  agent_name: string;
  count: number;
  avg_minutes: number;
  median_minutes: number;
  p90_minutes: number;
  max_minutes: number;
  within_sla_pct: number;
}

export interface ResponseTimeStats {
  events: SlaResponseEvent[];
  totalCount: number;
  avgMinutes: number;
  medianMinutes: number;
  maxMinutes: number;
  withinSlaPct: number;
  byAgent: AgentStats[];
  byDay: { date: string; avg_minutes: number; count: number }[];
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function useResponseTimeStats(daysBack: number = 30) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;

  return useQuery<ResponseTimeStats | null>({
    queryKey: ['response-time-stats', orgId, daysBack],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('sla_response_events' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .gte('ended_at', since)
        .order('ended_at', { ascending: false })
        .limit(2000);
      if (error) throw error;

      const events = (data || []) as unknown as SlaResponseEvent[];
      if (!events.length) {
        return {
          events: [],
          totalCount: 0,
          avgMinutes: 0,
          medianMinutes: 0,
          maxMinutes: 0,
          withinSlaPct: 100,
          byAgent: [],
          byDay: [],
        };
      }

      const durations = events.map(e => e.duration_minutes).sort((a, b) => a - b);
      const total = events.length;
      const avg = durations.reduce((s, x) => s + x, 0) / total;
      const median = quantile(durations, 0.5);
      const max = durations[durations.length - 1];
      const withinSla = events.filter(e => !e.breached_sla).length / total * 100;

      // Group by agent
      const groups = new Map<string, SlaResponseEvent[]>();
      for (const e of events) {
        const key = e.assigned_to || '__unassigned__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }
      const byAgent: AgentStats[] = Array.from(groups.entries()).map(([key, list]) => {
        const sorted = list.map(e => e.duration_minutes).sort((a, b) => a - b);
        const within = list.filter(e => !e.breached_sla).length / list.length * 100;
        return {
          user_id: key === '__unassigned__' ? null : key,
          agent_name: list[0].agent_name || (key === '__unassigned__' ? 'Não atribuído' : 'Sem nome'),
          count: list.length,
          avg_minutes: sorted.reduce((s, x) => s + x, 0) / sorted.length,
          median_minutes: quantile(sorted, 0.5),
          p90_minutes: quantile(sorted, 0.9),
          max_minutes: sorted[sorted.length - 1],
          within_sla_pct: within,
        };
      }).sort((a, b) => b.count - a.count);

      // Group by day
      const dayMap = new Map<string, number[]>();
      for (const e of events) {
        const day = e.ended_at.slice(0, 10);
        if (!dayMap.has(day)) dayMap.set(day, []);
        dayMap.get(day)!.push(e.duration_minutes);
      }
      const byDay = Array.from(dayMap.entries())
        .map(([date, list]) => ({
          date,
          avg_minutes: list.reduce((s, x) => s + x, 0) / list.length,
          count: list.length,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        events,
        totalCount: total,
        avgMinutes: avg,
        medianMinutes: median,
        maxMinutes: max,
        withinSlaPct: withinSla,
        byAgent,
        byDay,
      };
    },
  });
}

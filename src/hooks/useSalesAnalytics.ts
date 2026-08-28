import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export type PeriodKey = 'today' | '7d' | '30d' | '90d' | '365d' | 'all' | 'custom';

export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: 'today', label: 'Hoje', days: null },
  { key: '7d', label: 'Últimos 7 dias', days: 7 },
  { key: '30d', label: 'Últimos 30 dias', days: 30 },
  { key: '90d', label: 'Últimos 90 dias', days: 90 },
  { key: '365d', label: 'Último ano', days: 365 },
  { key: 'all', label: 'Todo o período', days: null },
  { key: 'custom', label: 'Período personalizado', days: null },
];

export interface ClosedContact {
  id: string;
  name: string | null;
  sale_result: string | null;
  loss_reason: string | null;
  win_reason: string | null;
  closed_at: string | null;
  assigned_to: string | null;
  channel: string | null;
  deal_value: number | null;
}

export interface VendorProfile {
  user_id: string;
  full_name: string | null;
}

export function useSalesAnalytics(period: PeriodKey, customFrom?: Date, customTo?: Date, tagId?: string) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const isOwnerOrAdmin =
    orgData?.membership?.role === 'owner' ||
    orgData?.membership?.member_role === 'admin' ||
    orgData?.membership?.member_role === 'analyst';
  const currentUserId = orgData?.membership?.user_id;

  const { cutoff, ceiling } = useMemo(() => {
    if (period === 'custom') {
      const from = customFrom ? new Date(customFrom) : null;
      if (from) from.setHours(0, 0, 0, 0);
      const to = customTo ? new Date(customTo) : null;
      if (to) to.setHours(23, 59, 59, 999);
      return { cutoff: from?.toISOString() ?? null, ceiling: to?.toISOString() ?? null };
    }
    if (period === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { cutoff: d.toISOString(), ceiling: null };
    }
    const days = PERIODS.find((p) => p.key === period)?.days;
    if (!days) return { cutoff: null, ceiling: null };
    const d = new Date();
    d.setDate(d.getDate() - days);
    return { cutoff: d.toISOString(), ceiling: null };
  }, [period, customFrom, customTo]);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['sales-analytics-contacts', orgId, period, customFrom?.toISOString(), customTo?.toISOString(), tagId],
    queryFn: async () => {
      if (!orgId) return [] as ClosedContact[];

      const selectFields = 'id, name, sale_result, loss_reason, win_reason, closed_at, assigned_to, channel, deal_value';

      // When filtering by tag, join contact_tags directly to avoid huge .in() URLs
      if (tagId) {
        let q = supabase
          .from('contact_tags')
          .select(`contact_id, contacts!inner(${selectFields})`)
          .eq('tag_id', tagId)
          .eq('contacts.organization_id', orgId)
          .eq('contacts.status', 'closed')
          .limit(10000);
        if (cutoff) q = q.gte('contacts.closed_at', cutoff);
        if (ceiling) q = q.lte('contacts.closed_at', ceiling);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).map((r: any) => r.contacts) as ClosedContact[];
      }

      let q = supabase
        .from('contacts')
        .select(selectFields)
        .eq('organization_id', orgId)
        .eq('status', 'closed')
        .limit(10000);
      if (cutoff) q = q.gte('closed_at', cutoff);
      if (ceiling) q = q.lte('closed_at', ceiling);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClosedContact[];
    },
    enabled: !!orgId,
  });

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    contacts.forEach((c) => { if (c.assigned_to) ids.add(c.assigned_to); });
    return Array.from(ids);
  }, [contacts]);

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['sales-analytics-profiles', assignedIds],
    queryFn: async () => {
      if (!assignedIds.length) return [] as VendorProfile[];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', assignedIds);
      if (error) throw error;
      return (data ?? []) as VendorProfile[];
    },
    enabled: assignedIds.length > 0,
  });

  const vendorMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.user_id, p.full_name || 'Sem nome'));
    return m;
  }, [profiles]);

  // For non-admin viewers, restrict to their own contacts
  const visibleContacts = useMemo(() => {
    if (isOwnerOrAdmin) return contacts;
    return contacts.filter((c) => c.assigned_to === currentUserId);
  }, [contacts, isOwnerOrAdmin, currentUserId]);

  return {
    contacts: visibleContacts,
    vendorMap,
    isLoading: loadingContacts || loadingProfiles,
    isOwnerOrAdmin,
    currentUserId,
  };
}

export function computeSalesStats(contacts: ClosedContact[], vendorMap: Map<string, string>) {
  const other = contacts.filter((c) => c.sale_result === 'other');
  const relevant = contacts.filter((c) => c.sale_result !== 'other');
  const total = relevant.length;
  const won = relevant.filter((c) => c.sale_result === 'won');
  const lost = relevant.filter((c) => c.sale_result === 'lost');
  const noResult = relevant.filter((c) => !c.sale_result);

  const wonValue = won.reduce((s, c) => s + (c.deal_value || 0), 0);
  const lostValue = lost.reduce((s, c) => s + (c.deal_value || 0), 0);
  const conversionRate = total > 0 ? (won.length / total) * 100 : 0;

  // Loss reasons
  const lossReasonMap = new Map<string, number>();
  lost.forEach((c) => {
    const r = c.loss_reason?.trim() || 'Sem motivo';
    lossReasonMap.set(r, (lossReasonMap.get(r) || 0) + 1);
  });
  const lossReasons = Array.from(lossReasonMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Win reasons
  const winReasonMap = new Map<string, number>();
  won.forEach((c) => {
    const r = c.win_reason?.trim() || 'Sem motivo';
    winReasonMap.set(r, (winReasonMap.get(r) || 0) + 1);
  });
  const channels = Array.from(winReasonMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Per vendor (exclude 'other' from stats)
  const vendorStatsMap = new Map<string, {
    id: string; name: string; total: number; won: number; lost: number; noResult: number;
    wonValue: number; lostValue: number;
    lossReasons: Map<string, number>;
  }>();

  relevant.forEach((c) => {
    const vid = c.assigned_to || '__unassigned__';
    const vname = c.assigned_to ? (vendorMap.get(c.assigned_to) || 'Desconhecido') : 'Sem vendedor';
    if (!vendorStatsMap.has(vid)) {
      vendorStatsMap.set(vid, { id: vid, name: vname, total: 0, won: 0, lost: 0, noResult: 0, wonValue: 0, lostValue: 0, lossReasons: new Map() });
    }
    const vs = vendorStatsMap.get(vid)!;
    vs.total += 1;
    if (c.sale_result === 'won') { vs.won += 1; vs.wonValue += c.deal_value || 0; }
    else if (c.sale_result === 'lost') {
      vs.lost += 1;
      vs.lostValue += c.deal_value || 0;
      const r = c.loss_reason?.trim() || 'Sem motivo';
      vs.lossReasons.set(r, (vs.lossReasons.get(r) || 0) + 1);
    }
    else vs.noResult += 1;
  });

  const vendorStats = Array.from(vendorStatsMap.values())
    .map((vs) => ({
      ...vs,
      conversionRate: vs.total > 0 ? (vs.won / vs.total) * 100 : 0,
      lossReasonsList: Array.from(vs.lossReasons.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.won - a.won);

  return { total, won: won.length, lost: lost.length, other: other.length, noResult: noResult.length, wonValue, lostValue, conversionRate, lossReasons, channels, vendorStats };
}

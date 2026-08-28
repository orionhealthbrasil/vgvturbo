import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Search, Users, ArrowUpDown } from 'lucide-react';

interface DailyContact {
  id: string;
  name: string;
  phone: string;
  profile_picture_url: string | null;
  status: string;
  assigned_to: string | null;
  last_message_at: string | null;
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  assigned_name: string | null;
}

export default function DailyContacts() {
  const { data: orgData } = useUserOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'messages' | 'time'>('time');

  const today = useMemo(() => {
    const now = new Date();
    // Use Brazil timezone offset
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const year = brDate.getFullYear();
    const month = String(brDate.getMonth() + 1).padStart(2, '0');
    const day = String(brDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['daily-contacts', orgData?.organization.id, today],
    queryFn: async () => {
      if (!orgData?.organization.id) return [];

      // Get start/end of today in São Paulo timezone
      const startOfDay = `${today}T00:00:00-03:00`;
      const endOfDay = `${today}T23:59:59-03:00`;

      // Get ALL messages today using pagination (Supabase default limit is 1000)
      const PAGE_SIZE = 1000;
      let messageData: { contact_id: string; direction: string }[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: msgError } = await supabase
          .from('messages')
          .select('contact_id, direction')
          .eq('organization_id', orgData.organization.id)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .range(offset, offset + PAGE_SIZE - 1);

        if (msgError) throw msgError;
        if (!batch || batch.length === 0) {
          hasMore = false;
        } else {
          messageData = messageData.concat(batch);
          offset += PAGE_SIZE;
          if (batch.length < PAGE_SIZE) hasMore = false;
        }
      }

      if (messageData.length === 0) return [];

      // Aggregate message counts per contact
      const contactStats = new Map<string, { total: number; inbound: number; outbound: number }>();
      for (const msg of messageData) {
        const stats = contactStats.get(msg.contact_id) || { total: 0, inbound: 0, outbound: 0 };
        stats.total++;
        if (msg.direction === 'inbound') stats.inbound++;
        else stats.outbound++;
        contactStats.set(msg.contact_id, stats);
      }

      const contactIds = Array.from(contactStats.keys());

      // Fetch contact details
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, phone, profile_picture_url, status, assigned_to, last_message_at')
        .in('id', contactIds);

      if (contactsError) throw contactsError;
      if (!contactsData) return [];

      // Fetch assigned user names
      const assignedIds = contactsData
        .map(c => c.assigned_to)
        .filter((id): id is string => !!id);
      
      let profilesMap = new Map<string, string>();
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', [...new Set(assignedIds)]);
        
        if (profiles) {
          for (const p of profiles) {
            profilesMap.set(p.user_id, p.full_name || 'Sem nome');
          }
        }
      }

      return contactsData.map(c => {
        const stats = contactStats.get(c.id) || { total: 0, inbound: 0, outbound: 0 };
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          profile_picture_url: c.profile_picture_url,
          status: c.status,
          assigned_to: c.assigned_to,
          last_message_at: c.last_message_at,
          message_count: stats.total,
          inbound_count: stats.inbound,
          outbound_count: stats.outbound,
          assigned_name: c.assigned_to ? profilesMap.get(c.assigned_to) || null : null,
        } as DailyContact;
      });
    },
    enabled: !!orgData?.organization.id,
    refetchInterval: 60000, // refresh every minute
  });

  const filtered = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.assigned_name && c.assigned_name.toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'messages') return b.message_count - a.message_count;
      // time
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
    return result;
  }, [contacts, search, sortBy]);

  const openChat = (contactId: string) => {
    navigate(`/chat?contact=${contactId}`);
  };

  const statusLabel = (s: string) => {
    if (s === 'open') return { label: 'Aberto', variant: 'default' as const };
    if (s === 'closed') return { label: 'Fechado', variant: 'secondary' as const };
    return { label: 'Soneca', variant: 'outline' as const };
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendidos no Dia</h1>
          <p className="text-sm text-muted-foreground">
            {today.split('-').reverse().join('/')} — {contacts.length} contato{contacts.length !== 1 ? 's' : ''} atendido{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou responsável..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortBy(prev => prev === 'time' ? 'messages' : prev === 'messages' ? 'name' : 'time')}
            className="shrink-0"
          >
            <ArrowUpDown className="h-4 w-4 mr-1" />
            {sortBy === 'time' ? 'Horário' : sortBy === 'messages' ? 'Msgs' : 'Nome'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium text-foreground">
              {search ? 'Nenhum contato encontrado' : 'Nenhum atendimento hoje'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Tente ajustar sua busca.' : 'Os contatos com interações aparecerão aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(contact => {
            const st = statusLabel(contact.status);
            return (
              <Card key={contact.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={contact.profile_picture_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{contact.name}</span>
                      <Badge variant={st.variant} className="text-[10px] shrink-0">{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{contact.phone}</span>
                      <span>•</span>
                      <span>{contact.message_count} msg{contact.message_count !== 1 ? 's' : ''} ({contact.inbound_count}↓ {contact.outbound_count}↑)</span>
                      <span>•</span>
                      <span>Última: {formatTime(contact.last_message_at)}</span>
                    </div>
                    {contact.assigned_name && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        Responsável: {contact.assigned_name}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 shrink-0"
                    onClick={() => openChat(contact.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">Chat</span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

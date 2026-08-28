import { useState } from 'react';
import { Users, Search, Building2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizationStats, useOrganizationDetails } from '@/hooks/useSuperAdmin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserWithOrg {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  member_role: string | null;
  created_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  organization_name: string;
}

export default function SuperAdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: orgStats = [] } = useOrganizationStats();

  // Fetch all users from all organizations
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users-super-admin'],
    queryFn: async (): Promise<UserWithOrg[]> => {
      // Fetch all organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, organization_id, role, member_role, created_at');

      if (membersError) throw membersError;

      if (!members || members.length === 0) return [];

      // Get unique user IDs and org IDs
      const userIds = [...new Set(members.map(m => m.user_id))];
      const orgIds = [...new Set(members.map(m => m.organization_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);

      // Fetch organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

      return members.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
        organization_name: orgMap.get(m.organization_id) || 'Desconhecida',
      }));
    },
    enabled: orgStats.length > 0,
  });

  const filteredUsers = allUsers.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.profile?.full_name?.toLowerCase().includes(searchLower) ||
      user.profile?.email?.toLowerCase().includes(searchLower) ||
      user.organization_name.toLowerCase().includes(searchLower)
    );
  });

  const getRoleLabel = (role: string, memberRole: string | null) => {
    if (role === 'owner') return 'Dono';
    if (memberRole === 'admin') return 'Admin';
    if (memberRole === 'analyst') return 'Analista';
    if (memberRole === 'viewer') return 'Vendedor';
    return 'Membro';
  };

  const getRoleColor = (role: string) => {
    if (role === 'owner') return 'bg-primary';
    return 'bg-secondary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground">
          Todos os usuários registrados no sistema ({allUsers.length} total)
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou organização..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando usuários...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profile?.avatar_url || ''} />
                      <AvatarFallback>
                        {(user.profile?.full_name || user.profile?.email || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {user.profile?.full_name || 'Usuário sem nome'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{user.profile?.email || 'Sem email'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span>{user.organization_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desde {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="secondary" className={getRoleColor(user.role)}>
                      {getRoleLabel(user.role, user.member_role)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { TrendingUp, MessageSquare, Users, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganizationStats, useGlobalStats } from '@/hooks/useSuperAdmin';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SuperAdminPerformance() {
  const { data: orgStats = [], isLoading } = useOrganizationStats();
  const globalStats = useGlobalStats();

  // Top 10 organizations by messages
  const topOrgsByMessages = useMemo(() => {
    return [...orgStats]
      .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
      .slice(0, 10)
      .map(org => ({
        name: org.name.length > 15 ? org.name.substring(0, 15) + '...' : org.name,
        messages: org.message_count || 0,
      }));
  }, [orgStats]);

  // Top 10 organizations by contacts
  const topOrgsByContacts = useMemo(() => {
    return [...orgStats]
      .sort((a, b) => (b.contact_count || 0) - (a.contact_count || 0))
      .slice(0, 10)
      .map(org => ({
        name: org.name.length > 15 ? org.name.substring(0, 15) + '...' : org.name,
        contacts: org.contact_count || 0,
      }));
  }, [orgStats]);

  // Organization distribution by size (members)
  const orgSizeDistribution = useMemo(() => {
    const small = orgStats.filter(o => o.member_count <= 2).length;
    const medium = orgStats.filter(o => o.member_count > 2 && o.member_count <= 5).length;
    const large = orgStats.filter(o => o.member_count > 5 && o.member_count <= 10).length;
    const enterprise = orgStats.filter(o => o.member_count > 10).length;

    return [
      { name: 'Pequena (1-2)', value: small },
      { name: 'Média (3-5)', value: medium },
      { name: 'Grande (6-10)', value: large },
      { name: 'Enterprise (10+)', value: enterprise },
    ].filter(d => d.value > 0);
  }, [orgStats]);

  // Activity distribution
  const activityDistribution = useMemo(() => {
    const now = new Date();
    const inactive = orgStats.filter(o => !o.last_message_at).length;
    
    const active = orgStats.filter(o => {
      if (!o.last_message_at) return false;
      const days = Math.floor((now.getTime() - new Date(o.last_message_at).getTime()) / (1000 * 60 * 60 * 24));
      return days <= 7;
    }).length;

    const moderate = orgStats.filter(o => {
      if (!o.last_message_at) return false;
      const days = Math.floor((now.getTime() - new Date(o.last_message_at).getTime()) / (1000 * 60 * 60 * 24));
      return days > 7 && days <= 30;
    }).length;

    const dormant = orgStats.filter(o => {
      if (!o.last_message_at) return false;
      const days = Math.floor((now.getTime() - new Date(o.last_message_at).getTime()) / (1000 * 60 * 60 * 24));
      return days > 30;
    }).length;

    return [
      { name: 'Ativa (7d)', value: active },
      { name: 'Moderada (30d)', value: moderate },
      { name: 'Dormant', value: dormant },
      { name: 'Inativa', value: inactive },
    ].filter(d => d.value > 0);
  }, [orgStats]);

  // Averages
  const averages = useMemo(() => {
    if (orgStats.length === 0) return { avgMessages: 0, avgContacts: 0, avgMembers: 0 };
    
    return {
      avgMessages: Math.round(globalStats.totalMessages / orgStats.length),
      avgContacts: Math.round(globalStats.totalContacts / orgStats.length),
      avgMembers: Math.round(globalStats.totalUsers / orgStats.length * 10) / 10,
    };
  }, [orgStats, globalStats]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Performance</h1>
        <p className="text-muted-foreground">Métricas e análises de uso do sistema</p>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média de Mensagens/Org</p>
                <p className="text-2xl font-bold">{averages.avgMessages.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média de Contatos/Org</p>
                <p className="text-2xl font-bold">{averages.avgContacts.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <Building2 className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média de Membros/Org</p>
                <p className="text-2xl font-bold">{averages.avgMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 10 por Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topOrgsByMessages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                <Bar dataKey="messages" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top by Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 por Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topOrgsByContacts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                <Bar dataKey="contacts" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Organization Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Tamanho</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orgSizeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {orgSizeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={activityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {activityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

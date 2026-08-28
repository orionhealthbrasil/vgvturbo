import { Building2, Users, MessageSquare, Contact, Wifi, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useGlobalStats,
  useTopOrganizations,
  useRecentOrganizations,
} from '@/hooks/useSuperAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdminDashboard() {
  const globalStats = useGlobalStats();
  const { data: topOrgs = [], isLoading: loadingTop } = useTopOrganizations(5);
  const { data: recentOrgs = [], isLoading: loadingRecent } = useRecentOrganizations(5);

  const statCards = [
    {
      title: 'Total de Organizações',
      value: globalStats.totalOrganizations,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total de Usuários',
      value: globalStats.totalUsers,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total de Contatos',
      value: globalStats.totalContacts.toLocaleString('pt-BR'),
      icon: Contact,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total de Mensagens',
      value: globalStats.totalMessages.toLocaleString('pt-BR'),
      icon: MessageSquare,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Orgs Ativas (30 dias)',
      value: globalStats.activeOrganizations,
      icon: Activity,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Com WhatsApp Conectado',
      value: globalStats.organizationsWithWhatsApp,
      icon: Wifi,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Painel Super Admin</h1>
        <p className="text-muted-foreground">Visão geral de todas as organizações do sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Organizações (por Mensagens)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : topOrgs.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma organização encontrada</p>
            ) : (
              <div className="space-y-4">
                {topOrgs.map((org, index) => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}º
                      </span>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {org.member_count} membros • {org.contact_count} contatos
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold">
                      {(org.message_count || 0).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organizações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : recentOrgs.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma organização encontrada</p>
            ) : (
              <div className="space-y-4">
                {recentOrgs.map((org) => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {org.member_count} membros • {org.has_whatsapp > 0 ? '✅ WhatsApp' : '❌ Sem WhatsApp'}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

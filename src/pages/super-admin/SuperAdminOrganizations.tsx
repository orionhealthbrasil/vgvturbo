import { useState } from 'react';
import { Building2, Users, MessageSquare, Contact, Search, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizationStats, useOrganizationDetails, OrganizationStats } from '@/hooks/useSuperAdmin';
import { OrganizationFeaturesCard } from '@/components/super-admin/OrganizationFeaturesCard';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdminOrganizations() {
  const { data: orgStats = [], isLoading } = useOrganizationStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  const { data: orgDetails, isLoading: detailsLoading } = useOrganizationDetails(selectedOrgId);

  const filteredOrgs = orgStats.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActivityStatus = (org: OrganizationStats) => {
    if (!org.last_message_at) return { label: 'Inativa', color: 'bg-gray-500' };
    
    const lastActivity = new Date(org.last_message_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) return { label: 'Muito Ativa', color: 'bg-green-500' };
    if (daysDiff <= 7) return { label: 'Ativa', color: 'bg-emerald-500' };
    if (daysDiff <= 30) return { label: 'Moderada', color: 'bg-yellow-500' };
    return { label: 'Inativa', color: 'bg-gray-500' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organizações</h1>
        <p className="text-muted-foreground">Gerenciamento de todas as organizações do sistema</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar organização..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Organizations Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando organizações...</p>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma organização encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrgs.map((org) => {
            const activity = getActivityStatus(org);
            return (
              <Card 
                key={org.id} 
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedOrgId(org.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{org.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Criada em {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {org.has_whatsapp > 0 ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant="secondary" className={`${activity.color} text-white`}>
                        {activity.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{org.member_count} membros</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Contact className="h-4 w-4 text-muted-foreground" />
                      <span>{org.contact_count} contatos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm col-span-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>{(org.message_count || 0).toLocaleString('pt-BR')} mensagens</span>
                    </div>
                  </div>

                  {org.last_message_at && (
                    <p className="text-xs text-muted-foreground">
                      Última atividade: {formatDistanceToNow(new Date(org.last_message_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  )}

                  <Button variant="ghost" size="sm" className="w-full mt-3">
                    Ver Detalhes <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Organization Details Dialog */}
      <Dialog open={!!selectedOrgId} onOpenChange={() => setSelectedOrgId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {orgDetails?.organization?.name || 'Carregando...'}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando detalhes...</div>
          ) : orgDetails ? (
            <div className="space-y-6">
              {/* Organization Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Criada em</p>
                    <p className="font-medium">
                      {format(new Date(orgDetails.organization.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Última atualização</p>
                    <p className="font-medium">
                      {format(new Date(orgDetails.organization.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Members */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Membros ({orgDetails.members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orgDetails.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile?.avatar_url || ''} />
                            <AvatarFallback>
                              {(member.profile?.full_name || member.profile?.email || '?')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.profile?.full_name || 'Usuário'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.profile?.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                            {member.role === 'owner' ? 'Dono' : member.member_role || 'Membro'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Optional Modules */}
              {selectedOrgId && <OrganizationFeaturesCard organizationId={selectedOrgId} />}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

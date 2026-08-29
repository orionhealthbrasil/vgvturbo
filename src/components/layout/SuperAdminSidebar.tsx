import { LayoutDashboard, Building2, Users, LogOut, ArrowLeft, TrendingUp, Headphones, CalendarRange, KeyRound, FileText, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdminSupportUnread } from '@/hooks/useSupportUnread';

const navItems = [
  { title: 'Visão Geral', url: '/super-admin', icon: LayoutDashboard },
  { title: 'Organizações', url: '/super-admin/organizations', icon: Building2 },
  { title: 'Convites de Owner', url: '/super-admin/convites-owner', icon: KeyRound },
  { title: 'Usuários', url: '/super-admin/users', icon: Users },
  { title: 'Performance', url: '/super-admin/performance', icon: TrendingUp },
  { title: 'Templates de Agenda', url: '/super-admin/calendar-templates', icon: CalendarRange },
  { title: 'Blog', url: '/super-admin/blog', icon: FileText },
  { title: 'Chamados', url: '/super-admin/suporte', icon: Headphones, showBadge: true },
  { title: 'Configurações', url: '/super-admin/settings', icon: Settings },
];

export function SuperAdminSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { unreadCount: supportUnread } = useSuperAdminSupportUnread();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Você saiu do sistema');
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-sidebar-foreground">Super Admin</h1>
          <p className="text-xs text-sidebar-foreground/60">Painel de Administração</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider mb-2 px-3">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`w-full rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}
                    >
                      <NavLink to={item.url} className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center">
                          <item.icon className="w-5 h-5 mr-3" />
                          <span className="font-medium">{item.title}</span>
                        </div>
                        {(item as any).showBadge && supportUnread > 0 && (
                          <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-xs bg-destructive text-destructive-foreground">
                            {supportUnread > 99 ? '99+' : supportUnread}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="w-full rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <NavLink to="/" className="flex items-center px-3 py-2.5">
                    <ArrowLeft className="w-5 h-5 mr-3" />
                    <span className="font-medium">Voltar ao App</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="px-2 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.email}
            </p>
            <p className="text-xs text-sidebar-foreground/60">Super Admin</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

import { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, LogOut, UserCircle, Building2, MessageSquare, UserPlus, Smartphone, Workflow, MessagesSquare, Upload, Radio, Shield, Users, Instagram, Headphones, Briefcase, Mail, ListChecks, FolderOpen, Target, ClipboardList, Calendar, CalendarDays, Wallet, Plug, ChevronDown, Filter, Package } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { VGVTurboLogo } from '@/components/brand/VGVTurboLogo';
import { useUserPermissions, Permission } from '@/hooks/usePermissions';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useInternalUnreadMessages } from '@/hooks/useInternalUnreadMessages';
import { useActiveImports } from '@/hooks/useImportHistory';
import { useIsSuperAdmin } from '@/hooks/useSuperAdmin';
import { useSupportUnread } from '@/hooks/useSupportUnread';
import { useHasFeature } from '@/hooks/useOrganizationFeatures';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  badge?: number;
  importingBadge?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'CRM',
    icon: LayoutDashboard,
    items: [
      { title: 'Painel', url: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
      { title: 'WhatsApp', url: '/chat', icon: MessageSquare, permission: 'chat' },
      // INSTAGRAM_HIDDEN: { title: 'Direct', url: '/direct', icon: Instagram, permission: 'chat' },
      { title: 'Chat Interno', url: '/chat-interno', icon: MessagesSquare },
      { title: 'Contatos', url: '/contatos', icon: UserPlus, permission: 'chat' },
      { title: 'Funil', url: '/pipeline', icon: Filter, permission: 'pipeline' },
      { title: 'Catálogo', url: '/catalogo', icon: Package, permission: 'settings' },
      { title: 'Agenda', url: '/agenda', icon: CalendarDays, permission: 'bookings_view' },
      { title: 'Análises', url: '/analises', icon: BarChart3, permission: 'analytics' },
    ],
  },
  {
    label: 'Automações',
    icon: Workflow,
    items: [
      { title: 'Automações', url: '/automations', icon: Workflow, permission: 'automations' },
      { title: 'Disparo em Massa', url: '/broadcast', icon: Radio, permission: 'settings' },
      { title: 'Squad AI', url: '/ia', icon: Users, permission: 'settings' },
    ],
  },
  {
    label: 'Gestão',
    icon: ListChecks,
    items: [
      { title: 'Gestão', url: '/gestao', icon: ListChecks, permission: 'tasks' },
      { title: 'Financeiro', url: '/financeiro', icon: Wallet },
    ],
  },
  {
    label: 'Configurações',
    icon: Building2,
    items: [
      { title: 'Empresa', url: '/organizacao', icon: Building2, permission: 'settings' },
      { title: 'Conexões', url: '/conexoes', icon: Plug, permission: 'connection' },
      { title: 'Pagamentos (Webhooks)', url: '/integracoes-pagamento', icon: Wallet, permission: 'settings' },
      { title: 'Meu Perfil', url: '/perfil', icon: UserCircle },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { permissions, isOwner } = useUserPermissions();
  const { totalUnread: whatsappUnread } = useUnreadMessages('whatsapp');
  // INSTAGRAM_HIDDEN: const { totalUnread: instagramUnread } = useUnreadMessages('instagram');
  const { totalUnread: internalUnread } = useInternalUnreadMessages();
  const { hasActiveImport, activeImports } = useActiveImports();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { unreadCount: supportUnread } = useSupportUnread();
  const { data: hasFinancial } = useHasFeature('financial');
  const { isMobile, setOpenMobile } = useSidebar();

  // Find which group contains the current route
  const activeGroupLabel = navGroups.find((g) =>
    g.items.some((i) => i.url === location.pathname)
  )?.label ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel);

  // Auto-open the group containing the current route on navigation
  useEffect(() => {
    if (activeGroupLabel) setOpenGroup(activeGroupLabel);
  }, [activeGroupLabel]);

  const toggleGroup = (label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  };

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Você saiu do sistema');
  };

  // Filter nav groups and items based on permissions
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.url === '/financeiro') return !!hasFinancial;
      if (item.url === '/gestao') {
        if (isOwner) return true;
        return !!(permissions.tasks?.canView || permissions.projects?.canView || permissions.goals?.canView);
      }
      if (!item.permission) return true;
      if (isOwner) return true;
      return permissions[item.permission]?.canView;
    }).map((item) => {
      if (item.url === '/chat') {
        return { ...item, badge: whatsappUnread };
      }
      // INSTAGRAM_HIDDEN: if (item.url === '/direct') { return { ...item, badge: instagramUnread }; }
      if (item.url === '/chat-interno') {
        return { ...item, badge: internalUnread };
      }
      if (item.url === '/contatos') {
        return { ...item, importingBadge: hasActiveImport };
      }
      if (item.url === '/suporte') {
        return { ...item, badge: supportUnread };
      }
      return item;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-bold text-sidebar-foreground">VGV Turbo</h1>
            <p className="text-xs text-sidebar-foreground/60">CRM otimizado para corretores e imobiliárias</p>
          </div>
          <SidebarTrigger className="shrink-0 -mr-2 -mt-1" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleGroups.map((group) => {
          const isOpen = openGroup === group.label;
          const GroupIcon = group.icon;
          const hasActiveChild = group.items.some((i) => location.pathname === i.url);
          return (
            <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
              <SidebarGroup className="mb-1">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={`group/trigger relative flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-[background-color,color,box-shadow,transform] duration-300 ease-out ${
                      isOpen
                        ? 'bg-sidebar-accent/70 text-sidebar-foreground shadow-sm'
                        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }`}
                  >
                    {hasActiveChild && !isOpen && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-sidebar-primary animate-fade-in" />
                    )}
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-300 ease-out ${
                        isOpen
                          ? 'bg-sidebar-primary/15 text-sidebar-primary scale-105'
                          : 'bg-sidebar-accent/40 text-sidebar-foreground/70 group-hover/trigger:text-sidebar-foreground group-hover/trigger:bg-sidebar-accent/70'
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-left text-[13px] font-semibold tracking-wide">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-sidebar-foreground/50 transition-transform duration-300 ease-out group-hover/trigger:text-sidebar-foreground/80 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <SidebarGroupContent className="mt-1">
                    <SidebarMenu className="relative w-auto min-w-0 pl-3 ml-3.5 space-y-0.5 border-l border-sidebar-border/60">
                      {group.items.map((item, idx) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <SidebarMenuItem
                            key={item.title}
                            style={{ animationDelay: `${idx * 30}ms` }}
                            className="animate-fade-in"
                          >
                            <SidebarMenuButton
                              asChild
                              className={`group/item relative w-full h-auto overflow-visible rounded-md transition-[background-color,color,transform,box-shadow] duration-200 ease-out ${
                                isActive
                                  ? 'bg-sidebar-primary/12 text-sidebar-primary font-semibold shadow-sm shadow-sidebar-primary/10'
                                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-0.5'
                              }`}
                            >
                              <NavLink
                                to={item.url}
                                className="flex items-center justify-between px-2.5 py-2"
                                onClick={closeMobileSidebar}
                              >
                                <span
                                  className={`absolute -left-[13px] top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-sidebar-primary transition-all duration-300 ease-out ${
                                    isActive ? 'h-5 opacity-100' : 'h-0 opacity-0 group-hover/item:h-3 group-hover/item:opacity-60'
                                  }`}
                                />
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                  <item.icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-sidebar-primary' : 'group-hover/item:text-sidebar-foreground'}`} />
                                  <span className="truncate text-sm">{item.title}</span>
                                </div>
                                {item.badge !== undefined && item.badge > 0 && (
                                  <Badge
                                    variant="default"
                                    className="shrink-0 ml-2 h-5 min-w-[20px] px-1.5 text-xs bg-destructive text-destructive-foreground"
                                  >
                                    {item.badge > 99 ? '99+' : item.badge}
                                  </Badge>
                                )}
                                {item.importingBadge && (
                                  <div className="flex items-center gap-1">
                                    <Upload className="w-3.5 h-3.5 text-primary animate-bounce" />
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                  </div>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}

        {/* Suporte standalone link */}
        <NavLink
          to="/suporte"
          onClick={closeMobileSidebar}
          className={({ isActive }) =>
            `group/trigger relative flex w-full items-center gap-3 px-3 py-2.5 mt-1 rounded-lg transition-[background-color,color,box-shadow,transform] duration-300 ease-out ${
              isActive
                ? 'bg-sidebar-accent/70 text-sidebar-foreground shadow-sm'
                : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-300 ease-out ${
                  isActive
                    ? 'bg-sidebar-primary/15 text-sidebar-primary scale-105'
                    : 'bg-sidebar-accent/40 text-sidebar-foreground/70 group-hover/trigger:text-sidebar-foreground group-hover/trigger:bg-sidebar-accent/70'
                }`}
              >
                <Headphones className="w-4 h-4" />
              </span>
              <span className="flex-1 text-left text-[13px] font-semibold tracking-wide">Suporte</span>
              {supportUnread > 0 && (
                <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-xs bg-destructive text-destructive-foreground">
                  {supportUnread > 99 ? '99+' : supportUnread}
                </Badge>
              )}
            </>
          )}
        </NavLink>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        {isSuperAdmin && (
          <NavLink 
            to="/super-admin" 
            onClick={closeMobileSidebar}
            className="flex items-center gap-2 px-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Shield className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium text-primary">
              Super Admin
            </p>
          </NavLink>
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

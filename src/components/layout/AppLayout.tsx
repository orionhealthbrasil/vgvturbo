import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
}

function FloatingSidebarTrigger() {
  const { state, openMobile } = useSidebar();
  const isMobile = useIsMobile();
  // Show floating trigger only when sidebar is hidden so user can bring it back
  const hidden = isMobile ? !openMobile : state === 'collapsed';
  if (!hidden) return null;
  return (
    <SidebarTrigger
      className="fixed top-2 left-2 z-50 bg-card/80 backdrop-blur-sm border border-border shadow-md hover:bg-card"
    />
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const isFullscreenChatPage = location.pathname === '/chat' || location.pathname === '/chat-interno' || location.pathname === '/direct' || location.pathname === '/suporte';

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden pt-[env(safe-area-inset-top)]">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop: hide header on fullscreen chat pages. Mobile: always show header */}
          {(!isFullscreenChatPage || isMobile) && (
            <header className={`border-b border-border bg-card/50 backdrop-blur-sm flex items-center shrink-0 z-20 ${isMobile ? 'h-12 px-3' : 'h-16 px-6'}`}>
              <SidebarTrigger className="mr-4" />
              <div className="flex-1" />
            </header>
          )}
          <div className={isFullscreenChatPage ? "flex-1 min-h-0 overflow-hidden" : `flex-1 min-h-0 overflow-auto ${isMobile ? 'p-3' : 'p-6'}`}>
            {children}
          </div>
        </main>
        {/* Floating trigger for fullscreen chat pages on desktop, so the sidebar can be reopened */}
        {isFullscreenChatPage && !isMobile && <FloatingSidebarTrigger />}
      </div>
    </SidebarProvider>
  );
}

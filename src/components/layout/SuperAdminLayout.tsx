import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SuperAdminSidebar } from './SuperAdminSidebar';

interface SuperAdminLayoutProps {
  children: ReactNode;
  fullHeight?: boolean;
}

export function SuperAdminLayout({ children, fullHeight }: SuperAdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden bg-background">
        <SuperAdminSidebar />
        <main className={fullHeight ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-auto"}>
          {fullHeight ? (
            <div className="h-full overflow-hidden">{children}</div>
          ) : (
            <div className="p-6 max-w-7xl mx-auto">{children}</div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

import { useState } from 'react';
import { useAllSupportTickets, SupportTicket } from '@/hooks/useSupport';
import { TicketList } from '@/components/support/TicketList';
import { TicketChat } from '@/components/support/TicketChat';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function SuperAdminSupport() {
  const { data: tickets = [], isLoading } = useAllSupportTickets();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isMobile) {
    if (selectedTicket) {
      return (
        <div className="h-full overflow-hidden">
          <TicketChat ticket={selectedTicket} onBack={() => setSelectedTicket(null)} canResolve />
        </div>
      );
    }
    return (
      <div className="h-full overflow-hidden">
        <TicketList
          tickets={tickets}
          selectedTicketId={null}
          onSelectTicket={setSelectedTicket}
          showOrgName
        />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 border-r border-border shrink-0 h-full overflow-hidden">
        <TicketList
          tickets={tickets}
          selectedTicketId={selectedTicket?.id || null}
          onSelectTicket={setSelectedTicket}
          showOrgName
        />
      </div>
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {selectedTicket ? (
          <TicketChat ticket={selectedTicket} canResolve />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Selecione um chamado para responder</p>
          </div>
        )}
      </div>
    </div>
  );
}

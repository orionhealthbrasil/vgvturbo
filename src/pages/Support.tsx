import { useState } from 'react';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupport';
import { TicketList } from '@/components/support/TicketList';
import { TicketChat } from '@/components/support/TicketChat';
import { NewTicketDialog } from '@/components/support/NewTicketDialog';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Support() {
  const { data: tickets = [], isLoading } = useSupportTickets();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mobile: show list or chat
  if (isMobile) {
    if (selectedTicket) {
      return (
        <div className="h-full overflow-hidden">
          <TicketChat ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />
          <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
        </div>
      );
    }
    return (
      <div className="h-full overflow-hidden">
        <TicketList
          tickets={tickets}
          selectedTicketId={null}
          onSelectTicket={setSelectedTicket}
          onNewTicket={() => setShowNewTicket(true)}
        />
        <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
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
          onNewTicket={() => setShowNewTicket(true)}
        />
      </div>
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {selectedTicket ? (
          <TicketChat ticket={selectedTicket} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Selecione um chamado ou abra um novo</p>
          </div>
        )}
      </div>
      <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
    </div>
  );
}

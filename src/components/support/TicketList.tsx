import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, CheckCircle2 } from 'lucide-react';
import { SupportTicket } from '@/hooks/useSupport';
import { cn } from '@/lib/utils';

interface TicketListProps {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticket: SupportTicket) => void;
  onNewTicket?: () => void;
  showOrgName?: boolean;
}

export function TicketList({ tickets, selectedTicketId, onSelectTicket, onNewTicket, showOrgName }: TicketListProps) {
  const openTickets = tickets.filter(t => t.status === 'open');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-lg">Chamados</h2>
        {onNewTicket && (
          <Button size="sm" onClick={onNewTicket}>
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {tickets.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum chamado ainda</p>
          </div>
        )}

        {openTickets.length > 0 && (
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">Abertos ({openTickets.length})</p>
            {openTickets.map(ticket => (
              <TicketItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={() => onSelectTicket(ticket)}
                showOrgName={showOrgName}
              />
            ))}
          </div>
        )}

        {resolvedTickets.length > 0 && (
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">Resolvidos ({resolvedTickets.length})</p>
            {resolvedTickets.map(ticket => (
              <TicketItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={() => onSelectTicket(ticket)}
                showOrgName={showOrgName}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TicketItem({
  ticket,
  isSelected,
  onSelect,
  showOrgName,
}: {
  ticket: SupportTicket;
  isSelected: boolean;
  onSelect: () => void;
  showOrgName?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors mb-1',
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{ticket.subject}</p>
          {showOrgName && (
            <p className="text-xs text-muted-foreground truncate">{ticket.organization_name}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(ticket.updated_at), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge
          variant={ticket.status === 'open' ? 'default' : 'secondary'}
          className="shrink-0 text-xs"
        >
          {ticket.status === 'open' ? (
            <><MessageSquare className="w-3 h-3 mr-1" />Aberto</>
          ) : (
            <><CheckCircle2 className="w-3 h-3 mr-1" />Resolvido</>
          )}
        </Badge>
      </div>
    </button>
  );
}

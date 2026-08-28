import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTicket } from '@/hooks/useSupport';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const createTicket = useCreateTicket();

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }
    try {
      await createTicket.mutateAsync({ subject: subject.trim(), firstMessage: message.trim() });
      toast.success('Chamado aberto com sucesso!');
      setSubject('');
      setMessage('');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao abrir chamado');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Chamado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Assunto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Problema com integração WhatsApp"
              maxLength={200}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva seu problema ou dúvida..."
              className="min-h-[120px] resize-none"
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createTicket.isPending}>
            {createTicket.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Abrir Chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

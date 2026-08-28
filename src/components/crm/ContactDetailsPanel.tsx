import { useState } from 'react';
import { X, ListTodo, FileText, Tag, Phone, Mail, Plus, ChevronDown, Briefcase, GitBranch, NotebookPen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateContact } from '@/hooks/useCRM';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContactCustomFields } from './ContactCustomFields';
import { ContactTagsEditor } from './ContactTagsEditor';
import { ContactTasksTab } from '@/components/tasks/ContactTasksTab';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { DealSection } from './DealSection';
import { StageSelectInline } from './StageSelectInline';
import { useTasks } from '@/hooks/useTasks';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/crm';

interface Props {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ icon, title, badge, action, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
        <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0',
              !open && '-rotate-90',
            )}
          />
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          {badge}
        </CollapsibleTrigger>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      <CollapsibleContent>
        <div className="px-4 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NotesEditor({ contact }: { contact: Contact }) {
  const [value, setValue] = useState(contact.notes || '');
  const debouncedValue = useDebounce(value, 800);
  const updateContact = useUpdateContact();

  useEffect(() => {
    setValue(contact.notes || '');
  }, [contact.notes]);

  useEffect(() => {
    if (debouncedValue === (contact.notes || '')) return;
    updateContact.mutate({ id: contact.id, notes: debouncedValue || null });
  }, [debouncedValue]);

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Anotações sobre o contato..."
      rows={4}
      className="text-xs resize-none"
    />
  );
}

function PanelContent({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { data: tasks = [] } = useTasks({ contactId: contact.id });
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const initials = (contact.name || '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-semibold">Detalhes do contato</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* Identity card */}
        <div className="px-4 py-4 border-b">
          <div className="flex flex-col items-center text-center gap-2">
            <Avatar className="w-16 h-16 border-2 border-primary/20">
              {contact.profile_picture_url && (
                <AvatarImage src={contact.profile_picture_url} alt={contact.name} />
              )}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold leading-tight">{contact.name}</p>
              {contact.phone && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {contact.phone}
                </p>
              )}
              {contact.email && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" />
                  {contact.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline stage (quick switch) */}
        <Section
          icon={<GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Etapa do funil"
          defaultOpen
        >
          <StageSelectInline contact={contact} />
        </Section>

        {/* Deal */}
        <Section
          icon={<Briefcase className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Negócio"
          defaultOpen
        >
          <DealSection contact={contact} />
        </Section>

        {/* Notes */}
        <Section
          icon={<NotebookPen className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Observações"
          defaultOpen={!!(contact.notes)}
        >
          <NotesEditor contact={contact} />
        </Section>

        {/* Tasks */}
        <Section
          icon={<ListTodo className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Tarefas"
          badge={
            tasks.length > 0 && (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                {tasks.length}
              </span>
            )
          }
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setTaskFormOpen(true)}
              aria-label="Nova tarefa"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          }
          defaultOpen
        >
          <ContactTasksTab contactId={contact.id} headerless />
        </Section>

        {/* Custom Fields */}
        <Section
          icon={<FileText className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Campos personalizados"
          defaultOpen={false}
        >
          <ContactCustomFields contactId={contact.id} />
        </Section>

        {/* Tags */}
        <Section
          icon={<Tag className="w-3.5 h-3.5 text-muted-foreground" />}
          title="Tags"
          defaultOpen={false}
        >
          <ContactTagsEditor contactId={contact.id} />
        </Section>
      </ScrollArea>

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        defaultContactId={contact.id}
      />
    </div>
  );
}

export function ContactDetailsPanel({ contact, open, onOpenChange }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes do contato</SheetTitle>
          </SheetHeader>
          <PanelContent contact={contact} onClose={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside className="hidden md:flex w-[340px] shrink-0 border-l bg-card flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
      <PanelContent contact={contact} onClose={() => onOpenChange(false)} />
    </aside>
  );
}

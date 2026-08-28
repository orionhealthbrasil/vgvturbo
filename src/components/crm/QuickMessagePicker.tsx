import { useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { FileText, Image as ImageIcon, Video, Music } from 'lucide-react';
import { useQuickMessages, QuickMessage } from '@/hooks/useQuickMessages';

interface QuickMessagePickerProps {
  search: string;
  onSelect: (message: QuickMessage) => void;
}

export function QuickMessagePicker({ search, onSelect }: QuickMessagePickerProps) {
  const { data: quickMessages = [] } = useQuickMessages();

  // Filter messages based on search (the part after /)
  const filteredMessages = useMemo(() => {
    const query = search.toLowerCase();
    return quickMessages.filter((msg) =>
      msg.shortcut.toLowerCase().includes(query)
    );
  }, [quickMessages, search]);

  const getMediaIcon = (type: string | null) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
      case 'video':
        return <Video className="w-4 h-4 text-muted-foreground" />;
      case 'audio':
        return <Music className="w-4 h-4 text-muted-foreground" />;
      case 'document':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (filteredMessages.length === 0 && quickMessages.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground text-center">
        Nenhuma mensagem rápida configurada.
        <br />
        <span className="text-xs">Configure no seu perfil.</span>
      </div>
    );
  }

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandList>
        <CommandEmpty>Nenhum atalho encontrado</CommandEmpty>
        <CommandGroup heading="Mensagens Rápidas">
          {filteredMessages.map((msg) => (
            <CommandItem
              key={msg.id}
              value={msg.shortcut}
              onSelect={() => onSelect(msg)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-primary font-medium">
                  /{msg.shortcut}
                </span>
                {msg.media_type && getMediaIcon(msg.media_type)}
              </div>
              {msg.content && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {msg.content.slice(0, 30)}
                  {msg.content.length > 30 ? '...' : ''}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

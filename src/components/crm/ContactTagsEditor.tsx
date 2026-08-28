import { useState } from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useTags,
  useContactTags,
  useAddTagToContact,
  useRemoveTagFromContact,
} from '@/hooks/useTags';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContactTagsEditorProps {
  contactId: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function ContactTagsEditor({ contactId, showLabel = true, compact = false }: ContactTagsEditorProps) {
  const [open, setOpen] = useState(false);

  const { data: allTags = [] } = useTags();
  const { data: contactTags = [], isLoading } = useContactTags(contactId);
  const addTag = useAddTagToContact();
  const removeTag = useRemoveTagFromContact();

  const contactTagIds = new Set(contactTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !contactTagIds.has(t.id));

  const handleAddTag = async (tagId: string) => {
    try {
      await addTag.mutateAsync({ contactId, tagId });
    } catch (error) {
      toast.error('Erro ao adicionar tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTag.mutateAsync({ contactId, tagId });
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-1">
        <div className="h-5 w-12 bg-muted rounded animate-pulse" />
        <div className="h-5 w-16 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-0')}>
      {showLabel && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TagIcon className="w-3.5 h-3.5" />
          <span>Tags</span>
        </div>
      )}
      
      <div className="flex flex-wrap gap-1.5 items-center">
        {contactTags.map((tag) => (
          <Badge
            key={tag.id}
            className="pr-1 flex items-center gap-1"
            style={{
              backgroundColor: tag.color,
              color: '#fff',
            }}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-6 px-2 text-xs',
                compact && 'h-5 px-1.5'
              )}
            >
              <Plus className="w-3 h-3 mr-1" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            {availableTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {allTags.length === 0
                  ? 'Nenhuma tag criada'
                  : 'Todas as tags já adicionadas'}
              </p>
            ) : (
              <ScrollArea className="max-h-52 overflow-y-auto">
                <div className="space-y-1 pr-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        handleAddTag(tag.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors text-left"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm truncate">{tag.name}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

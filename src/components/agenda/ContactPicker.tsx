import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useDebounce } from '@/hooks/useDebounce';

export interface ContactSelection {
  contact_id: string | null;
  name: string;
  phone: string;
  email: string | null;
}

interface Props {
  value: ContactSelection | null;
  onChange: (sel: ContactSelection | null) => void;
  disabled?: boolean;
}

export function ContactPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  const { data: contacts } = useQuery({
    queryKey: ['contact-picker', orgId, debounced],
    enabled: !!orgId && open,
    queryFn: async () => {
      if (!orgId) return [];
      const term = debounced.trim();
      let q = supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('organization_id', orgId)
        .eq('is_archived', false)
        .limit(20);
      if (term) {
        q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between', !value && 'text-muted-foreground')}
        >
          {value ? `${value.name} · ${value.phone}` : 'Selecionar contato...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome, telefone, email..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm">
                <p className="text-muted-foreground mb-2">Nenhum contato encontrado.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onChange({ contact_id: null, name: search, phone: '', email: null });
                    setOpen(false);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Cadastrar novo
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {(contacts ?? []).map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange({ contact_id: c.id, name: c.name, phone: c.phone, email: c.email });
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.contact_id === c.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.phone}{c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

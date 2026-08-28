import { useTheme } from 'next-themes';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

// Portuguese translations for categories
const i18n = {
  search: 'Buscar',
  search_no_results_1: 'Ops!',
  search_no_results_2: 'Nenhum emoji encontrado',
  pick: 'Escolha um emoji...',
  add_custom: 'Adicionar emoji',
  categories: {
    activity: 'Atividades',
    custom: 'Personalizados',
    flags: 'Bandeiras',
    foods: 'Comidas e bebidas',
    frequent: 'Recentes',
    nature: 'Animais e natureza',
    objects: 'Objetos',
    people: 'Pessoas',
    places: 'Viagens e lugares',
    search: 'Resultados',
    symbols: 'Símbolos',
  },
  skins: {
    choose: 'Escolha tom de pele',
    '1': 'Padrão',
    '2': 'Claro',
    '3': 'Médio claro',
    '4': 'Médio',
    '5': 'Médio escuro',
    '6': 'Escuro',
  },
};

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const { theme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
          title="Emojis"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-auto p-0 border-none shadow-xl"
      >
        <Picker
          data={data}
          onEmojiSelect={(emoji: any) => onEmojiSelect(emoji.native)}
          theme={theme === 'dark' ? 'dark' : 'light'}
          i18n={i18n}
          previewPosition="none"
          skinTonePosition="search"
          maxFrequentRows={2}
          navPosition="top"
          perLine={8}
          categories={[
            'frequent',
            'people',
            'nature',
            'foods',
            'activity',
            'places',
            'objects',
            'symbols',
            'flags',
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}

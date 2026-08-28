import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const getDateLabel = (d: Date): string => {
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div className="px-3 py-1 bg-muted/80 rounded-full">
        <span className="text-xs text-muted-foreground font-medium">
          {getDateLabel(date)}
        </span>
      </div>
    </div>
  );
}

export function shouldShowDateSeparator(
  currentDate: Date,
  previousDate: Date | null
): boolean {
  if (!previousDate) return true;
  
  const current = new Date(currentDate);
  const previous = new Date(previousDate);
  
  return (
    current.getFullYear() !== previous.getFullYear() ||
    current.getMonth() !== previous.getMonth() ||
    current.getDate() !== previous.getDate()
  );
}

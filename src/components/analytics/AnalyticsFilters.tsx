import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Salesperson } from '@/types/database';
import { DEFECT_TYPES, DEFECT_LABELS } from '@/types/database';

interface AnalyticsFiltersProps {
  salespeople: Salesperson[];
  selectedSalesperson: string;
  onSalespersonChange: (value: string) => void;
  selectedDefectType: string;
  onDefectTypeChange: (value: string) => void;
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
  hideSalespersonFilter?: boolean;
}

export function AnalyticsFilters({
  salespeople,
  selectedSalesperson,
  onSalespersonChange,
  selectedDefectType,
  onDefectTypeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onClearFilters,
  hideSalespersonFilter = false,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {!hideSalespersonFilter && (
        <Select value={selectedSalesperson} onValueChange={onSalespersonChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os Vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Vendedores</SelectItem>
            {salespeople.map((sp) => (
              <SelectItem key={sp.id} value={sp.id}>
                {sp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedDefectType} onValueChange={onDefectTypeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Todas as Categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Categorias</SelectItem>
          {DEFECT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {DEFECT_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[140px] justify-start text-left font-normal',
              !startDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data inicial'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={onStartDateChange}
            locale={ptBR}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[140px] justify-start text-left font-normal',
              !endDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data final'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={onEndDateChange}
            locale={ptBR}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="sm" onClick={onClearFilters}>
        Limpar Filtros
      </Button>
    </div>
  );
}

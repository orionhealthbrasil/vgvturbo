import { useMemo } from 'react';
import { Search, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  PipelineFilters,
  PipelinePeriodPreset,
  PipelineStatusFilter,
} from '@/hooks/usePipelineSavedViews';

export interface FunnelStageOption {
  slug: string;
  name: string;
  color: string;
}

interface Props {
  filters: PipelineFilters;
  onChange: (next: PipelineFilters) => void;
  stages: FunnelStageOption[];
}

const periodLabels: Record<PipelinePeriodPreset, string> = {
  all: 'Todo o período',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  custom: 'Personalizado',
};

const statusLabels: Record<PipelineStatusFilter, string> = {
  all: 'Todos',
  open: 'Em aberto',
  won: 'Ganhos',
  lost: 'Perdidos',
};

export function PipelineFiltersBar({ filters, onChange, stages }: Props) {
  const stagesLabel = useMemo(() => {
    if (filters.stages.length === 0) return 'Todas as etapas';
    if (filters.stages.length === 1) {
      const s = stages.find((x) => x.slug === filters.stages[0]);
      return s?.name ?? '1 etapa';
    }
    return `${filters.stages.length} etapas`;
  }, [filters.stages, stages]);

  const toggleStage = (slug: string) => {
    const exists = filters.stages.includes(slug);
    const next = exists
      ? filters.stages.filter((s) => s !== slug)
      : [...filters.stages, slug];
    onChange({ ...filters, stages: next });
  };

  const clearAll = () => {
    onChange({
      ...filters,
      search: '',
      status: 'all',
      stages: [],
      period: 'all',
      date_from: null,
      date_to: null,
    });
  };

  const hasActive =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.stages.length > 0 ||
    filters.period !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Status */}
      <Select
        value={filters.status}
        onValueChange={(v) => onChange({ ...filters, status: v as PipelineStatusFilter })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['all', 'open', 'won', 'lost'] as PipelineStatusFilter[]).map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabels[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stages multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="default" className="gap-1">
            <Filter className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{stagesLabel}</span>
            {filters.stages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {filters.stages.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
            Etapas do funil
          </p>
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {stages.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3">Nenhuma etapa</p>
            ) : (
              stages.map((s) => {
                const checked = filters.stages.includes(s.slug);
                return (
                  <label
                    key={s.slug}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleStage(s.slug)}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-sm truncate">{s.name}</span>
                  </label>
                );
              })
            )}
          </div>
          {filters.stages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => onChange({ ...filters, stages: [] })}
            >
              Limpar seleção
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Period */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="default" className="gap-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="truncate max-w-[140px]">{periodLabels[filters.period]}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-1">
            {(['all', '7d', '30d', '90d', 'custom'] as PipelinePeriodPreset[]).map((p) => (
              <button
                key={p}
                onClick={() =>
                  onChange({
                    ...filters,
                    period: p,
                    date_from: p === 'custom' ? filters.date_from : null,
                    date_to: p === 'custom' ? filters.date_to : null,
                  })
                }
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-accent ${
                  filters.period === p ? 'bg-accent font-medium' : ''
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {filters.period === 'custom' && (
            <div className="space-y-2 mt-3 pt-3 border-t">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(e) =>
                    onChange({ ...filters, date_from: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(e) =>
                    onChange({ ...filters, date_to: e.target.value || null })
                  }
                />
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
          <X className="w-3.5 h-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}

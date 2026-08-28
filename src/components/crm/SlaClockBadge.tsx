import { useEffect, useMemo, useState } from 'react';
import { Clock, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateBusinessMinutes,
  getBusinessStatus,
  formatLocalInstant,
  type BusinessHoursConfig,
  type HolidayLite,
} from '@/lib/business-minutes';

interface SlaClockBadgeProps {
  startedAt: string | null | undefined;
  thresholdMinutes?: number;
  businessHours?: BusinessHoursConfig | null;
  holidays?: HolidayLite[] | null;
  className?: string;
}

function fmt(min: number): string {
  if (min < 1) return '<1m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

const REASON_LABEL: Record<NonNullable<ReturnType<typeof getBusinessStatus>['reason']>, string> = {
  before_open: 'Fora do horário',
  after_close: 'Fora do horário',
  lunch: 'Pausa de almoço',
  weekend: 'Fim de semana',
  holiday: 'Feriado',
  non_working_day: 'Dia não útil',
};

/**
 * Cronômetro determinístico do SLA — renderiza ao lado do item do chat.
 * - Calcula MINUTOS ÚTEIS no cliente (mesma regra do servidor).
 * - Quando a loja está fechada, exibe estado "Pausado" e quando volta a contar.
 */
export function SlaClockBadge({
  startedAt,
  thresholdMinutes,
  businessHours,
  holidays,
  className,
}: SlaClockBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const minutes = useMemo(() => {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    if (!Number.isFinite(start.getTime())) return 0;
    return calculateBusinessMinutes(businessHours, holidays, start, new Date(now));
  }, [startedAt, now, businessHours, holidays]);

  const status = useMemo(
    () => getBusinessStatus(businessHours, holidays, new Date(now)),
    [businessHours, holidays, now],
  );

  if (!startedAt) return null;

  const threshold = thresholdMinutes && thresholdMinutes > 0 ? thresholdMinutes : 30;

  // Pausado (loja fechada).
  if (!status.open) {
    const resumeLabel = status.resumesAt ? formatLocalInstant(status.resumesAt, new Date(now)) : null;
    const reasonLabel = status.reason ? REASON_LABEL[status.reason] : 'Pausado';
    const tooltip = resumeLabel
      ? `${reasonLabel} • volta ${resumeLabel}${minutes > 0 ? ` • ${fmt(minutes)} úteis acumulados` : ''}`
      : reasonLabel;

    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 px-1 rounded text-[10px] font-medium shrink-0',
          'bg-muted text-muted-foreground',
          className,
        )}
        title={tooltip}
      >
        <Pause className="w-2.5 h-2.5" />
        {minutes > 0 ? fmt(minutes) : 'Pausado'}
      </span>
    );
  }

  // Aberto — sem tempo útil ainda, não polui a lista.
  if (minutes <= 0) return null;

  const ratio = minutes / threshold;
  const tone =
    ratio >= 1
      ? 'bg-destructive/15 text-destructive'
      : ratio >= 0.5
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1 rounded text-[10px] font-medium shrink-0',
        tone,
        className,
      )}
      title="Tempo útil aguardando resposta"
    >
      <Clock className="w-2.5 h-2.5" />
      {fmt(minutes)}
    </span>
  );
}

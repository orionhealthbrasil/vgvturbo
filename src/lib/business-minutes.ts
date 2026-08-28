// Replica no cliente o public.calculate_business_minutes (SQL).
// Considera timezone America/Sao_Paulo, working_days, business hours,
// pausa de almoço, weekend hours nos dias marcados e feriados (is_closed / custom_hours).

export interface BusinessHoursConfig {
  business_hours_start?: string | null;          // 'HH:MM' ou 'HH:MM:SS'
  business_hours_end?: string | null;
  working_days?: number[] | null;                // 0=Dom..6=Sab
  weekend_hours_enabled?: boolean | null;
  weekend_hours_start?: string | null;
  weekend_hours_end?: string | null;
  lunch_break_enabled?: boolean | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
  lunch_break_days?: number[] | null;
}

export interface HolidayLite {
  holiday_date: string;          // 'YYYY-MM-DD'
  is_closed: boolean;
  custom_hours_start?: string | null;
  custom_hours_end?: string | null;
}

const TZ = 'America/Sao_Paulo';

// Converte timestamp UTC em partes locais (SP).
function toLocalParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  // Minutos absolutos desde epoch local (em SP), tratando como linha do tempo "naive".
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return { year, month, day, hour, minute, second, localMs };
}

function parseHM(t?: string | null): { h: number; m: number } | null {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hh = Number(h), mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { h: hh, m: mm };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Soma de minutos entre dois "instantes locais" (ms naive).
function overlapMin(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  if (e <= s) return 0;
  return Math.floor((e - s) / 60000);
}

export function calculateBusinessMinutes(
  config: BusinessHoursConfig | null | undefined,
  holidays: HolidayLite[] | null | undefined,
  from: Date,
  to: Date,
): number {
  if (!from || !to) return 0;
  if (to.getTime() <= from.getTime()) return 0;

  const cfg = config || {};
  const bhs = parseHM(cfg.business_hours_start) ?? { h: 8, m: 0 };
  const bhe = parseHM(cfg.business_hours_end)   ?? { h: 18, m: 0 };
  const wd  = cfg.working_days && cfg.working_days.length ? cfg.working_days : [1, 2, 3, 4, 5];
  const weEn = !!cfg.weekend_hours_enabled;
  const weS = parseHM(cfg.weekend_hours_start) ?? { h: 9, m: 0 };
  const weE = parseHM(cfg.weekend_hours_end)   ?? { h: 13, m: 0 };
  const lbEn = !!cfg.lunch_break_enabled;
  const lbS = parseHM(cfg.lunch_break_start) ?? { h: 12, m: 0 };
  const lbE = parseHM(cfg.lunch_break_end)   ?? { h: 13, m: 0 };
  const lbD = cfg.lunch_break_days && cfg.lunch_break_days.length ? cfg.lunch_break_days : [1, 2, 3, 4, 5];

  const holidayMap = new Map<string, HolidayLite>();
  for (const h of holidays || []) holidayMap.set(h.holiday_date, h);

  const fromLocal = toLocalParts(from);
  const toLocal = toLocalParts(to);

  // Loop dia a dia (limite 30 dias por segurança)
  let cursorY = fromLocal.year, cursorM = fromLocal.month, cursorD = fromLocal.day;
  let total = 0;
  let safety = 0;
  while (safety++ < 31) {
    // Inicio do dia em ms naive
    const dayStartMs = Date.UTC(cursorY, cursorM - 1, cursorD, 0, 0, 0);
    if (dayStartMs > toLocal.localMs) break;

    const dow = new Date(Date.UTC(cursorY, cursorM - 1, cursorD)).getUTCDay();
    let useDay = false;
    let dayStart: { h: number; m: number } | null = null;
    let dayEnd: { h: number; m: number } | null = null;
    let applyLunch = false;

    const holiday = holidayMap.get(dateKey(cursorY, cursorM, cursorD));
    if (holiday) {
      if (holiday.is_closed) {
        useDay = false;
      } else if (holiday.custom_hours_start && holiday.custom_hours_end) {
        dayStart = parseHM(holiday.custom_hours_start);
        dayEnd = parseHM(holiday.custom_hours_end);
        useDay = !!(dayStart && dayEnd);
      }
    } else if (wd.includes(dow)) {
      if ((dow === 0 || dow === 6) && weEn) {
        dayStart = weS; dayEnd = weE; useDay = true;
      } else {
        dayStart = bhs; dayEnd = bhe; useDay = true;
        if (lbEn && lbD.includes(dow)) applyLunch = true;
      }
    }

    if (useDay && dayStart && dayEnd) {
      const segStart = Date.UTC(cursorY, cursorM - 1, cursorD, dayStart.h, dayStart.m, 0);
      const segEnd   = Date.UTC(cursorY, cursorM - 1, cursorD, dayEnd.h,   dayEnd.m,   0);
      total += overlapMin(segStart, segEnd, fromLocal.localMs, toLocal.localMs);

      if (applyLunch) {
        const lStart = Date.UTC(cursorY, cursorM - 1, cursorD, lbS.h, lbS.m, 0);
        const lEnd   = Date.UTC(cursorY, cursorM - 1, cursorD, lbE.h, lbE.m, 0);
        total -= overlapMin(lStart, lEnd, fromLocal.localMs, toLocal.localMs);
      }
    }

    // Próximo dia
    const next = new Date(Date.UTC(cursorY, cursorM - 1, cursorD + 1));
    cursorY = next.getUTCFullYear();
    cursorM = next.getUTCMonth() + 1;
    cursorD = next.getUTCDate();
  }

  return Math.max(0, total);
}

// ---------------------------------------------------------------------------
// Status do horário comercial (aberto / pausado) e próximo retorno.
// ---------------------------------------------------------------------------

export interface LocalInstant {
  year: number; month: number; day: number; hour: number; minute: number; dow: number;
}

export interface BusinessStatus {
  open: boolean;
  /** Próxima abertura (quando fechado). Undefined se aberto ou se não houver janela em 30 dias. */
  resumesAt?: LocalInstant;
  /** Motivo da pausa (apenas quando fechado). */
  reason?: 'before_open' | 'after_close' | 'lunch' | 'weekend' | 'holiday' | 'non_working_day';
}

/** Retorna até 2 segmentos de horário ([startMin, endMin] em minutos do dia) para um dia local. */
function segmentsForDay(
  cfg: BusinessHoursConfig,
  holidayMap: Map<string, HolidayLite>,
  y: number, m: number, d: number,
): Array<[number, number]> {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const bhs = parseHM(cfg.business_hours_start) ?? { h: 8, m: 0 };
  const bhe = parseHM(cfg.business_hours_end)   ?? { h: 18, m: 0 };
  const wd  = cfg.working_days && cfg.working_days.length ? cfg.working_days : [1, 2, 3, 4, 5];
  const weEn = !!cfg.weekend_hours_enabled;
  const weS = parseHM(cfg.weekend_hours_start) ?? { h: 9, m: 0 };
  const weE = parseHM(cfg.weekend_hours_end)   ?? { h: 13, m: 0 };
  const lbEn = !!cfg.lunch_break_enabled;
  const lbS = parseHM(cfg.lunch_break_start) ?? { h: 12, m: 0 };
  const lbE = parseHM(cfg.lunch_break_end)   ?? { h: 13, m: 0 };
  const lbD = cfg.lunch_break_days && cfg.lunch_break_days.length ? cfg.lunch_break_days : [1, 2, 3, 4, 5];

  const holiday = holidayMap.get(dateKey(y, m, d));
  let dayStart: { h: number; m: number } | null = null;
  let dayEnd: { h: number; m: number } | null = null;
  let applyLunch = false;

  if (holiday) {
    if (holiday.is_closed) return [];
    if (holiday.custom_hours_start && holiday.custom_hours_end) {
      dayStart = parseHM(holiday.custom_hours_start);
      dayEnd = parseHM(holiday.custom_hours_end);
    }
  } else if (wd.includes(dow)) {
    if ((dow === 0 || dow === 6) && weEn) {
      dayStart = weS; dayEnd = weE;
    } else {
      dayStart = bhs; dayEnd = bhe;
      if (lbEn && lbD.includes(dow)) applyLunch = true;
    }
  }

  if (!dayStart || !dayEnd) return [];

  const startMin = dayStart.h * 60 + dayStart.m;
  const endMin = dayEnd.h * 60 + dayEnd.m;
  if (endMin <= startMin) return [];

  if (applyLunch) {
    const lStart = lbS.h * 60 + lbS.m;
    const lEnd = lbE.h * 60 + lbE.m;
    if (lStart > startMin && lEnd < endMin && lEnd > lStart) {
      return [[startMin, lStart], [lEnd, endMin]];
    }
  }
  return [[startMin, endMin]];
}

function toLocalInstant(y: number, m: number, d: number, totalMinutes: number): LocalInstant {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    year: y, month: m, day: d,
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
    dow,
  };
}

export function getBusinessStatus(
  config: BusinessHoursConfig | null | undefined,
  holidays: HolidayLite[] | null | undefined,
  at: Date = new Date(),
): BusinessStatus {
  const cfg = config || {};
  const holidayMap = new Map<string, HolidayLite>();
  for (const h of holidays || []) holidayMap.set(h.holiday_date, h);

  const local = toLocalParts(at);
  const nowMin = local.hour * 60 + local.minute;

  let cursorY = local.year, cursorM = local.month, cursorD = local.day;

  for (let i = 0; i < 31; i++) {
    const segs = segmentsForDay(cfg, holidayMap, cursorY, cursorM, cursorD);
    const isToday = i === 0;

    if (segs.length) {
      // Aberto agora?
      if (isToday) {
        for (const [s, e] of segs) {
          if (nowMin >= s && nowMin < e) return { open: true };
        }
        // Próxima abertura ainda hoje?
        for (const [s] of segs) {
          if (nowMin < s) {
            // Pausa entre segmentos do mesmo dia => almoço; senão antes de abrir
            const wasInLunch = segs.length > 1 && nowMin >= segs[0][1] && nowMin < segs[1][0];
            return {
              open: false,
              resumesAt: toLocalInstant(cursorY, cursorM, cursorD, s),
              reason: wasInLunch ? 'lunch' : 'before_open',
            };
          }
        }
      } else {
        // Próxima abertura em dia futuro
        const wd = cfg.working_days && cfg.working_days.length ? cfg.working_days : [1, 2, 3, 4, 5];
        const todayDow = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
        const reason: BusinessStatus['reason'] =
          holidayMap.has(dateKey(local.year, local.month, local.day)) ? 'holiday'
          : !wd.includes(todayDow) ? ((todayDow === 0 || todayDow === 6) ? 'weekend' : 'non_working_day')
          : 'after_close';
        return {
          open: false,
          resumesAt: toLocalInstant(cursorY, cursorM, cursorD, segs[0][0]),
          reason,
        };
      }
    }

    const next = new Date(Date.UTC(cursorY, cursorM - 1, cursorD + 1));
    cursorY = next.getUTCFullYear();
    cursorM = next.getUTCMonth() + 1;
    cursorD = next.getUTCDate();
  }

  return { open: false };
}

const DOW_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Formata "hoje 14:00", "amanhã 08:00" ou "seg 08:00". */
export function formatLocalInstant(inst: LocalInstant, now: Date = new Date()): string {
  const local = toLocalParts(now);
  const sameDay = inst.year === local.year && inst.month === local.month && inst.day === local.day;
  const tomorrowMs = Date.UTC(local.year, local.month - 1, local.day + 1);
  const tom = new Date(tomorrowMs);
  const isTomorrow =
    inst.year === tom.getUTCFullYear() && inst.month === tom.getUTCMonth() + 1 && inst.day === tom.getUTCDate();

  const hh = String(inst.hour).padStart(2, '0');
  const mm = String(inst.minute).padStart(2, '0');
  if (sameDay) return `hoje ${hh}:${mm}`;
  if (isTomorrow) return `amanhã ${hh}:${mm}`;
  return `${DOW_PT[inst.dow]} ${hh}:${mm}`;
}


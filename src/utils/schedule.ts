import { weekdayOf } from './date';

export interface ScheduleDef {
  times: string[]; // "HH:mm"
  weekdays: number[]; // 0 = domingo ... 6 = sábado; vazio = todos os dias
  validFrom: string; // "YYYY-MM-DD"
  validTo: string | null;
}

export interface TreatmentWindow {
  startDate: string;
  endDate: string | null;
}

export function occursOn(s: ScheduleDef, day: string): boolean {
  if (day < s.validFrom) return false;
  if (s.validTo && day > s.validTo) return false;
  return s.weekdays.length === 0 || s.weekdays.includes(weekdayOf(day));
}

/** Ocorrências ("YYYY-MM-DDTHH:mm") de um dia, respeitando início/término (RN02). */
export function occurrencesOnDay(
  schedules: ScheduleDef[],
  day: string,
  window: TreatmentWindow,
): string[] {
  if (day < window.startDate) return [];
  if (window.endDate && day > window.endDate) return [];
  const slots = new Set<string>();
  for (const s of schedules) {
    if (!occursOn(s, day)) continue;
    for (const t of s.times) slots.add(`${day}T${t}`);
  }
  return [...slots].sort();
}

/** Consumo médio diário planejado, na unidade de estoque. */
export function dailyConsumption(
  timesPerDay: number,
  weekdays: number[],
  qtyPerIntake: number,
): number {
  const daysPerWeek = weekdays.length === 0 ? 7 : new Set(weekdays).size;
  return ((timesPerDay * daysPerWeek) / 7) * qtyPerIntake;
}

export function describeSchedule(times: string[], weekdays: number[], names: string[]): string {
  const when =
    weekdays.length === 0 || weekdays.length === 7
      ? 'todos os dias'
      : [...weekdays].sort((a, b) => a - b).map((d) => names[d]).join(', ');
  return `${times.join(', ')} · ${when}`;
}

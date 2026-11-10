// Datas são tratadas como strings locais para evitar problemas de fuso/horário de verão:
//  - dia:        "YYYY-MM-DD"
//  - ocorrência: "YYYY-MM-DDTHH:mm" (horário local do aparelho)

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const pad = (n: number): string => String(n).padStart(2, '0');

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function weekdayOf(key: string): number {
  return parseKey(key).getDay();
}

/** Diferença em dias inteiros (b - a), imune a horário de verão. */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function formatBR(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function formatShortBR(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

/** Aceita "dd/mm/aaaa" e devolve "YYYY-MM-DD" (ou null se inválido). */
export function parseBR(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Aceita "8:00", "08:00", "0800", "8h00" e devolve "HH:mm" (ou null). */
export function normalizeTime(text: string): string | null {
  const m = /^(\d{1,2})(?::|h)?(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

export function nowLocalStamp(d: Date = new Date()): string {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function stampDay(stamp: string): string {
  return stamp.slice(0, 10);
}

export function stampTime(stamp: string): string {
  return stamp.slice(11, 16);
}

export function formatStamp(stamp: string): string {
  return `${formatShortBR(stampDay(stamp))} ${stampTime(stamp)}`;
}

export function formatIsoLocal(iso: string): string {
  return formatStamp(nowLocalStamp(new Date(iso)));
}

export function formatLongDate(key: string): string {
  const d = parseKey(key);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function relativeDayLabel(key: string, today: string = dateKey()): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff > 1) return `em ${diff} dias`;
  return `há ${-diff} dias`;
}

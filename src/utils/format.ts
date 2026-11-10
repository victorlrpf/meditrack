import type { MedicationWithStock } from '../db/types';
import { formatBR } from './date';

export function fmtQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function parseNumber(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Texto neutro de previsão: sempre deixa claro que é uma estimativa. */
export function forecastLine(m: MedicationWithStock): string {
  const f = m.forecast;
  if (f.status === 'empty') return 'Estoque zerado pelo saldo registrado';
  if (f.status === 'unknown' || f.daysRemaining === null || !f.estimatedEnd)
    return 'Sem estimativa: defina horários e quantidade por administração';
  if (f.coversTreatment && m.endDate)
    return `Estoque estimado cobre o tratamento até ${formatBR(m.endDate)}`;
  const dias = f.daysRemaining === 1 ? '1 dia' : `${f.daysRemaining} dias`;
  return `Estoque estimado para cerca de ${dias} (até ${formatBR(f.estimatedEnd)})`;
}

export const PRESENTATIONS = ['Comprimido', 'Cápsula', 'Gotas', 'Solução', 'Pomada', 'Outro'];
export const STOCK_UNITS = ['comprimidos', 'cápsulas', 'ml', 'frascos', 'gotas', 'doses'];

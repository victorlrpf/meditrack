import type { Forecast } from '../utils/forecast';

export type MedStatus = 'active' | 'paused' | 'ended';
export type MedKind = 'continuous' | 'temporary';

export interface Medication {
  id: number;
  name: string;
  activeIngredient: string | null;
  dosage: string;
  presentation: string;
  qtyPerIntake: number;
  stockUnit: string;
  kind: MedKind;
  status: MedStatus;
  startDate: string;
  endDate: string | null;
  alertLeadDays: number;
  notes: string | null;
}

export interface MedicationWithStock extends Medication {
  stock: number;
  times: string[];
  weekdays: number[];
  dailyConsumption: number;
  forecast: Forecast;
}

export interface MedicationInput {
  name: string;
  activeIngredient: string | null;
  dosage: string;
  presentation: string;
  qtyPerIntake: number;
  stockUnit: string;
  kind: MedKind;
  startDate: string;
  endDate: string | null;
  alertLeadDays: number;
  notes: string | null;
  times: string[];
  weekdays: number[];
  /** Só usado no cadastro: gera a movimentação "initial". */
  initialStock?: number;
}

export type IntakeStatus = 'pending' | 'taken' | 'missed';

export interface IntakeItem {
  id: number;
  medicationId: number;
  medicationName: string;
  dosage: string;
  stockUnit: string;
  scheduledAt: string; // "YYYY-MM-DDTHH:mm"
  status: IntakeStatus;
  qty: number;
  recordedAt: string | null;
  note: string | null;
}

export type TxType = 'initial' | 'purchase' | 'adjustment' | 'intake' | 'intake_revert';

export interface InventoryTx {
  id: number;
  medicationId: number;
  medicationName: string;
  stockUnit: string;
  type: TxType;
  quantity: number; // com sinal
  note: string | null;
  createdAt: string; // ISO
}

export interface AuditEntry {
  id: number;
  medicationId: number | null;
  medicationName: string | null;
  action: string;
  detail: string | null;
  createdAt: string; // ISO
}

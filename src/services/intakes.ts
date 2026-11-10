import { getDb } from '../db/database';
import type { AuditEntry, IntakeItem, IntakeStatus } from '../db/types';
import { addDays, dateKey, formatStamp, isoNow, nowLocalStamp, stampDay } from '../utils/date';
import { occurrencesOnDay } from '../utils/schedule';
import { loadSchedules } from './medications';

const HISTORY_DAYS_BACK = 6;

interface IntakeRow {
  id: number;
  medication_id: number;
  med_name: string;
  dosage: string;
  stock_unit: string;
  scheduled_at: string;
  status: string;
  qty: number;
  recorded_at: string | null;
  note: string | null;
}

const INTAKE_SELECT = `
  SELECT i.id, i.medication_id, m.name AS med_name, m.dosage, m.stock_unit,
         i.scheduled_at, i.status, i.qty, i.recorded_at, i.note
    FROM intake i JOIN medication m ON m.id = i.medication_id`;

function toItem(r: IntakeRow): IntakeItem {
  return {
    id: r.id,
    medicationId: r.medication_id,
    medicationName: r.med_name,
    dosage: r.dosage,
    stockUnit: r.stock_unit,
    scheduledAt: r.scheduled_at,
    status: r.status as IntakeStatus,
    qty: r.qty,
    recordedAt: r.recorded_at,
    note: r.note,
  };
}

/**
 * Gera as ocorrências programadas (status "pendente") de hoje e dos últimos dias,
 * sem duplicar. Ocorrências anteriores ao cadastro do medicamento não são criadas.
 */
export async function ensureIntakes(): Promise<void> {
  const db = await getDb();
  const today = dateKey();
  const meds = await db.getAllAsync<{
    id: number;
    start_date: string;
    end_date: string | null;
    qty_per_intake: number;
    created_at: string;
  }>("SELECT id, start_date, end_date, qty_per_intake, created_at FROM medication WHERE status = 'active'");

  await db.withTransactionAsync(async () => {
    for (const m of meds) {
      const schedules = await loadSchedules(db, m.id);
      const createdStamp = nowLocalStamp(new Date(m.created_at));
      const earliest = addDays(today, -HISTORY_DAYS_BACK);
      let day = [m.start_date, earliest, stampDay(createdStamp)].reduce((a, b) => (a > b ? a : b));
      while (day <= today) {
        const slots = occurrencesOnDay(schedules, day, { startDate: m.start_date, endDate: m.end_date });
        for (const slot of slots) {
          if (slot < createdStamp) continue;
          await db.runAsync(
            "INSERT OR IGNORE INTO intake (medication_id, scheduled_at, status, qty) VALUES (?, ?, 'pending', ?)",
            [m.id, slot, m.qty_per_intake],
          );
        }
        day = addDays(day, 1);
      }
    }
  });
}

/** Pendências dos últimos dias + tudo de hoje, para medicamentos ativos. */
export async function listIntakeWindow(): Promise<IntakeItem[]> {
  const db = await getDb();
  const today = dateKey();
  const windowStart = `${addDays(today, -HISTORY_DAYS_BACK)}T00:00`;
  const todayStart = `${today}T00:00`;
  const tomorrowStart = `${addDays(today, 1)}T00:00`;
  const rows = await db.getAllAsync<IntakeRow>(
    `${INTAKE_SELECT}
      WHERE m.status = 'active' AND i.scheduled_at >= ? AND i.scheduled_at < ?
      ORDER BY i.scheduled_at, m.name`,
    [windowStart, tomorrowStart],
  );
  return rows
    .map(toItem)
    .filter((i) => i.status === 'pending' || i.scheduledAt >= todayStart);
}

export async function listIntakeHistory(
  medicationId: number | null,
  limit = 150,
): Promise<IntakeItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<IntakeRow>(
    `${INTAKE_SELECT}
      WHERE (? IS NULL OR i.medication_id = ?) AND i.scheduled_at <= ?
      ORDER BY i.scheduled_at DESC, i.id DESC
      LIMIT ?`,
    [medicationId, medicationId, `${addDays(dateKey(), 1)}T00:00`, limit],
  );
  return rows.map(toItem);
}

export const STATUS_LABEL: Record<IntakeStatus, string> = {
  pending: 'Pendente',
  taken: 'Administrado',
  missed: 'Não administrado',
};

/**
 * RN03/RN04: somente registros "administrado" reduzem o estoque. Corrigir um
 * registro gera movimentação inversa e fica no log de alterações (RN13).
 */
export async function recordIntake(
  id: number,
  status: IntakeStatus,
  note?: string | null,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<IntakeRow>(`${INTAKE_SELECT} WHERE i.id = ?`, [id]);
    if (!row || row.status === status) return;
    const now = isoNow();

    if (status === 'taken') {
      await db.runAsync(
        'INSERT INTO inventory_tx (medication_id, type, quantity, note, intake_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [row.medication_id, 'intake', -row.qty, `Dose de ${formatStamp(row.scheduled_at)}`, id, now],
      );
    } else if (row.status === 'taken') {
      await db.runAsync(
        'INSERT INTO inventory_tx (medication_id, type, quantity, note, intake_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          row.medication_id,
          'intake_revert',
          row.qty,
          `Registro de ${formatStamp(row.scheduled_at)} corrigido`,
          id,
          now,
        ],
      );
    }

    await db.runAsync('UPDATE intake SET status = ?, recorded_at = ?, note = COALESCE(?, note) WHERE id = ?', [
      status,
      status === 'pending' ? null : now,
      note ?? null,
      id,
    ]);

    if (row.status !== 'pending') {
      await db.runAsync(
        'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
        [
          row.medication_id,
          'Registro corrigido',
          `${row.med_name} ${formatStamp(row.scheduled_at)}: ${STATUS_LABEL[row.status as IntakeStatus]} → ${STATUS_LABEL[status]}`,
          now,
        ],
      );
    }
  });
}

interface AuditRow {
  id: number;
  medication_id: number | null;
  med_name: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export async function listAudit(medicationId: number | null, limit = 150): Promise<AuditEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AuditRow>(
    `SELECT a.id, a.medication_id, m.name AS med_name, a.action, a.detail, a.created_at
       FROM audit_log a LEFT JOIN medication m ON m.id = a.medication_id
      WHERE (? IS NULL OR a.medication_id = ?)
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ?`,
    [medicationId, medicationId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    medicationId: r.medication_id,
    medicationName: r.med_name,
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

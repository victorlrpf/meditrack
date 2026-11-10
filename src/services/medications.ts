import { getDb, type DB } from '../db/database';
import type {
  MedKind,
  MedStatus,
  Medication,
  MedicationInput,
  MedicationWithStock,
} from '../db/types';
import { addDays, dateKey, isoNow, nowLocalStamp } from '../utils/date';
import { computeForecast } from '../utils/forecast';
import { dailyConsumption, type ScheduleDef } from '../utils/schedule';

interface MedRow {
  id: number;
  name: string;
  active_ingredient: string | null;
  dosage: string;
  presentation: string;
  qty_per_intake: number;
  stock_unit: string;
  kind: string;
  status: string;
  start_date: string;
  end_date: string | null;
  alert_lead_days: number;
  notes: string | null;
  stock: number;
}

interface ScheduleRow {
  id: number;
  medication_id: number;
  times: string;
  weekdays: string;
  valid_from: string;
  valid_to: string | null;
}

const MED_SELECT = `
  SELECT m.*,
         (SELECT COALESCE(SUM(quantity), 0) FROM inventory_tx t WHERE t.medication_id = m.id) AS stock
    FROM medication m`;

function toMedication(r: MedRow): Medication {
  return {
    id: r.id,
    name: r.name,
    activeIngredient: r.active_ingredient,
    dosage: r.dosage,
    presentation: r.presentation,
    qtyPerIntake: r.qty_per_intake,
    stockUnit: r.stock_unit,
    kind: r.kind as MedKind,
    status: r.status as MedStatus,
    startDate: r.start_date,
    endDate: r.end_date,
    alertLeadDays: r.alert_lead_days,
    notes: r.notes,
  };
}

export function toScheduleDef(r: ScheduleRow): ScheduleDef {
  return {
    times: JSON.parse(r.times) as string[],
    weekdays: JSON.parse(r.weekdays) as number[],
    validFrom: r.valid_from,
    validTo: r.valid_to,
  };
}

export async function loadSchedules(db: DB, medicationId: number): Promise<ScheduleDef[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedule WHERE medication_id = ? ORDER BY valid_from, id',
    [medicationId],
  );
  return rows.map(toScheduleDef);
}

async function currentSchedule(db: DB, medicationId: number): Promise<ScheduleDef> {
  const row = await db.getFirstAsync<ScheduleRow>(
    'SELECT * FROM schedule WHERE medication_id = ? AND valid_to IS NULL ORDER BY id DESC LIMIT 1',
    [medicationId],
  );
  return row
    ? toScheduleDef(row)
    : { times: [], weekdays: [], validFrom: dateKey(), validTo: null };
}

async function buildView(db: DB, r: MedRow): Promise<MedicationWithStock> {
  const med = toMedication(r);
  const sch = await currentSchedule(db, r.id);
  const daily = dailyConsumption(sch.times.length, sch.weekdays, med.qtyPerIntake);
  return {
    ...med,
    stock: r.stock,
    times: sch.times,
    weekdays: sch.weekdays,
    dailyConsumption: daily,
    forecast: computeForecast({
      stock: r.stock,
      dailyConsumption: daily,
      today: dateKey(),
      leadDays: med.alertLeadDays,
      treatmentEnd: med.endDate,
    }),
  };
}

export async function listMedications(): Promise<MedicationWithStock[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedRow>(`${MED_SELECT} ORDER BY m.name COLLATE NOCASE`);
  return Promise.all(rows.map((r) => buildView(db, r)));
}

export async function getMedicationView(id: number): Promise<MedicationWithStock | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MedRow>(`${MED_SELECT} WHERE m.id = ?`, [id]);
  return row ? buildView(db, row) : null;
}

function sameList(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const sortedTimes = (t: string[]) => [...new Set(t)].sort();
const sortedDays = (d: number[]) => [...new Set(d)].sort((a, b) => a - b);

export async function createMedication(input: MedicationInput): Promise<number> {
  const db = await getDb();
  let id = 0;
  await db.withTransactionAsync(async () => {
    const now = isoNow();
    const res = await db.runAsync(
      `INSERT INTO medication
        (name, active_ingredient, dosage, presentation, qty_per_intake, stock_unit, kind, status,
         start_date, end_date, alert_lead_days, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.activeIngredient,
        input.dosage,
        input.presentation,
        input.qtyPerIntake,
        input.stockUnit,
        input.kind,
        input.startDate,
        input.endDate,
        input.alertLeadDays,
        input.notes,
        now,
        now,
      ],
    );
    id = res.lastInsertRowId;
    await db.runAsync(
      'INSERT INTO schedule (medication_id, times, weekdays, valid_from) VALUES (?, ?, ?, ?)',
      [id, JSON.stringify(sortedTimes(input.times)), JSON.stringify(sortedDays(input.weekdays)), input.startDate],
    );
    if (input.initialStock && input.initialStock > 0) {
      await db.runAsync(
        'INSERT INTO inventory_tx (medication_id, type, quantity, note, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, 'initial', input.initialStock, 'Estoque inicial', now],
      );
    }
    await db.runAsync(
      'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
      [id, 'Cadastro', `${input.name} · ${input.dosage}`, now],
    );
  });
  return id;
}

/**
 * RN11/RN12: alterações de programação criam uma nova vigência; os registros
 * anteriores (administrações, movimentações) permanecem intactos.
 */
export async function updateMedication(id: number, input: MedicationInput): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const now = isoNow();
    const today = dateKey();
    const before = await db.getFirstAsync<MedRow>(`${MED_SELECT} WHERE m.id = ?`, [id]);
    if (!before) throw new Error('Medicamento não encontrado.');

    await db.runAsync(
      `UPDATE medication SET name = ?, active_ingredient = ?, dosage = ?, presentation = ?,
              qty_per_intake = ?, stock_unit = ?, kind = ?, start_date = ?, end_date = ?,
              alert_lead_days = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.name,
        input.activeIngredient,
        input.dosage,
        input.presentation,
        input.qtyPerIntake,
        input.stockUnit,
        input.kind,
        input.startDate,
        input.endDate,
        input.alertLeadDays,
        input.notes,
        now,
        id,
      ],
    );

    const old = await db.getFirstAsync<ScheduleRow>(
      'SELECT * FROM schedule WHERE medication_id = ? AND valid_to IS NULL ORDER BY id DESC LIMIT 1',
      [id],
    );
    const newTimes = sortedTimes(input.times);
    const newDays = sortedDays(input.weekdays);
    const oldDef = old ? toScheduleDef(old) : null;
    const scheduleChanged =
      !oldDef || !sameList(oldDef.times, newTimes) || !sameList(oldDef.weekdays, newDays);

    const details: string[] = [];
    if (scheduleChanged) {
      if (old) {
        if (old.valid_from >= today) {
          await db.runAsync('UPDATE schedule SET times = ?, weekdays = ? WHERE id = ?', [
            JSON.stringify(newTimes),
            JSON.stringify(newDays),
            old.id,
          ]);
        } else {
          await db.runAsync('UPDATE schedule SET valid_to = ? WHERE id = ?', [addDays(today, -1), old.id]);
          await db.runAsync(
            'INSERT INTO schedule (medication_id, times, weekdays, valid_from) VALUES (?, ?, ?, ?)',
            [id, JSON.stringify(newTimes), JSON.stringify(newDays), today],
          );
        }
      } else {
        await db.runAsync(
          'INSERT INTO schedule (medication_id, times, weekdays, valid_from) VALUES (?, ?, ?, ?)',
          [id, JSON.stringify(newTimes), JSON.stringify(newDays), today],
        );
      }
      const fmt = (t: string[], d: number[]) => `${t.join(', ') || '—'} (${d.length ? d.join(',') : 'todos os dias'})`;
      details.push(`Programação: ${oldDef ? fmt(oldDef.times, oldDef.weekdays) : '—'} → ${fmt(newTimes, newDays)}`);
    }
    if (before.dosage !== input.dosage) details.push(`Dosagem: ${before.dosage} → ${input.dosage}`);
    if (before.qty_per_intake !== input.qtyPerIntake)
      details.push(`Quantidade por administração: ${before.qty_per_intake} → ${input.qtyPerIntake}`);

    // Ocorrências futuras ainda pendentes serão regeneradas com a nova programação.
    await db.runAsync(
      "DELETE FROM intake WHERE medication_id = ? AND status = 'pending' AND scheduled_at > ?",
      [id, nowLocalStamp()],
    );
    await db.runAsync("UPDATE intake SET qty = ? WHERE medication_id = ? AND status = 'pending'", [
      input.qtyPerIntake,
      id,
    ]);

    await db.runAsync(
      'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
      [id, 'Edição', details.length ? details.join(' | ') : 'Dados cadastrais atualizados', now],
    );
  });
}

export async function setMedicationStatus(id: number, status: MedStatus): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const now = isoNow();
    await db.runAsync('UPDATE medication SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    if (status !== 'active') {
      await db.runAsync(
        "DELETE FROM intake WHERE medication_id = ? AND status = 'pending' AND scheduled_at > ?",
        [id, nowLocalStamp()],
      );
    }
    const label = status === 'active' ? 'Retomado' : status === 'paused' ? 'Pausado' : 'Encerrado';
    await db.runAsync(
      'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
      [id, label, null, now],
    );
  });
}

export async function deleteMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medication WHERE id = ?', [id]);
}

/** Encerra automaticamente tratamentos cuja data de término já passou. */
export async function autoEndFinished(): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    "UPDATE medication SET status = 'ended', updated_at = ? WHERE status IN ('active','paused') AND end_date IS NOT NULL AND end_date < ?",
    [isoNow(), dateKey()],
  );
  return res.changes;
}

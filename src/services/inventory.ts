import { getDb } from '../db/database';
import type { InventoryTx, TxType } from '../db/types';
import { isoNow } from '../utils/date';

export async function getStock(medicationId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ s: number }>(
    'SELECT COALESCE(SUM(quantity), 0) AS s FROM inventory_tx WHERE medication_id = ?',
    [medicationId],
  );
  return row?.s ?? 0;
}

/** RN05: toda reposição gera uma movimentação de entrada. */
export async function addPurchase(
  medicationId: number,
  quantity: number,
  note: string | null,
): Promise<void> {
  if (!(quantity > 0)) throw new Error('A quantidade da reposição deve ser maior que zero.');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const now = isoNow();
    await db.runAsync(
      'INSERT INTO inventory_tx (medication_id, type, quantity, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [medicationId, 'purchase', quantity, note, now],
    );
    await db.runAsync(
      'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
      [medicationId, 'Reposição', `+${quantity}${note ? ` · ${note}` : ''}`, now],
    );
  });
}

/**
 * RN05/RN06: o ajuste informa a quantidade realmente contada; a diferença vira
 * uma movimentação identificável, com justificativa obrigatória.
 */
export async function adjustToCount(
  medicationId: number,
  counted: number,
  reason: string,
): Promise<number> {
  if (counted < 0) throw new Error('A quantidade contada não pode ser negativa.');
  if (!reason.trim()) throw new Error('Informe o motivo do ajuste.');
  const db = await getDb();
  let delta = 0;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ s: number }>(
      'SELECT COALESCE(SUM(quantity), 0) AS s FROM inventory_tx WHERE medication_id = ?',
      [medicationId],
    );
    const current = row?.s ?? 0;
    delta = Math.round((counted - current) * 1000) / 1000;
    if (delta === 0) return;
    const now = isoNow();
    await db.runAsync(
      'INSERT INTO inventory_tx (medication_id, type, quantity, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [medicationId, 'adjustment', delta, reason.trim(), now],
    );
    await db.runAsync(
      'INSERT INTO audit_log (medication_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
      [
        medicationId,
        'Ajuste de estoque',
        `${current} → ${counted} (${delta > 0 ? '+' : ''}${delta}) · ${reason.trim()}`,
        now,
      ],
    );
  });
  return delta;
}

interface TxRow {
  id: number;
  medication_id: number;
  med_name: string;
  stock_unit: string;
  type: string;
  quantity: number;
  note: string | null;
  created_at: string;
}

export async function listTransactions(
  medicationId?: number | null,
  limit = 200,
): Promise<InventoryTx[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TxRow>(
    `SELECT t.id, t.medication_id, m.name AS med_name, m.stock_unit, t.type, t.quantity, t.note, t.created_at
       FROM inventory_tx t JOIN medication m ON m.id = t.medication_id
      WHERE (? IS NULL OR t.medication_id = ?)
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ?`,
    [medicationId ?? null, medicationId ?? null, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    medicationId: r.medication_id,
    medicationName: r.med_name,
    stockUnit: r.stock_unit,
    type: r.type as TxType,
    quantity: r.quantity,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export const TX_LABEL: Record<TxType, string> = {
  initial: 'Estoque inicial',
  purchase: 'Reposição',
  adjustment: 'Ajuste manual',
  intake: 'Administração',
  intake_revert: 'Administração desfeita',
};

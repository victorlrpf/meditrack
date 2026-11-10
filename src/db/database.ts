import * as SQLite from 'expo-sqlite';

export type DB = SQLite.SQLiteDatabase;

let dbPromise: Promise<DB> | null = null;

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = init().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function init(): Promise<DB> {
  const db = await SQLite.openDatabaseAsync('meditrack.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

const SCHEMA_V1 = `
CREATE TABLE medication (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active_ingredient TEXT,
  dosage TEXT NOT NULL,
  presentation TEXT NOT NULL,
  qty_per_intake REAL NOT NULL,
  stock_unit TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'continuous',
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT NOT NULL,
  end_date TEXT,
  alert_lead_days INTEGER NOT NULL DEFAULT 7,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  times TEXT NOT NULL,
  weekdays TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT
);

CREATE TABLE intake (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  qty REAL NOT NULL,
  recorded_at TEXT,
  note TEXT,
  UNIQUE (medication_id, scheduled_at)
);

CREATE TABLE inventory_tx (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  note TEXT,
  intake_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER REFERENCES medication(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_schedule_med ON schedule(medication_id);
CREATE INDEX idx_intake_med_time ON intake(medication_id, scheduled_at);
CREATE INDEX idx_intake_time ON intake(scheduled_at);
CREATE INDEX idx_tx_med ON inventory_tx(medication_id);
`;

async function migrate(db: DB): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V1);
    });
    await db.execAsync('PRAGMA user_version = 1;');
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM setting WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/** Exclusão total dos dados locais (direito de exclusão — LGPD). */
export async function wipeAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM audit_log; DELETE FROM inventory_tx; DELETE FROM intake; DELETE FROM schedule; DELETE FROM medication; DELETE FROM setting;',
    );
  });
}

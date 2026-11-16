import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toTelegramReminderRows } from './telegram';

const medication = {
  id: 12,
  name: 'Medicamento A',
  dosage: '10 mg',
  status: 'active' as const,
  startDate: '2026-11-01',
  endDate: '2026-12-01',
  times: ['08:00', '20:00'],
  weekdays: [] as number[],
};

test('expande horários diários e ignora medicamentos pausados', () => {
  const rows = toTelegramReminderRows(
    [medication, { ...medication, id: 13, status: 'paused', times: ['09:00'] }],
    'America/Sao_Paulo',
  );
  assert.deepEqual(rows.map((row) => row.schedule_id), ['12:08:00:daily', '12:20:00:daily']);
  assert.equal(rows[0].weekday, null);
  assert.equal(rows[0].timezone, 'America/Sao_Paulo');
  assert.equal(rows[0].end_date, '2026-12-01');
});

test('expande somente os dias selecionados e trata sete dias como diário', () => {
  const rows = toTelegramReminderRows(
    [
      { ...medication, times: ['07:30'], weekdays: [1, 4] },
      { ...medication, id: 14, times: ['09:00'], weekdays: [0, 1, 2, 3, 4, 5, 6] },
    ],
    'UTC',
  );
  assert.deepEqual(rows.map((row) => [row.schedule_id, row.weekday]), [
    ['12:07:30:1', 1],
    ['12:07:30:4', 4],
    ['14:09:00:daily', null],
  ]);
});

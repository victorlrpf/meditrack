import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeForecast } from './forecast';
import { dailyConsumption, occurrencesOnDay, type ScheduleDef } from './schedule';
import { addDays, diffDays, normalizeTime, parseBR } from './date';

test('exemplo do escopo: 60 comprimidos, 2 por dia, alerta 7 dias antes', () => {
  const f = computeForecast({
    stock: 60,
    dailyConsumption: 2,
    today: '2026-11-09',
    leadDays: 7,
    treatmentEnd: null,
  });
  assert.equal(f.daysRemaining, 30);
  assert.equal(f.estimatedEnd, '2026-12-09');
  assert.equal(f.alertDate, '2026-12-02'); // 23 dias depois de hoje
  assert.equal(diffDays('2026-11-09', f.alertDate!), 23);
  assert.equal(f.status, 'ok');
});

test('estoque baixo respeita a antecedência configurada (RN08)', () => {
  const base = { dailyConsumption: 2, today: '2026-11-09', treatmentEnd: null };
  assert.equal(computeForecast({ ...base, stock: 14, leadDays: 7 }).status, 'low');
  assert.equal(computeForecast({ ...base, stock: 16, leadDays: 7 }).status, 'ok');
  assert.equal(computeForecast({ ...base, stock: 16, leadDays: 10 }).status, 'low');
});

test('estoque zerado ou negativo', () => {
  const base = { dailyConsumption: 2, today: '2026-11-09', leadDays: 7, treatmentEnd: null };
  assert.equal(computeForecast({ ...base, stock: 0 }).status, 'empty');
  assert.equal(computeForecast({ ...base, stock: -3 }).status, 'empty');
});

test('sem consumo planejado não inventa estimativa', () => {
  const f = computeForecast({
    stock: 10,
    dailyConsumption: 0,
    today: '2026-11-09',
    leadDays: 7,
    treatmentEnd: null,
  });
  assert.equal(f.status, 'unknown');
  assert.equal(f.estimatedEnd, null);
});

test('estoque que cobre o tratamento até o fim não gera alerta de reposição', () => {
  const f = computeForecast({
    stock: 10,
    dailyConsumption: 2,
    today: '2026-11-09',
    leadDays: 7,
    treatmentEnd: '2026-11-14',
  });
  assert.equal(f.coversTreatment, true);
  assert.equal(f.status, 'ok');
});

test('consumo diário com dias da semana específicos', () => {
  assert.equal(dailyConsumption(2, [], 1), 2);
  assert.equal(dailyConsumption(1, [1, 3, 5], 2), (1 * 3 * 2) / 7);
});

test('ocorrências respeitam início, término, dias da semana e vigência (RN02)', () => {
  // 2026-11-09 é segunda-feira
  const sch: ScheduleDef[] = [
    { times: ['08:00', '20:00'], weekdays: [1], validFrom: '2026-11-01', validTo: '2026-11-15' },
    { times: ['09:00'], weekdays: [], validFrom: '2026-11-16', validTo: null },
  ];
  const win = { startDate: '2026-11-03', endDate: '2026-11-20' };
  assert.deepEqual(occurrencesOnDay(sch, '2026-11-09', win), [
    '2026-11-09T08:00',
    '2026-11-09T20:00',
  ]);
  assert.deepEqual(occurrencesOnDay(sch, '2026-11-10', win), []); // terça, programação só na segunda
  assert.deepEqual(occurrencesOnDay(sch, '2026-11-17', win), ['2026-11-17T09:00']);
  assert.deepEqual(occurrencesOnDay(sch, '2026-11-02', win), []); // antes do início
  assert.deepEqual(occurrencesOnDay(sch, '2026-11-21', win), []); // depois do término
});

test('helpers de data', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(parseBR('09/11/2026'), '2026-11-09');
  assert.equal(parseBR('31/02/2026'), null);
  assert.equal(normalizeTime('8:00'), '08:00');
  assert.equal(normalizeTime('2030'), '20:30');
  assert.equal(normalizeTime('25:00'), null);
});

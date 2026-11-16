import type { MedicationWithStock } from '../db/types';

export type TelegramReminderRow = {
  schedule_id: string;
  medication_name: string;
  dosage: string;
  reminder_time: string;
  weekday: number | null;
  timezone: string;
  start_date: string;
  end_date: string | null;
};

type ScheduledMedication = Pick<
  MedicationWithStock,
  'id' | 'name' | 'dosage' | 'status' | 'startDate' | 'endDate' | 'times' | 'weekdays'
>;

export function toTelegramReminderRows(
  medications: readonly ScheduledMedication[],
  timezone: string,
): TelegramReminderRow[] {
  const reminders: TelegramReminderRow[] = [];
  for (const medication of medications) {
    if (medication.status !== 'active') continue;
    for (const time of medication.times) {
      const weekdays =
        medication.weekdays.length === 0 || medication.weekdays.length === 7
          ? [null]
          : medication.weekdays;
      for (const weekday of weekdays) {
        reminders.push({
          schedule_id: `${medication.id}:${time}:${weekday ?? 'daily'}`,
          medication_name: medication.name,
          dosage: medication.dosage,
          reminder_time: time,
          weekday,
          timezone,
          start_date: medication.startDate,
          end_date: medication.endDate,
        });
      }
    }
  }
  return reminders;
}

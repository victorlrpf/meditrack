import * as Notifications from 'expo-notifications';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { dateKey, parseKey } from '../utils/date';
import { listMedications } from './medications';

const CHANNEL_ID = 'lembretes';

function shouldUseExpoGoFallback(): boolean {
  return Platform.OS === 'android' && isRunningInExpoGo();
}

function getChannelId(): string | undefined {
  return shouldUseExpoGoFallback() ? undefined : CHANNEL_ID;
}

export function initNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || shouldUseExpoGoFallback()) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes de medicamentos',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/**
 * Recria todos os lembretes locais a partir do banco (funciona sem internet).
 * Deve ser chamado após qualquer alteração de programação, estoque ou status.
 *
 * - Horários: gatilho diário (todos os dias) ou semanal (dias específicos).
 * - Reposição: um aviso único na data em que vale planejar a reposição.
 */
export async function refreshReminders(): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    const meds = await listMedications();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!perm.granted) return;
    await ensureChannel();

    const channelId = getChannelId();
    const today = dateKey();
    for (const m of meds) {
      if (m.status !== 'active') continue;

      for (const time of m.times) {
        const [hour, minute] = time.split(':').map(Number);
        const content = {
          title: 'Hora do medicamento',
          body: `${m.name} — ${m.dosage}. Abra o app para registrar.`,
          data: { kind: 'intake', medicationId: m.id },
        };
        if (m.weekdays.length === 0 || m.weekdays.length === 7) {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
              ...(channelId ? { channelId } : {}),
            },
          });
        } else {
          for (const wd of m.weekdays) {
            await Notifications.scheduleNotificationAsync({
              content,
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: wd + 1, // expo: 1 = domingo
                hour,
                minute,
                ...(channelId ? { channelId } : {}),
              },
            });
          }
        }
      }

      const alertDate = m.forecast.alertDate;
      if (alertDate && m.forecast.status === 'ok' && alertDate > today) {
        const when = parseKey(alertDate);
        when.setHours(9, 0, 0, 0);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Hora de planejar a reposição',
            body: `${m.name}: pela programação cadastrada, o estoque deve acabar em cerca de ${m.forecast.daysRemaining} dias.`,
            data: { kind: 'restock', medicationId: m.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            ...(channelId ? { channelId } : {}),
          },
        });
      }
    }
  } catch (e) {
    console.warn('Falha ao agendar lembretes', e);
  }
}

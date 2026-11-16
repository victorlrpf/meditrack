import { getSetting, setSetting } from '../db/database';
import { listMedications } from './medications';
import { supabase } from './supabase';
import { toTelegramReminderRows } from '../utils/telegram';

const DEVICE_ID_KEY = 'telegram_device_id';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY para conectar.');
  }
  return supabase;
}

async function getDeviceId(): Promise<string> {
  let id = await getSetting(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    await setSetting(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getTelegramChatId(): Promise<string> {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return '';

  const { data, error } = await client
    .from('telegram_settings')
    .select('chat_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.chat_id ?? '';
}

export async function saveTelegramChatId(chatId: string): Promise<void> {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Entre na sua conta antes de conectar o Telegram.');

  const trimmedId = chatId.trim();
  if (!/^-?\d+$/.test(trimmedId)) throw new Error('Informe um chat ID numérico válido.');

  const { error } = await client
    .from('telegram_settings')
    .upsert({ user_id: user.id, chat_id: trimmedId, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function testTelegram(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.functions.invoke('telegram-reminders', {
    body: { action: 'test' },
  });
  if (error) throw error;
}

export async function syncTelegramReminders(): Promise<void> {
  if (!supabase) return;
  const client = supabase;
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return;

  const { data: settings, error: settingsError } = await client
    .from('telegram_settings')
    .select('chat_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.chat_id) return;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const deviceId = await getDeviceId();
  const medications = await listMedications();
  const reminders = toTelegramReminderRows(medications, timezone);

  const { error } = await client.rpc('replace_telegram_reminders', {
    p_device_id: deviceId,
    p_rows: reminders,
  });
  if (error) throw error;
}

export async function disconnectTelegram(): Promise<void> {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return;

  const { error: settingsError } = await client
    .from('telegram_settings')
    .delete()
    .eq('user_id', user.id);
  if (settingsError) throw settingsError;

  const { error: remindersError } = await client
    .from('medication_reminders')
    .delete()
    .eq('user_id', user.id);
  if (remindersError) throw remindersError;
}

export async function clearTelegramAccountData(): Promise<void> {
  if (!supabase) return;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return;

  const { error: remindersError } = await supabase
    .from('medication_reminders')
    .delete()
    .eq('user_id', user.id);
  if (remindersError) throw remindersError;
  const { error: settingsError } = await supabase
    .from('telegram_settings')
    .delete()
    .eq('user_id', user.id);
  if (settingsError) throw settingsError;
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw signOutError;
}

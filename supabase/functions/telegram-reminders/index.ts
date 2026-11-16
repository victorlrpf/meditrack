import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Reminder = {
  user_id: string;
  device_id: string;
  schedule_id: string;
  medication_name: string;
  dosage: string;
  reminder_time: string;
  weekday: number | null;
  timezone: string;
  start_date: string;
  end_date: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

function currentLocalParts(timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const dayNumbers: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    weekday: dayNumbers[value('weekday')],
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !botToken) {
    console.error('Required Supabase or Telegram server secrets are missing.');
    return jsonResponse({ error: 'Server is not configured' }, 500);
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === 'test') {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: settings, error } = await admin
      .from('telegram_settings')
      .select('chat_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('Could not read Telegram settings:', error.message);
      return jsonResponse({ error: 'Could not load Telegram settings' }, 500);
    }
    if (!settings?.chat_id) return jsonResponse({ error: 'Save a Telegram chat ID first' }, 400);

    const sent = await sendTelegramMessage(botToken, settings.chat_id, '✅ MediTrack conectado. Você receberá seus lembretes por aqui.');
    return sent ? jsonResponse({ ok: true }) : jsonResponse({ error: 'Telegram did not accept the message' }, 502);
  }

  const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET');
  if (
    body.action !== 'run' ||
    !cronSecret ||
    request.headers.get('x-cron-secret') !== cronSecret
  ) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: settings, error: settingsError } = await admin
    .from('telegram_settings')
    .select('user_id, chat_id');
  if (settingsError) {
    console.error('Could not load Telegram settings:', settingsError.message);
    return jsonResponse({ error: 'Could not load Telegram settings' }, 500);
  }
  const chats = new Map((settings ?? []).map((setting) => [setting.user_id, setting.chat_id]));

  let sentCount = 0;
  let failedCount = 0;
  const now = new Date();
  for (let offset = 0; ; offset += 500) {
    const { data: reminders, error } = await admin
      .from('medication_reminders')
      .select('user_id, device_id, schedule_id, medication_name, dosage, reminder_time, weekday, timezone, start_date, end_date')
      .range(offset, offset + 499);
    if (error) {
      console.error('Could not load medication reminders:', error.message);
      return jsonResponse({ error: 'Could not load medication reminders' }, 500);
    }
    if (!reminders?.length) break;

    for (const reminder of reminders as Reminder[]) {
      const chatId = chats.get(reminder.user_id);
      if (!chatId) continue;

      let local;
      try {
        local = currentLocalParts(reminder.timezone, now);
      } catch (error) {
        console.error('Invalid timezone for reminder:', reminder.schedule_id, error);
        continue;
      }
      if (
        local.time !== reminder.reminder_time.slice(0, 5) ||
        local.date < reminder.start_date ||
        (reminder.end_date !== null && local.date > reminder.end_date) ||
        (reminder.weekday !== null && local.weekday !== reminder.weekday)
      ) {
        continue;
      }

      const deliveryKey = `${local.date}T${local.time}`;
      const { data: claimed, error: claimError } = await admin.rpc('claim_telegram_reminder', {
        p_user_id: reminder.user_id,
        p_device_id: reminder.device_id,
        p_schedule_id: reminder.schedule_id,
        p_delivery_key: deliveryKey,
      });
      if (claimError) {
        console.error('Could not claim reminder:', claimError.message);
        failedCount += 1;
        continue;
      }
      if (!claimed) continue;

      const message = `💊 <b>Hora do medicamento</b>\n${escapeHtml(reminder.medication_name)} — ${escapeHtml(reminder.dosage)}.\nAbra o MediTrack para registrar.`;
      if (await sendTelegramMessage(botToken, chatId, message)) {
        sentCount += 1;
      } else {
        failedCount += 1;
        const { error: releaseError } = await admin.rpc('release_telegram_reminder', {
          p_user_id: reminder.user_id,
          p_device_id: reminder.device_id,
          p_schedule_id: reminder.schedule_id,
          p_delivery_key: deliveryKey,
        });
        if (releaseError) console.error('Could not release failed reminder claim:', releaseError.message);
      }
    }
    if (reminders.length < 500) break;
  }

  return jsonResponse({ ok: true, sent: sentCount, failed: failedCount });
});

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (response.ok) return true;
    console.error('Telegram sendMessage failed:', response.status, await response.text());
  } catch (error) {
    console.error('Telegram request failed:', error);
  }
  return false;
}

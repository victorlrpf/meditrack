create table if not exists public.telegram_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  schedule_id text not null,
  medication_name text not null,
  dosage text not null,
  reminder_time time not null,
  weekday smallint check (weekday between 0 and 6),
  timezone text not null,
  start_date date not null,
  end_date date,
  last_sent_key text,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, schedule_id)
);

alter table public.telegram_settings enable row level security;
alter table public.medication_reminders enable row level security;

drop policy if exists "Users manage their Telegram settings" on public.telegram_settings;
create policy "Users manage their Telegram settings"
  on public.telegram_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their medication reminders" on public.medication_reminders;
create policy "Users manage their medication reminders"
  on public.medication_reminders for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.replace_telegram_reminders(
  p_device_id text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.medication_reminders as existing
   where existing.user_id = auth.uid()
     and existing.device_id = p_device_id
     and existing.schedule_id not in (
       select incoming.schedule_id
         from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as incoming(schedule_id text)
     );

  insert into public.medication_reminders (
    user_id, device_id, schedule_id, medication_name, dosage, reminder_time,
    weekday, timezone, start_date, end_date, updated_at
  )
  select auth.uid(), p_device_id, incoming.schedule_id, incoming.medication_name,
         incoming.dosage, incoming.reminder_time::time, incoming.weekday,
         incoming.timezone, incoming.start_date::date, incoming.end_date::date, now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as incoming(
      schedule_id text,
      medication_name text,
      dosage text,
      reminder_time text,
      weekday smallint,
      timezone text,
      start_date text,
      end_date text
    )
  on conflict (user_id, device_id, schedule_id) do update
    set medication_name = excluded.medication_name,
        dosage = excluded.dosage,
        reminder_time = excluded.reminder_time,
        weekday = excluded.weekday,
        timezone = excluded.timezone,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = now();
end;
$$;

create or replace function public.claim_telegram_reminder(
  p_user_id uuid,
  p_device_id text,
  p_schedule_id text,
  p_delivery_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.medication_reminders
     set last_sent_key = p_delivery_key
   where user_id = p_user_id
     and device_id = p_device_id
     and schedule_id = p_schedule_id
     and last_sent_key is distinct from p_delivery_key;
  return found;
end;
$$;

create or replace function public.release_telegram_reminder(
  p_user_id uuid,
  p_device_id text,
  p_schedule_id text,
  p_delivery_key text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.medication_reminders
     set last_sent_key = null
   where user_id = p_user_id
     and device_id = p_device_id
     and schedule_id = p_schedule_id
     and last_sent_key = p_delivery_key;
$$;

revoke all on function public.replace_telegram_reminders(text, jsonb) from public, anon;
grant execute on function public.replace_telegram_reminders(text, jsonb) to authenticated;

revoke all on function public.claim_telegram_reminder(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_telegram_reminder(uuid, text, text, text) to service_role;

revoke all on function public.release_telegram_reminder(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.release_telegram_reminder(uuid, text, text, text) to service_role;

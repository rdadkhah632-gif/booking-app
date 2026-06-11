-- Stage 6 Batch 5/6: email preferences and appointment reminder foundation.
-- Run this script manually in the Supabase SQL editor.
-- The application falls back to safe enabled transactional defaults when this
-- script has not been installed yet.

create table if not exists public.notification_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_booking_request_updates boolean not null default true,
  email_booking_confirmations boolean not null default true,
  email_booking_cancellations boolean not null default true,
  email_booking_reminders boolean not null default true,
  email_support_updates boolean not null default true,
  email_new_booking_requests boolean not null default true,
  email_instant_booking_confirmations boolean not null default true,
  email_customer_cancellations boolean not null default true,
  email_reschedule_updates boolean not null default true,
  email_billing_updates boolean not null default true,
  email_staff_booking_assignments boolean not null default true,
  email_staff_booking_changes boolean not null default true,
  email_staff_reminders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_notification_email_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notification_email_preferences_updated_at
  on public.notification_email_preferences;

create trigger set_notification_email_preferences_updated_at
before update on public.notification_email_preferences
for each row
execute function public.set_notification_email_preferences_updated_at();

alter table public.notification_email_preferences enable row level security;

drop policy if exists "Users can read their email preferences"
  on public.notification_email_preferences;

create policy "Users can read their email preferences"
on public.notification_email_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert their email preferences"
  on public.notification_email_preferences;

create policy "Users can insert their email preferences"
on public.notification_email_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their email preferences"
  on public.notification_email_preferences;

create policy "Users can update their email preferences"
on public.notification_email_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.notification_email_preferences from anon;
grant select, insert, update
on table public.notification_email_preferences
to authenticated;

comment on table public.notification_email_preferences is
  'User-owned email delivery preferences. In-app notifications are always enabled.';

create table if not exists public.appointment_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null default 'customer_24h'
    check (reminder_type in ('customer_24h')),
  status text not null default 'processing'
    check (
      status in (
        'processing',
        'sent',
        'failed',
        'skipped_provider',
        'skipped_preference'
      )
    ),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, recipient_user_id, reminder_type)
);

create index if not exists appointment_reminder_deliveries_status_idx
  on public.appointment_reminder_deliveries (status, attempted_at);

alter table public.appointment_reminder_deliveries enable row level security;

revoke all on table public.appointment_reminder_deliveries from anon;
revoke all on table public.appointment_reminder_deliveries from authenticated;

comment on table public.appointment_reminder_deliveries is
  'Server-only idempotency and delivery history for appointment reminders.';

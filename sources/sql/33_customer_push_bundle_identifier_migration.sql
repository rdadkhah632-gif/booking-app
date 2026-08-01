-- Stage 13 Batch 13F.5: move the private customer push registry to the
-- permanent paid-team iOS bundle identifier.
--
-- Run after 25_customer_push_device_registry.sql. This preserves any existing
-- private device registrations while replacing the pre-launch bundle identity.
-- It does not send notifications or change user-facing notification settings.

begin;

alter table public.customer_push_devices
  drop constraint if exists customer_push_devices_app_bundle_id_check;

update public.customer_push_devices
set app_bundle_id = 'com.mirebook.ios.customer'
where app_bundle_id = 'com.mirebook.customer';

alter table public.customer_push_devices
  add constraint customer_push_devices_app_bundle_id_check
  check (app_bundle_id = 'com.mirebook.ios.customer');

comment on column public.customer_push_devices.app_bundle_id is
  'Permanent paid-team bundle identifier for the Mirëbook customer iOS app.';

commit;

-- 0014: Cron schedule for edge functions (pg_cron + pg_net)
-- NOTE: requires `project_url` and `service_role_key` setting.
-- Set once in Studio SQL editor:
--   select set_config('app.project_url', '<YOUR-URL>', false);
--   select set_config('app.service_role', '<KEY>', false);
-- Or bake into `extensions.settings`. Here we read from env-like settings.

create extension if not exists pg_net;

create or replace function invoke_edge(function_name text, body jsonb default '{}'::jsonb)
returns bigint language plpgsql as $$
declare
  v_url text := current_setting('app.project_url', true);
  v_key text := current_setting('app.service_role', true);
  v_id bigint;
begin
  if v_url is null or v_key is null then
    raise notice 'app.project_url/app.service_role not set — skipping';
    return null;
  end if;
  select net.http_post(
    url := v_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := body
  ) into v_id;
  return v_id;
end;
$$;

-- 12:15 every day — NBP rate sync
select cron.schedule('nbp_daily_sync', '15 12 * * *',
  $$select invoke_edge('nbp_daily_sync');$$);

-- 08:00 every day — owner digest
select cron.schedule('daily_digest', '0 8 * * *',
  $$select invoke_edge('daily_digest');$$);

-- 09:00 every day — payment reminders
select cron.schedule('payment_reminders_scan', '0 9 * * *',
  $$select invoke_edge('payment_reminders_scan');$$);

-- 10:00 daily — documents >14 days (Warunki п.35)
select cron.schedule('documents_missing_scan', '0 10 * * *',
  $$select invoke_edge('documents_missing_scan');$$);

-- 10:30 daily — thermograph missing
select cron.schedule('thermograph_missing_scan', '30 10 * * *',
  $$select invoke_edge('thermograph_missing_scan');$$);

-- 11:00 daily — pallets 21 days
select cron.schedule('pallets_missing_scan', '0 11 * * *',
  $$select invoke_edge('pallets_missing_scan');$$);

-- 11:30 daily — OCP/licence ≤30d
select cron.schedule('insurance_expiry_scan', '30 11 * * *',
  $$select invoke_edge('insurance_expiry_scan');$$);

-- Every 15 min — auto-accept (Warunki п.9)
select cron.schedule('auto_accept_timer', '*/15 * * * *',
  $$select invoke_edge('auto_accept_timer');$$);

-- Every minute — notifications dispatch
select cron.schedule('notification_dispatcher', '* * * * *',
  $$select invoke_edge('notification_dispatcher');$$);

-- Every 15 min — FleetHand sync pending
select cron.schedule('fleethand_sync', '*/15 * * * *',
  $$select invoke_edge('fleethand_sync');$$);

-- Every hour — Saldeo sync
select cron.schedule('saldeo_sync', '0 * * * *',
  $$select invoke_edge('saldeo_sync');$$);

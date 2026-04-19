-- 0009: Notifications, order events, scheduled reminders, templates

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                -- 'order_dispatched','payment_reminder_7d',...
  channel notification_channel not null,
  language text default 'uk',               -- 'uk','pl','en'
  subject text,
  body text not null,
  variables text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_templates_updated before update on notification_templates for each row execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_manager_id uuid references managers(id) on delete set null,
  recipient_client_id uuid references clients(id) on delete set null,
  recipient_carrier_id uuid references carriers(id) on delete set null,
  recipient_driver_id uuid references drivers(id) on delete set null,
  recipient_raw_email text,
  recipient_raw_phone text,
  recipient_raw_chat_id text,
  order_id uuid references orders(id) on delete cascade,
  channel notification_channel not null,
  template_code text,
  payload jsonb default '{}'::jsonb,
  subject text,
  body text,
  status notification_status default 'pending',
  provider_message_id text,
  sent_at timestamptz,
  read_at timestamptz,
  error_message text,
  attempts int default 0,
  created_at timestamptz default now()
);
create index on notifications (status);
create index on notifications (order_id);

create table order_events (
  id bigserial primary key,
  order_id uuid references orders(id) on delete cascade,
  actor_manager_id uuid references managers(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index on order_events (order_id, created_at desc);

create table scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  reminder_type text not null,              -- 'auto_accept','payment_7d','thermograph_14d',...
  scheduled_for timestamptz not null,
  executed_at timestamptz,
  status text default 'pending',            -- 'pending','executed','cancelled','error'
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index on scheduled_reminders (scheduled_for) where status = 'pending';
create index on scheduled_reminders (order_id);

-- Audit log — generic
create table audit_log (
  id bigserial primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_manager_id uuid references managers(id) on delete set null,
  table_name text not null,
  row_id uuid,
  action text not null,                     -- 'insert','update','delete'
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);
create index on audit_log (table_name, row_id);
create index on audit_log (created_at desc);

-- Generic audit trigger
create or replace function audit_trigger_fn()
returns trigger language plpgsql as $$
begin
  insert into audit_log(table_name, row_id, action, old_value, new_value)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then (old.id)::uuid else (new.id)::uuid end), null),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_audit_orders after insert or update or delete on orders
  for each row execute function audit_trigger_fn();
create trigger trg_audit_invoices_out after insert or update or delete on invoices_out
  for each row execute function audit_trigger_fn();
create trigger trg_audit_invoices_in after insert or update or delete on invoices_in
  for each row execute function audit_trigger_fn();
create trigger trg_audit_carriers after insert or update or delete on carriers
  for each row execute function audit_trigger_fn();
create trigger trg_audit_clients after insert or update or delete on clients
  for each row execute function audit_trigger_fn();

-- Order events from status changes
create or replace function orders_status_event()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into order_events(order_id, event_type, old_value, new_value)
    values (new.id, 'status_changed', to_jsonb(old.status), to_jsonb(new.status));
  end if;
  return new;
end;
$$;
create trigger trg_orders_status_event after update on orders
  for each row when (old.status is distinct from new.status)
  execute function orders_status_event();

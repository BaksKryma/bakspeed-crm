-- 0011: Row-level security
-- Simple policy: authenticated users with a linked `managers` row can read/write everything.
-- Driver-webview uses dedicated SECURITY DEFINER RPCs (not direct SELECT).

-- Helper: current manager row
create or replace function current_manager_id()
returns uuid language sql stable as $$
  select id from managers where user_id = auth.uid() limit 1;
$$;

create or replace function current_user_role()
returns user_role language sql stable as $$
  select role from managers where user_id = auth.uid() limit 1;
$$;

create or replace function is_authenticated_manager()
returns boolean language sql stable as $$
  select exists(select 1 from managers where user_id = auth.uid() and is_active);
$$;

-- Enable RLS
alter table managers enable row level security;
alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table carriers enable row level security;
alter table trucks enable row level security;
alter table drivers enable row level security;
alter table orders enable row level security;
alter table order_country_costs enable row level security;
alter table currency_rates enable row level security;
alter table route_plans enable row level security;
alter table driver_briefs enable row level security;
alter table documents enable row level security;
alter table invoices_out enable row level security;
alter table invoices_in enable row level security;
alter table bank_statements enable row level security;
alter table bank_transactions enable row level security;
alter table penalty_rules enable row level security;
alter table applied_penalties enable row level security;
alter table notification_templates enable row level security;
alter table notifications enable row level security;
alter table order_events enable row level security;
alter table scheduled_reminders enable row level security;
alter table audit_log enable row level security;

-- Baseline: any authenticated manager can select/insert/update.
-- Destructive actions (DELETE) limited to owners.
do $$
declare
  t text;
  tables text[] := array[
    'managers','clients','client_contacts','carriers','trucks','drivers',
    'orders','order_country_costs','currency_rates','route_plans','driver_briefs',
    'documents','invoices_out','invoices_in','bank_statements','bank_transactions',
    'penalty_rules','applied_penalties','notification_templates','notifications',
    'order_events','scheduled_reminders','audit_log'
  ];
begin
  foreach t in array tables loop
    execute format($pol$
      create policy "%1$s_select_auth" on %1$I
      for select to authenticated using (is_authenticated_manager());
    $pol$, t);
    execute format($pol$
      create policy "%1$s_insert_auth" on %1$I
      for insert to authenticated with check (is_authenticated_manager());
    $pol$, t);
    execute format($pol$
      create policy "%1$s_update_auth" on %1$I
      for update to authenticated using (is_authenticated_manager())
      with check (is_authenticated_manager());
    $pol$, t);
    execute format($pol$
      create policy "%1$s_delete_owner" on %1$I
      for delete to authenticated using (current_user_role() = 'owner');
    $pol$, t);
  end loop;
end$$;

-- Driver webview RPC (no direct table access for anon)
create or replace function driver_webview_get(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_brief driver_briefs;
  v_order orders;
  v_driver drivers;
  v_truck trucks;
begin
  select * into v_brief from driver_briefs where sms_link_token = p_token;
  if v_brief.id is null or v_brief.sms_link_expires_at < now() then
    return jsonb_build_object('error', 'invalid_or_expired');
  end if;

  select * into v_order from orders where id = v_brief.order_id;
  select * into v_driver from drivers where id = v_brief.driver_id;
  select * into v_truck from trucks where id = v_order.truck_id;

  return jsonb_build_object(
    'order', to_jsonb(v_order) - 'turnover_netto_original' - 'turnover_netto_eur'
                              - 'price_carrier_netto_original' - 'price_carrier_netto_eur'
                              - 'delta_netto_eur',
    'driver', jsonb_build_object('id', v_driver.id, 'full_name', v_driver.full_name, 'phone', v_driver.phone),
    'truck', jsonb_build_object('name', v_truck.name, 'tractor_plate', v_truck.tractor_plate, 'trailer_plate', v_truck.trailer_plate),
    'brief', jsonb_build_object('id', v_brief.id, 'pdf_path', v_brief.pdf_path)
  );
end;
$$;

revoke all on function driver_webview_get(text) from public;
grant execute on function driver_webview_get(text) to anon;

create or replace function driver_webview_mark_status(p_token text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_brief driver_briefs;
  v_status order_status;
begin
  select * into v_brief from driver_briefs where sms_link_token = p_token;
  if v_brief.id is null or v_brief.sms_link_expires_at < now() then
    return jsonb_build_object('error', 'invalid_or_expired');
  end if;
  v_status := p_status::order_status;
  update orders set status = v_status,
    loading_actual_at = case when v_status = 'loading' then now() else loading_actual_at end,
    unloading_actual_at = case when v_status = 'delivered' then now() else unloading_actual_at end
  where id = v_brief.order_id;
  update driver_briefs set viewed_at = coalesce(viewed_at, now()),
    confirmed_at = case when p_status = 'delivered' then now() else confirmed_at end
  where id = v_brief.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function driver_webview_mark_status(text, text) from public;
grant execute on function driver_webview_mark_status(text, text) to anon;

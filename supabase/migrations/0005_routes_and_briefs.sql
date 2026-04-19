-- 0005: Route plans (Fleet Hand) and driver briefs

create table route_plans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  fleethand_route_id text,
  fleethand_url text,
  map_image_path text,
  countries_breakdown jsonb,
  -- [{"country":"DE","loaded_km":420,"empty_km":30,"rate_per_km_eur":1.45,"amount_eur":653.5}, ...]
  total_loaded_km int,
  total_empty_km int,
  total_km int generated always as
    (coalesce(total_loaded_km,0) + coalesce(total_empty_km,0)) stored,
  total_toll_eur numeric,
  total_fuel_liters numeric,
  start_lat numeric(9,6),
  start_lng numeric(9,6),
  end_lat numeric(9,6),
  end_lng numeric(9,6),
  status text default 'ready',            -- 'pending','ready','error'
  error_message text,
  fetched_at timestamptz default now()
);
create index on route_plans (order_id);

-- back-reference
alter table orders add constraint fk_orders_route_plan
  foreign key (route_plan_id) references route_plans(id) on delete set null;

create table driver_briefs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  pdf_path text,
  sms_link_token text unique,
  sms_link_expires_at timestamptz,
  sent_at timestamptz,
  sent_via notification_channel,
  viewed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);
create index on driver_briefs (order_id);
create index on driver_briefs (sms_link_token);

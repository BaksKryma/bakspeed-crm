-- 0004: Central orders table

create table orders (
  id uuid primary key default gen_random_uuid(),
  our_order_number text unique not null,
  client_order_number text,

  -- Relations
  client_id uuid references clients(id) on delete set null,
  client_contact_id uuid references client_contacts(id) on delete set null,
  manager_id uuid references managers(id) on delete set null,
  carrier_id uuid references carriers(id) on delete set null,
  truck_id uuid references trucks(id) on delete set null,
  driver_id uuid references drivers(id) on delete set null,

  -- Loading
  loading_date date,
  loading_time_from time,
  loading_time_to time,
  loading_place text,                      -- short "DE 94234"
  loading_address text,                    -- full street/city
  loading_post_code text,
  loading_country text,
  loading_lat numeric(9,6),
  loading_lng numeric(9,6),
  loading_reference text,
  loading_notes text,
  loading_contact_name text,
  loading_contact_phone text,

  -- Unloading
  unloading_date date,
  unloading_time_from time,
  unloading_time_to time,
  unloading_place text,
  unloading_address text,
  unloading_post_code text,
  unloading_country text,
  unloading_lat numeric(9,6),
  unloading_lng numeric(9,6),
  unloading_reference text,
  unloading_notes text,
  unloading_contact_name text,
  unloading_contact_phone text,

  -- Goods
  goods_type text,
  weight_kg numeric,
  loading_meters numeric,
  volume_m3 numeric,
  length_cm int,
  width_cm int,
  height_cm int,
  adr boolean default false,
  adr_class text,
  un_number text,
  stackable boolean default false,
  temperature_required boolean default false,
  temperature_min numeric,
  temperature_max numeric,
  pallets_type pallet_type,
  pallets_count int,
  pallets_exchange_required boolean default false,
  goods_value_eur numeric,

  vehicle_type text,                       -- 'Articulated truck', 'Solo', ...
  body_type text,                          -- copy of truck body at dispatch

  -- Multicurrency finance
  client_currency iso_currency default 'EUR',
  turnover_netto_original numeric,
  vat_client_mode vat_mode default 'standard',
  vat_client_rate numeric default 0.23,
  turnover_vat_original numeric generated always as
    (coalesce(turnover_netto_original,0) * coalesce(vat_client_rate,0)) stored,
  turnover_brutto_original numeric generated always as
    (coalesce(turnover_netto_original,0) * (1 + coalesce(vat_client_rate,0))) stored,

  carrier_currency iso_currency default 'EUR',
  price_carrier_netto_original numeric,
  vat_carrier_mode vat_mode default 'standard',
  vat_carrier_rate numeric default 0.23,
  price_carrier_vat_original numeric generated always as
    (coalesce(price_carrier_netto_original,0) * coalesce(vat_carrier_rate,0)) stored,
  price_carrier_brutto_original numeric generated always as
    (coalesce(price_carrier_netto_original,0) * (1 + coalesce(vat_carrier_rate,0))) stored,

  -- Normalised to EUR (NBP rate day before unloading_date)
  nbp_rate_date date,
  nbp_pln_per_eur numeric(10,6),
  turnover_netto_eur numeric,
  price_carrier_netto_eur numeric,
  delta_netto_eur numeric generated always as
    (coalesce(turnover_netto_eur,0) - coalesce(price_carrier_netto_eur,0)) stored,

  -- Route / km (from Fleet Hand)
  route_plan_id uuid,
  paid_km int,
  europe_km int,
  de_km int,
  at_km int,
  fr_km int,
  nl_km int,
  pl_km int,
  cz_km int,
  be_km int,
  it_km int,
  sk_km int,
  ch_km int,
  hu_km int,
  es_km int,
  dk_km int,
  se_km int,
  other_km int,
  empty_km int,
  freight_km int,
  all_km int,
  price_per_km_eur numeric generated always as
    (case when coalesce(all_km,0) > 0
          then coalesce(turnover_netto_eur,0) / nullif(all_km,0)
     end) stored,

  -- Status / timers
  status order_status default 'draft',
  dispatch_date_to_carrier timestamptz,
  auto_accepted_at timestamptz,                          -- Warunki п.9
  loading_actual_at timestamptz,
  unloading_actual_at timestamptz,

  -- Invoicing (client)
  invoice_out_id uuid,
  payment_term_client_days int,
  payment_due_date_client date,
  payment_received_client_date date,
  payment_received_client boolean default false,

  -- Invoicing (carrier)
  invoice_in_id uuid,
  payment_term_carrier_days int default 60,              -- Warunki п.38
  payment_due_date_carrier date,
  payment_to_carrier_date date,
  paid_to_carrier boolean default false,
  carrier_penalty_kind carrier_penalty_kind default 'none',
  carrier_penalty_value numeric,                         -- e.g. 0.20 or extra days

  -- Source
  source_pdf_id uuid,
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references managers(id)
);

create index on orders (loading_date desc);
create index on orders (unloading_date desc);
create index on orders (status);
create index on orders (client_id);
create index on orders (carrier_id);
create index on orders (truck_id);
create index on orders (driver_id);
create index on orders (manager_id);
create index on orders (payment_due_date_client) where payment_received_client = false;
create index on orders (payment_due_date_carrier) where paid_to_carrier = false;
create index on orders using gin (our_order_number gin_trgm_ops);
create index on orders using gin (client_order_number gin_trgm_ops);

create trigger trg_orders_updated before update on orders for each row execute function set_updated_at();

-- Auto-fill NBP rate and EUR-equivalents when unloading_date or prices change
create or replace function orders_recalc_eur()
returns trigger language plpgsql as $$
declare
  v_rate numeric;
  v_rate_date date;
begin
  if new.unloading_date is null then
    return new;
  end if;

  -- rate for day BEFORE unloading (п.39b)
  select rate, rate_date into v_rate, v_rate_date
  from nbp_eur_pln_rate_row((new.unloading_date - interval '1 day')::date);

  if v_rate is not null then
    new.nbp_rate_date := v_rate_date;
    new.nbp_pln_per_eur := v_rate;

    -- turnover
    if new.turnover_netto_original is not null then
      new.turnover_netto_eur := case
        when new.client_currency = 'EUR' then new.turnover_netto_original
        when new.client_currency = 'PLN' then round(new.turnover_netto_original / v_rate, 2)
        else new.turnover_netto_eur
      end;
    end if;

    -- carrier cost
    if new.price_carrier_netto_original is not null then
      new.price_carrier_netto_eur := case
        when new.carrier_currency = 'EUR' then new.price_carrier_netto_original
        when new.carrier_currency = 'PLN' then round(new.price_carrier_netto_original / v_rate, 2)
        else new.price_carrier_netto_eur
      end;
    end if;
  end if;

  -- Auto-compute payment due dates
  if new.loading_date is not null and new.unloading_date is not null then
    if new.payment_term_client_days is not null and new.payment_due_date_client is null then
      new.payment_due_date_client := new.unloading_date + (new.payment_term_client_days || ' days')::interval;
    end if;
    if new.payment_term_carrier_days is not null and new.payment_due_date_carrier is null then
      new.payment_due_date_carrier := new.unloading_date + (new.payment_term_carrier_days || ' days')::interval;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_orders_recalc_eur
  before insert or update of unloading_date, turnover_netto_original, price_carrier_netto_original,
                             client_currency, carrier_currency, payment_term_client_days, payment_term_carrier_days
  on orders
  for each row execute function orders_recalc_eur();

-- Auto-number if not supplied
create or replace function orders_assign_number()
returns trigger language plpgsql as $$
begin
  if new.our_order_number is null or new.our_order_number = '' then
    new.our_order_number := next_order_number(coalesce(new.loading_date, current_date));
  end if;
  return new;
end;
$$;
create trigger trg_orders_assign_number before insert on orders
  for each row execute function orders_assign_number();

-- Per-country cost breakdown (BK-TRANS-style EU/DE/AT per-country pricing)
create table order_country_costs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  country text not null,                       -- 'EU','DE','AT','PL',...
  loaded_km int default 0,
  empty_km int default 0,
  rate_per_km_eur numeric(10,4),
  amount_eur numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  unique (order_id, country)
);
create index on order_country_costs (order_id);

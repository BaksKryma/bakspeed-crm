-- 0002: Reference tables — managers, clients, carriers, trucks, drivers

-- Utility: updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Managers
create table managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  code text unique not null,                  -- 'SK','AA','BA'
  full_name text not null,
  email text,
  phone text,
  telegram_chat_id text,
  role user_role default 'manager',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on managers (is_active);
create trigger trg_managers_updated before update on managers for each row execute function set_updated_at();

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  nip text,
  country text,
  address text,
  post_code text,
  city text,
  default_payment_term_days int default 30,
  default_currency iso_currency default 'EUR',
  default_vat_mode vat_mode default 'standard',
  whitelist_status text,
  whitelist_last_check timestamptz,
  risk_tag text,                              -- 'VIP','RISKY_PAYMENTS'
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on clients (company_name);
create index on clients using gin (company_name gin_trgm_ops);
create index on clients (nip);
create trigger trg_clients_updated before update on clients for each row execute function set_updated_at();

-- Client contacts
create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz default now()
);
create index on client_contacts (client_id);
create index on client_contacts (email);

-- Carriers
create table carriers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  nip text,
  country text,
  address text,
  contact_person text,
  phone text,
  email text,
  default_payment_term_days int default 60,   -- Warunki п.38
  default_currency iso_currency default 'EUR',
  is_own_fleet boolean default false,
  ocp_insurance_expiry date,                  -- Warunki п.30
  ocp_insurance_sum_eur numeric,              -- ≥500 000 EUR expected
  oc_insurance_expiry date,
  whitelist_status text,
  whitelist_last_check timestamptz,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on carriers (company_name);
create index on carriers using gin (company_name gin_trgm_ops);
create index on carriers (is_own_fleet);
create trigger trg_carriers_updated before update on carriers for each row execute function set_updated_at();

-- Trucks
create table trucks (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                  -- 'BAKS1','BAKS2','FCD'...
  carrier_id uuid references carriers(id) on delete set null,
  tractor_plate text,
  trailer_plate text,
  body_type text,                             -- Tautliner / Mega / Curtain / Isotherm
  has_adr_equipment boolean default false,
  has_thermograph boolean default false,
  capacity_kg int,
  loading_meters numeric,
  pallets_capacity int,
  qr_code text unique,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on trucks (carrier_id);
create index on trucks (is_active);
create trigger trg_trucks_updated before update on trucks for each row execute function set_updated_at();

-- Drivers
create table drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  carrier_id uuid references carriers(id) on delete set null,
  current_truck_id uuid references trucks(id) on delete set null,
  licence_number text,
  licence_expiry date,
  has_adr_cert boolean default false,
  adr_cert_expiry date,
  has_ce_cert boolean default false,
  pin_code text,                              -- 4-digit for QR webview
  telegram_chat_id text,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on drivers (carrier_id);
create index on drivers (current_truck_id);
create index on drivers (is_active);
create trigger trg_drivers_updated before update on drivers for each row execute function set_updated_at();

-- Order number sequences (atomic YYYY-MM-NNNNN)
create table order_number_sequences (
  year int not null,
  month int not null,
  next_num int not null default 1,
  primary key (year, month)
);

create or replace function next_order_number(p_date date)
returns text language plpgsql as $$
declare
  v_year int := extract(year from p_date)::int;
  v_month int := extract(month from p_date)::int;
  v_num int;
begin
  insert into order_number_sequences(year, month, next_num)
    values (v_year, v_month, 1)
    on conflict (year, month) do nothing;
  update order_number_sequences
    set next_num = next_num + 1
    where year = v_year and month = v_month
    returning next_num - 1 into v_num;
  return lpad(v_year::text, 4, '0') || '-' || lpad(v_month::text, 2, '0') || '-' || lpad(v_num::text, 5, '0');
end;
$$;

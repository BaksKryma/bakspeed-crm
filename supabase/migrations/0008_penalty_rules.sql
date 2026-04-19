-- 0008: Warunki penalty rules + applied penalties log

create table penalty_rules (
  id uuid primary key default gen_random_uuid(),
  warunki_point int unique not null,
  title text not null,
  description text,
  penalty_amount_eur numeric,
  penalty_formula text,
  trigger_type text,                        -- 'manual','cron','status','timer','text'
  is_auto boolean default false,
  extra_config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table applied_penalties (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  rule_id uuid references penalty_rules(id),
  warunki_point int,
  amount_eur numeric,
  currency iso_currency default 'EUR',
  status text default 'proposed',           -- 'proposed','approved','rejected','applied','cancelled'
  applied_at timestamptz,
  applied_by uuid references managers(id),
  notes text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index on applied_penalties (order_id);
create index on applied_penalties (warunki_point);

-- 0003: NBP currency rates

create table currency_rates (
  rate_date date not null,
  currency iso_currency not null,          -- EUR or PLN (foreign) — stored against base
  base_currency iso_currency not null,     -- always the counter, typically PLN
  rate numeric(10,6) not null,             -- PLN per 1 unit of `currency`
  source text default 'NBP',
  table_type text default 'A',
  table_no text,                           -- e.g. '060/A/NBP/2026'
  effective_date date,
  created_at timestamptz default now(),
  primary key (rate_date, currency, base_currency, source)
);

create index on currency_rates (currency, rate_date desc);

-- Helper: find nearest previous working-day NBP rate for EUR/PLN
create or replace function nbp_eur_pln_rate(p_date date)
returns numeric language sql stable as $$
  select rate
  from currency_rates
  where currency = 'EUR' and base_currency = 'PLN' and source = 'NBP'
    and rate_date <= p_date
  order by rate_date desc
  limit 1;
$$;

create or replace function nbp_eur_pln_rate_row(p_date date)
returns table(rate numeric, rate_date date) language sql stable as $$
  select rate, rate_date
  from currency_rates
  where currency = 'EUR' and base_currency = 'PLN' and source = 'NBP'
    and rate_date <= p_date
  order by rate_date desc
  limit 1;
$$;

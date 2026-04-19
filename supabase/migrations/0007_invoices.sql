-- 0007: Invoices — outbound (client) and inbound (carrier)

-- Outbound invoices (Saldeo-synced)
create table invoices_out (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,

  invoice_number text unique not null,
  saldeo_invoice_id text unique,
  saldeo_sync_status text default 'pending', -- 'pending','synced','error'
  saldeo_last_error text,
  saldeo_synced_at timestamptz,

  issued_date date,
  sale_date date,                            -- = unloading_date (Warunki п.39a)
  payment_due_date date,
  payment_term_days int,

  netto_currency iso_currency,
  netto_amount numeric,
  vat_rate numeric default 0.23,
  vat_mode vat_mode default 'standard',
  vat_amount_pln numeric,                    -- VAT always in PLN per п.39b
  brutto_amount_pln numeric,
  nbp_rate_date date,
  nbp_pln_per_eur numeric(10,6),

  received_originals_date date,
  originals_or_scans doc_form default 'none',

  status text default 'issued',              -- 'issued','sent','paid','overdue'
  sent_at timestamptz,
  sent_via notification_channel,
  paid_at timestamptz,
  pdf_path text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on invoices_out (order_id);
create index on invoices_out (payment_due_date) where status != 'paid';
create index on invoices_out (status);
create trigger trg_invoices_out_updated before update on invoices_out for each row execute function set_updated_at();

alter table orders add constraint fk_orders_invoice_out
  foreign key (invoice_out_id) references invoices_out(id) on delete set null;

-- Inbound invoices (from carriers)
create table invoices_in (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  carrier_id uuid references carriers(id),

  invoice_number text not null,
  issued_date date,
  sale_date date,
  received_date date,                        -- received as scan/email
  received_originals_date date,              -- originals (п.35)
  originals_or_scans doc_form default 'none',

  netto_currency iso_currency,
  netto_amount numeric,
  vat_rate numeric,
  vat_mode vat_mode default 'standard',
  vat_amount_pln numeric,
  brutto_amount_pln numeric,
  nbp_rate_date date,
  nbp_pln_per_eur numeric(10,6),

  payment_due_date date,
  payment_term_days int,
  paid_date date,

  penalty_kind carrier_penalty_kind default 'none',  -- п.35 result
  penalty_value numeric,                             -- e.g. 20 (for 20%)
  is_whitelist_ok boolean,                           -- п.39e
  whitelist_checked_at timestamptz,
  whitelist_raw jsonb,

  status text default 'received',            -- 'received','approved','paid','disputed'
  pdf_path text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on invoices_in (order_id);
create index on invoices_in (carrier_id);
create index on invoices_in (payment_due_date) where status != 'paid';
create trigger trg_invoices_in_updated before update on invoices_in for each row execute function set_updated_at();

alter table orders add constraint fk_orders_invoice_in
  foreign key (invoice_in_id) references invoices_in(id) on delete set null;

-- MT940 imports
create table bank_statements (
  id uuid primary key default gen_random_uuid(),
  account_iban text,
  statement_date date,
  raw_file_path text,
  imported_at timestamptz default now(),
  imported_by uuid references managers(id)
);

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid references bank_statements(id) on delete cascade,
  value_date date,
  booking_date date,
  amount numeric not null,
  currency iso_currency not null,
  counterparty text,
  counterparty_iban text,
  description text,
  matched_invoice_out_id uuid references invoices_out(id) on delete set null,
  matched_invoice_in_id uuid references invoices_in(id) on delete set null,
  match_status text default 'unmatched',   -- 'unmatched','auto','manual','ignored'
  raw jsonb
);
create index on bank_transactions (value_date);
create index on bank_transactions (match_status);

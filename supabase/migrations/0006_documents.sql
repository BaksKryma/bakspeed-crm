-- 0006: Documents attached to orders

create table documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  kind document_kind not null,
  file_path text not null,                 -- storage path
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references managers(id),
  uploaded_at timestamptz default now(),
  meta jsonb default '{}'::jsonb
);
create index on documents (order_id);
create index on documents (kind);

-- Storage buckets (created via seed or CLI — here only table for metadata)

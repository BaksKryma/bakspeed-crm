-- 0016: Security hardening after Supabase advisor warnings
-- Pin search_path on all SECURITY INVOKER functions
alter function public.set_updated_at() set search_path = public;
alter function public.audit_trigger_fn() set search_path = public;
alter function public.orders_status_event() set search_path = public;
alter function public.orders_recalc_eur() set search_path = public;
alter function public.orders_assign_number() set search_path = public;
alter function public.next_order_number(date) set search_path = public;
alter function public.nbp_eur_pln_rate(date) set search_path = public;
alter function public.nbp_eur_pln_rate_row(date) set search_path = public;

-- Internal sequences table: no direct API access, only via SECURITY DEFINER
alter table public.order_number_sequences enable row level security;
revoke all on public.order_number_sequences from anon, authenticated;

-- Matviews: anon has no access; authenticated managers can read KPIs
revoke all on public.truck_month_stats   from anon;
revoke all on public.manager_month_stats from anon;
revoke all on public.client_month_stats  from anon;
revoke all on public.country_month_stats from anon;
revoke all on public.monthly_totals      from anon;
grant  select on public.truck_month_stats   to authenticated;
grant  select on public.manager_month_stats to authenticated;
grant  select on public.client_month_stats  to authenticated;
grant  select on public.country_month_stats to authenticated;
grant  select on public.monthly_totals      to authenticated;

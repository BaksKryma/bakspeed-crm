-- 0010: Materialized views — truck/month, manager/month, client/month, country/month

create materialized view truck_month_stats as
select
  t.id as truck_id,
  t.name as truck_name,
  t.carrier_id,
  date_trunc('month', o.loading_date)::date as month,
  count(*) as orders_count,
  coalesce(sum(o.all_km), 0) as total_km,
  coalesce(sum(o.freight_km), 0) as freight_km,
  coalesce(sum(o.empty_km), 0) as empty_km,
  coalesce(sum(o.de_km), 0) as de_km,
  coalesce(sum(o.at_km), 0) as at_km,
  coalesce(sum(o.nl_km), 0) as nl_km,
  coalesce(sum(o.pl_km), 0) as pl_km,
  coalesce(sum(o.europe_km), 0) as europe_km,
  coalesce(sum(o.turnover_netto_eur), 0) as turnover_eur,
  coalesce(sum(o.price_carrier_netto_eur), 0) as carrier_cost_eur,
  coalesce(sum(o.delta_netto_eur), 0) as delta_eur,
  case when coalesce(sum(o.all_km), 0) > 0
       then coalesce(sum(o.turnover_netto_eur), 0) / sum(o.all_km)
  end as eur_per_km
from orders o
join trucks t on t.id = o.truck_id
where o.status not in ('cancelled','draft') and o.loading_date is not null
group by t.id, t.name, t.carrier_id, date_trunc('month', o.loading_date);

create unique index on truck_month_stats (truck_id, month);
create index on truck_month_stats (month);

create materialized view manager_month_stats as
select
  m.id as manager_id,
  m.code as manager_code,
  date_trunc('month', o.loading_date)::date as month,
  count(*) as orders_count,
  coalesce(sum(o.turnover_netto_eur), 0) as turnover_eur,
  coalesce(sum(o.delta_netto_eur), 0) as delta_eur,
  case when coalesce(sum(o.turnover_netto_eur), 0) > 0
       then coalesce(sum(o.delta_netto_eur), 0) / sum(o.turnover_netto_eur)
  end as margin_ratio
from orders o
join managers m on m.id = o.manager_id
where o.status not in ('cancelled','draft') and o.loading_date is not null
group by m.id, m.code, date_trunc('month', o.loading_date);
create unique index on manager_month_stats (manager_id, month);

create materialized view client_month_stats as
select
  c.id as client_id,
  c.company_name,
  date_trunc('month', o.loading_date)::date as month,
  count(*) as orders_count,
  coalesce(sum(o.turnover_netto_eur), 0) as turnover_eur,
  coalesce(sum(o.delta_netto_eur), 0) as delta_eur
from orders o
join clients c on c.id = o.client_id
where o.status not in ('cancelled','draft') and o.loading_date is not null
group by c.id, c.company_name, date_trunc('month', o.loading_date);
create unique index on client_month_stats (client_id, month);

create materialized view country_month_stats as
select
  o.loading_country as country,
  date_trunc('month', o.loading_date)::date as month,
  count(*) as orders_count,
  coalesce(sum(o.turnover_netto_eur), 0) as turnover_eur
from orders o
where o.loading_country is not null and o.loading_date is not null
  and o.status not in ('cancelled','draft')
group by o.loading_country, date_trunc('month', o.loading_date);
create unique index on country_month_stats (country, month);

-- Monthly totals (replicates Report 2026 BAKSPEED sheet)
create materialized view monthly_totals as
select
  date_trunc('month', o.loading_date)::date as month,
  count(*) as orders_count,
  coalesce(sum(o.turnover_netto_eur), 0) as turnover_eur,
  coalesce(sum(o.delta_netto_eur), 0) as delta_eur,
  case when coalesce(sum(o.turnover_netto_eur), 0) > 0
       then coalesce(sum(o.delta_netto_eur), 0) / sum(o.turnover_netto_eur)
  end as delta_turnover_ratio
from orders o
where o.status not in ('cancelled','draft') and o.loading_date is not null
group by date_trunc('month', o.loading_date);
create unique index on monthly_totals (month);

-- Refresh job (nightly)
select cron.schedule(
  'refresh_stats_nightly',
  '0 2 * * *',
  $$ refresh materialized view concurrently truck_month_stats;
     refresh materialized view concurrently manager_month_stats;
     refresh materialized view concurrently client_month_stats;
     refresh materialized view concurrently country_month_stats;
     refresh materialized view concurrently monthly_totals; $$
);

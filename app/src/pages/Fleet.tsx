import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatEUR } from '@/lib/utils';

export default function Fleet() {
  const { data: trucks = [] } = useQuery({
    queryKey: ['fleet'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trucks')
        .select(`id, name, tractor_plate, trailer_plate, body_type, is_active, carrier:carriers(id, company_name, is_own_fleet)`)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
  });
  const { data: stats = [] } = useQuery({
    queryKey: ['fleet-stats'],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const { data } = await supabase.from('truck_month_stats').select('*').eq('month', month);
      return data ?? [];
    },
  });
  const statsByTruck = Object.fromEntries((stats as any[]).map((s) => [s.truck_id, s]));

  const own = (trucks as any[]).filter((t) => t.carrier?.is_own_fleet);
  const ext = (trucks as any[]).filter((t) => !t.carrier?.is_own_fleet);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Флот</h1>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Власний</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {own.map((t: any) => <TruckCard key={t.id} t={t} s={statsByTruck[t.id]} />)}
        </div>
      </section>
      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Залучений</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ext.map((t: any) => <TruckCard key={t.id} t={t} s={statsByTruck[t.id]} />)}
        </div>
      </section>
    </div>
  );
}

function TruckCard({ t, s }: { t: any; s: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Link to={`/fleet/${t.id}`} className="hover:underline">{t.name}</Link>
          {t.carrier?.is_own_fleet && <Badge>Own</Badge>}
          <Badge variant="outline">{t.body_type ?? '—'}</Badge>
        </CardTitle>
        <div className="text-xs text-muted-foreground">{t.tractor_plate} / {t.trailer_plate}</div>
        <div className="text-xs">{t.carrier?.company_name}</div>
      </CardHeader>
      <CardContent className="text-sm numeric space-y-1">
        <div className="flex justify-between"><span>Замовлень</span><span>{s?.orders_count ?? 0}</span></div>
        <div className="flex justify-between"><span>Всього км</span><span>{s?.total_km ?? 0}</span></div>
        <div className="flex justify-between"><span>Оборот</span><span>{formatEUR(Number(s?.turnover_eur ?? 0))}</span></div>
        <div className="flex justify-between"><span>Маржа</span><span>{formatEUR(Number(s?.delta_eur ?? 0))}</span></div>
        <div className="flex justify-between"><span>€/км</span><span>{s?.eur_per_km ? Number(s.eur_per_km).toFixed(2) : '—'}</span></div>
      </CardContent>
    </Card>
  );
}

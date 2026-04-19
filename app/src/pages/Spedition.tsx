import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function Spedition() {
  const { data: openOrders = [] } = useQuery({
    queryKey: ['spedition-open'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, our_order_number, loading_date, loading_place, unloading_place, weight_kg, client:clients(company_name)')
        .is('carrier_id', null)
        .not('status', 'in', '(cancelled,paid,delivered)')
        .order('loading_date', { ascending: true })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Спедиція</h1>
      <p className="text-sm text-muted-foreground">Замовлення без призначеного перевізника. Trans.eu/TIMOCOM інтеграція — v2.</p>

      <Card>
        <CardHeader><CardTitle>Відкриті замовлення ({openOrders.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr>
              <th className="text-left pb-2">№</th><th className="text-left">Клієнт</th><th className="text-left">Маршрут</th><th className="text-left">Дата</th><th className="text-left">Вага</th>
            </tr></thead>
            <tbody>
              {(openOrders as any[]).map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  <td className="py-2"><Link to={`/orders/${o.id}`} className="font-mono text-xs hover:underline">{o.our_order_number}</Link></td>
                  <td>{o.client?.company_name}</td>
                  <td>{o.loading_place} → {o.unloading_place}</td>
                  <td>{formatDate(o.loading_date)}</td>
                  <td>{o.weight_kg ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

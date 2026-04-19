import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEUR, formatKm } from '@/lib/utils';

export function RouteTab({ order }: { order: any; onSaved?: () => void }) {
  const { data: plan } = useQuery({
    queryKey: ['route-plan', order.id],
    queryFn: async () => {
      const { data } = await supabase.from('route_plans').select('*').eq('order_id', order.id).maybeSingle();
      return data;
    },
  });

  const countries: any[] = plan?.countries_breakdown ?? [];
  const totalLoaded = plan?.total_loaded_km ?? 0;
  const totalEmpty = plan?.total_empty_km ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Карта</CardTitle></CardHeader>
        <CardContent className="p-0 h-[420px]">
          {order.loading_lat && order.unloading_lat ? (
            <MapContainer
              center={[(Number(order.loading_lat) + Number(order.unloading_lat)) / 2, (Number(order.loading_lng) + Number(order.unloading_lng)) / 2]}
              zoom={5}
              style={{ height: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[Number(order.loading_lat), Number(order.loading_lng)]} />
              <Marker position={[Number(order.unloading_lat), Number(order.unloading_lng)]} />
              <Polyline
                positions={[[Number(order.loading_lat), Number(order.loading_lng)], [Number(order.unloading_lat), Number(order.unloading_lng)]]}
                pathOptions={{ color: '#F97316', weight: 3 }}
              />
            </MapContainer>
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              Координат немає. Натисніть «Маршрут Fleet Hand» нижче.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>km по країнах</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm numeric">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="text-left pb-1">Країна</th><th className="text-right">Loaded</th><th className="text-right">Empty</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {countries.map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{c.country}</td>
                  <td className="text-right">{c.loaded_km ?? 0}</td>
                  <td className="text-right">{c.empty_km ?? 0}</td>
                  <td className="text-right font-medium">{(c.loaded_km ?? 0) + (c.empty_km ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-2">Total</td>
                <td className="text-right">{totalLoaded}</td>
                <td className="text-right">{totalEmpty}</td>
                <td className="text-right">{totalLoaded + totalEmpty}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>Toll: {plan?.total_toll_eur ? formatEUR(plan.total_toll_eur) : '—'}</div>
            <div>Паливо: {plan?.total_fuel_liters ? `${plan.total_fuel_liters} л` : '—'}</div>
            <div>All km (order): {formatKm(order.all_km)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

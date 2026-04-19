import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LTooltip } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';

const pickIcon = L.divIcon({
  className: 'leaflet-dot-pick',
  html: '<div style="width:10px;height:10px;background:#F97316;border-radius:999px;border:2px solid white;"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});
const dropIcon = L.divIcon({
  className: 'leaflet-dot-drop',
  html: '<div style="width:10px;height:10px;background:#16A34A;border-radius:999px;border:2px solid white;"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

export function EuropeMap() {
  const { data: orders = [] } = useQuery({
    queryKey: ['map-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, our_order_number, status, loading_lat, loading_lng, unloading_lat, unloading_lng, loading_place, unloading_place')
        .in('status', ['planned', 'dispatched', 'auto_accepted', 'loading', 'in_transit', 'unloading'])
        .not('loading_lat', 'is', null)
        .not('unloading_lat', 'is', null);
      return data ?? [];
    },
  });

  return (
    <div className="h-80">
      <MapContainer center={[51.0, 14.0]} zoom={4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {orders.map((o) => (
          <Fragment key={o.id}>
            <Marker position={[Number(o.loading_lat), Number(o.loading_lng)]} icon={pickIcon}>
              <LTooltip>
                {o.our_order_number} · {o.status}
                <br />
                {o.loading_place} → {o.unloading_place}
              </LTooltip>
            </Marker>
            <Marker position={[Number(o.unloading_lat), Number(o.unloading_lng)]} icon={dropIcon} />
            <Polyline
              positions={[
                [Number(o.loading_lat), Number(o.loading_lng)],
                [Number(o.unloading_lat), Number(o.unloading_lng)],
              ]}
              pathOptions={{ color: '#F97316', weight: 2, opacity: 0.6 }}
            />
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

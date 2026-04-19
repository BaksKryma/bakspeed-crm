// Build route via Fleet Hand API. Falls back to OSRM + Nominatim if no credentials.
// Body: { order_id: uuid }

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const { order_id } = await req.json();
  if (!order_id) return jsonResponse({ error: 'order_id required' }, 400);

  const supabase = getServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*, truck:trucks(body_type, capacity_kg)')
    .eq('id', order_id)
    .single();
  if (!order) return jsonResponse({ error: 'not found' }, 404);

  const fhToken = Deno.env.get('FLEETHAND_TOKEN');
  let result: any;

  if (fhToken) {
    const res = await fetch('https://api.fleethand.com/routes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fhToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stops: [
          { address: order.loading_address, type: 'pickup',   date: order.loading_date },
          { address: order.unloading_address, type: 'delivery', date: order.unloading_date },
        ],
        truck_type: order.truck?.body_type,
        capacity_kg: order.truck?.capacity_kg,
        include_country_breakdown: true,
        include_map_image: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: `FleetHand ${res.status}: ${text}` }, 500);
    }
    result = await res.json();
  } else {
    // Fallback: Nominatim geocoding + OSRM routing
    const geo = async (q: string) => {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'bakspeed-crm/0.1' },
      });
      const arr = await r.json();
      return arr[0] ? { lat: Number(arr[0].lat), lng: Number(arr[0].lon) } : null;
    };
    const a = await geo(order.loading_address ?? order.loading_place ?? '');
    const b = await geo(order.unloading_address ?? order.unloading_place ?? '');
    if (!a || !b) return jsonResponse({ error: 'geocoding failed' }, 500);

    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`);
    const j = await r.json();
    const km = Math.round((j?.routes?.[0]?.distance ?? 0) / 1000);

    result = {
      route_id: null,
      loaded_km: km,
      empty_km: 0,
      countries: [],
      map_url: null,
      toll_eur: null,
      fuel_l: null,
      start_lat: a.lat, start_lng: a.lng,
      end_lat: b.lat, end_lng: b.lng,
    };
  }

  // Save route plan
  const { data: plan } = await supabase.from('route_plans').upsert({
    order_id,
    fleethand_route_id: result.route_id,
    map_image_path: null,
    countries_breakdown: result.countries ?? [],
    total_loaded_km: result.loaded_km,
    total_empty_km: result.empty_km,
    total_toll_eur: result.toll_eur,
    total_fuel_liters: result.fuel_l,
    start_lat: result.start_lat, start_lng: result.start_lng,
    end_lat: result.end_lat, end_lng: result.end_lng,
    status: 'ready',
  }, { onConflict: 'order_id' }).select('id').single();

  // Download map image if any
  if (result.map_url) {
    try {
      const mb = await (await fetch(result.map_url)).blob();
      const mapPath = `routes/${order.our_order_number}_map.png`;
      await supabase.storage.from('documents').upload(mapPath, mb, { contentType: 'image/png', upsert: true });
      await supabase.from('route_plans').update({ map_image_path: mapPath }).eq('id', plan!.id);
    } catch (_) { /* ignore */ }
  }

  // Update orders with km + coords
  const kmByCountry: Record<string, any> = {};
  for (const c of (result.countries ?? [])) {
    const key = `${String(c.country).toLowerCase()}_km`;
    kmByCountry[key] = (c.loaded_km ?? 0) + (c.empty_km ?? 0);
  }
  await supabase.from('orders').update({
    route_plan_id: plan?.id,
    loading_lat: result.start_lat, loading_lng: result.start_lng,
    unloading_lat: result.end_lat, unloading_lng: result.end_lng,
    empty_km: result.empty_km,
    freight_km: result.loaded_km,
    all_km: (result.loaded_km ?? 0) + (result.empty_km ?? 0),
    ...kmByCountry,
  }).eq('id', order_id);

  return jsonResponse({ ok: true, plan });
});

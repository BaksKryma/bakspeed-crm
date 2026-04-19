// Warunki п.13: термограф не надіслано 14 днів → 150 EUR + 10 EUR admin.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const DAY = 86400_000;

Deno.serve(async (_req) => {
  const supabase = getServiceClient();
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, our_order_number, unloading_date, carrier_id')
    .eq('temperature_required', true)
    .not('unloading_date', 'is', null);

  let proposed = 0;
  for (const o of (orders ?? [])) {
    if (today.getTime() < new Date(o.unloading_date!).getTime() + 14 * DAY) continue;

    const { data: doc } = await supabase
      .from('documents')
      .select('id')
      .eq('order_id', o.id)
      .eq('kind', 'thermograph_printout')
      .maybeSingle();
    if (doc) continue;

    const { data: already } = await supabase
      .from('applied_penalties')
      .select('id').eq('order_id', o.id).eq('warunki_point', 13).maybeSingle();
    if (already) continue;

    await supabase.from('applied_penalties').insert({
      order_id: o.id,
      warunki_point: 13,
      amount_eur: 160,  // 150 + 10 admin
      status: 'proposed',
      notes: 'Термограф не надіслано 14 днів (Warunki п.13): 150 EUR + 10 EUR admin',
    });
    proposed++;
  }
  return jsonResponse({ ok: true, proposed });
});

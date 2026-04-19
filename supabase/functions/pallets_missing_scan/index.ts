// Warunki п.32: palety не повернуто 21 день.
// EPAL 20 EUR / Düsseldorfer 15 EUR / H1 100 EUR / Gitterbox 100 EUR per pallet.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const DAY = 86400_000;
const PER_PALLET: Record<string, number> = { EPAL: 20, DUSSELDORFER: 15, H1: 100, GITTERBOX: 100, OTHER: 0 };

Deno.serve(async () => {
  const supabase = getServiceClient();
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, our_order_number, unloading_date, pallets_type, pallets_count, pallets_exchange_required')
    .eq('pallets_exchange_required', true)
    .not('unloading_date', 'is', null);

  let proposed = 0;
  for (const o of (orders ?? [])) {
    if (today.getTime() < new Date(o.unloading_date!).getTime() + 21 * DAY) continue;
    const { data: doc } = await supabase
      .from('documents').select('id').eq('order_id', o.id).eq('kind', 'pallet_receipt').maybeSingle();
    if (doc) continue;

    const { data: already } = await supabase
      .from('applied_penalties').select('id').eq('order_id', o.id).eq('warunki_point', 32).maybeSingle();
    if (already) continue;

    const pricePer = PER_PALLET[o.pallets_type ?? 'OTHER'] ?? 0;
    const amount = pricePer * (o.pallets_count ?? 0);
    await supabase.from('applied_penalties').insert({
      order_id: o.id, warunki_point: 32, amount_eur: amount, status: 'proposed',
      notes: `Паліти не обміняно 21 день: ${o.pallets_count} × ${o.pallets_type} × ${pricePer} EUR`,
    });
    proposed++;
  }
  return jsonResponse({ ok: true, proposed });
});

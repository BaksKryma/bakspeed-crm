// Warunki п.35: originals >14 days after unloading → propose term_extended OR pct_reduction.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const DAY = 86400_000;

Deno.serve(async (_req) => {
  const supabase = getServiceClient();
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, our_order_number, unloading_date, carrier_penalty_kind')
    .eq('carrier_penalty_kind', 'none')
    .not('unloading_date', 'is', null)
    .in('status', ['delivered', 'documents_received', 'invoiced']);

  let proposed = 0;
  for (const o of (orders ?? [])) {
    const due = new Date(o.unloading_date!).getTime() + 14 * DAY;
    if (today.getTime() < due) continue;

    const { data: invIn } = await supabase
      .from('invoices_in')
      .select('id, received_originals_date, issued_date')
      .eq('order_id', o.id)
      .maybeSingle();
    if (invIn?.received_originals_date) continue; // already received

    await supabase.from('applied_penalties').insert({
      order_id: o.id,
      warunki_point: 35,
      amount_eur: null,
      status: 'proposed',
      notes: 'Оригінали >14 днів після розвантаження. Варіанти: term_extended (+30 днів) АБО pct_reduction (−20% netto).',
      meta: { choices: ['term_extended', 'pct_reduction'] },
    });
    proposed++;
  }
  return jsonResponse({ ok: true, proposed });
});

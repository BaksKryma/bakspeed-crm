// Every 15 min. Retry pending route_plans (e.g., if Fleet Hand was down earlier).
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async () => {
  const supabase = getServiceClient();
  const { data: pending } = await supabase
    .from('route_plans')
    .select('id, order_id')
    .eq('status', 'pending')
    .limit(50);

  let tried = 0;
  for (const p of (pending ?? [])) {
    await supabase.functions.invoke('fleethand_build_route', { body: { order_id: p.order_id } });
    tried++;
  }
  return jsonResponse({ ok: true, tried });
});

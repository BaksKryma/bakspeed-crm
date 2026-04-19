// Hourly. Sync invoice_out.status from Saldeo.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async () => {
  const supabase = getServiceClient();
  const key = Deno.env.get('SALDEO_API_KEY');
  if (!key) return jsonResponse({ ok: true, skipped: 'no SALDEO_API_KEY' });

  const { data: invoices } = await supabase
    .from('invoices_out')
    .select('id, saldeo_invoice_id')
    .not('saldeo_invoice_id', 'is', null)
    .neq('status', 'paid')
    .limit(100);

  let updated = 0;
  for (const inv of (invoices ?? [])) {
    const r = await fetch(`https://api.saldeo.pl/api/v1/invoices/${inv.saldeo_invoice_id}`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!r.ok) continue;
    const data = await r.json();
    const status = data.paid ? 'paid' : data.sent ? 'sent' : 'issued';
    await supabase.from('invoices_out').update({
      status, saldeo_sync_status: 'synced', saldeo_synced_at: new Date().toISOString(),
      paid_at: data.paid_at ?? null,
    }).eq('id', inv.id);
    updated++;
  }
  return jsonResponse({ ok: true, updated });
});

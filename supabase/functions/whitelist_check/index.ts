// VAT Whitelist check (mf.gov.pl) — Warunki п.39e.
// Body: { nip: string, date?: string, carrier_id?: uuid }

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const body = await req.json();
  const nip = String(body.nip ?? '').replace(/\D/g, '');
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (nip.length !== 10) return jsonResponse({ error: 'invalid NIP' }, 400);

  const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
  const res = await fetch(url);
  if (!res.ok) return jsonResponse({ error: `MF API ${res.status}` }, 500);
  const data = await res.json();

  const subject = data?.result?.subject;
  const status = subject ? (subject.statusVat === 'Czynny' ? 'ok' : 'not_active') : 'not_found';

  if (body.carrier_id) {
    const supabase = getServiceClient();
    await supabase.from('carriers').update({
      whitelist_status: status,
      whitelist_last_check: new Date().toISOString(),
    }).eq('id', body.carrier_id);
  }
  return jsonResponse({ nip, date, status, raw: data });
});

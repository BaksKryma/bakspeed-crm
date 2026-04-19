// NBP daily sync — cron 12:15
// Fetches current EUR/PLN rate (table A) and stores in currency_rates.
// Also supports backfill: POST { from: "2025-07-01", to: "2026-04-20" }
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface NbpRate {
  no: string;
  effectiveDate: string;
  mid: number;
}

interface NbpResponse {
  table: string;
  currency: string;
  code: string;
  rates: NbpRate[];
}

async function fetchRange(from: string, to: string): Promise<NbpRate[]> {
  const url = `https://api.nbp.pl/api/exchangerates/rates/A/EUR/${from}/${to}/?format=json`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`NBP ${res.status}`);
  const body = await res.json() as NbpResponse;
  return body.rates;
}

async function fetchLatest(): Promise<NbpRate[]> {
  const res = await fetch('https://api.nbp.pl/api/exchangerates/rates/A/EUR/?format=json');
  if (!res.ok) throw new Error(`NBP ${res.status}`);
  const body = await res.json() as NbpResponse;
  return body.rates;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const supabase = getServiceClient();

  let rates: NbpRate[] = [];
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.from && body.to) rates = await fetchRange(body.from, body.to);
      else rates = await fetchLatest();
    } else {
      rates = await fetchLatest();
    }
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }

  const rows = rates.map((r) => ({
    rate_date: r.effectiveDate,
    currency: 'EUR',
    base_currency: 'PLN',
    rate: r.mid,
    source: 'NBP',
    table_type: 'A',
    table_no: r.no,
    effective_date: r.effectiveDate,
  }));

  if (rows.length) {
    const { error } = await supabase.from('currency_rates').upsert(rows, {
      onConflict: 'rate_date,currency,base_currency,source',
    });
    if (error) return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true, inserted: rows.length, rates: rows });
});

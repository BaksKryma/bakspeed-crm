// Backfill NBP rates over a date range (max 93 days per request).
// Usage: SUPABASE_URL=... ... FROM=2025-07-01 TO=2026-04-20 tsx backfill_nbp.ts
import { supabase } from './lib.ts';

const FROM = process.env.FROM ?? '2025-07-01';
const TO = process.env.TO ?? new Date().toISOString().slice(0, 10);

function addDays(d: string, n: number): string {
  const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10);
}

async function main() {
  let cursor = FROM;
  let total = 0;
  while (cursor <= TO) {
    const end = addDays(cursor, 90);
    const stop = end > TO ? TO : end;
    const url = `https://api.nbp.pl/api/exchangerates/rates/A/EUR/${cursor}/${stop}/?format=json`;
    const r = await fetch(url);
    if (r.ok) {
      const body = await r.json() as { rates: Array<{ effectiveDate: string; mid: number; no: string }> };
      const rows = body.rates.map((x) => ({
        rate_date: x.effectiveDate,
        currency: 'EUR', base_currency: 'PLN',
        rate: x.mid, source: 'NBP', table_type: 'A', table_no: x.no,
      }));
      if (rows.length) {
        const { error } = await supabase.from('currency_rates').upsert(rows, {
          onConflict: 'rate_date,currency,base_currency,source',
        });
        if (error) console.error(error);
        else total += rows.length;
      }
      console.log(`${cursor}..${stop}: ${rows.length} rates`);
    } else {
      console.warn(`${cursor}..${stop}: ${r.status}`);
    }
    cursor = addDays(stop, 1);
  }
  console.log('total upserted:', total);
}
void main();

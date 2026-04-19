// Import BKTRANS-style per-truck Excel → merge km data + country breakdown into orders.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FILE=... tsx import_bktrans.ts
// Each sheet = one month (MMYYYY); each file = one truck.
import ExcelJS from 'exceljs';
import { supabase, parseDate, parseNum } from './lib.ts';

const FILE = process.env.FILE ?? '/Users/kryma/Downloads/BK-TRANS Tomasz Barczak .xlsx';
const TRUCK_CODE = process.env.TRUCK_CODE ?? 'BKT';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  let updated = 0, missing = 0;
  for (const ws of wb.worksheets) {
    // Data rows start at row 6 (R2=summary headers, R3=summary, R5=detail headers, R6+=data)
    for (let r = 6; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ourNum = (row.getCell(5).value as string | null)?.toString().trim();
      if (!ourNum) continue;

      const paid_km = parseNum(row.getCell(7).value);
      const europe_km = parseNum(row.getCell(8).value);
      const eu_price = parseNum(row.getCell(9).value);
      const de_km = parseNum(row.getCell(10).value);
      const de_price = parseNum(row.getCell(11).value);
      const at_km = parseNum(row.getCell(12).value);
      const at_price = parseNum(row.getCell(13).value);
      const empty_km = parseNum(row.getCell(15).value);
      const freight_km = parseNum(row.getCell(16).value);
      const all_km = parseNum(row.getCell(17).value);

      const { data: order } = await supabase.from('orders').select('id').eq('our_order_number', ourNum).maybeSingle();
      if (!order) { missing++; continue; }

      await supabase.from('orders').update({
        paid_km, europe_km, de_km, at_km,
        empty_km, freight_km, all_km,
      }).eq('id', order.id);

      // Country costs
      const rows: any[] = [];
      if (europe_km || eu_price) rows.push({ country: 'EU', loaded_km: europe_km, rate_per_km_eur: europe_km ? (eu_price ?? 0) / europe_km : null, amount_eur: eu_price });
      if (de_km || de_price) rows.push({ country: 'DE', loaded_km: de_km, rate_per_km_eur: de_km ? (de_price ?? 0) / de_km : null, amount_eur: de_price });
      if (at_km || at_price) rows.push({ country: 'AT', loaded_km: at_km, rate_per_km_eur: at_km ? (at_price ?? 0) / at_km : null, amount_eur: at_price });
      for (const cc of rows) {
        await supabase.from('order_country_costs').upsert({ order_id: order.id, ...cc }, { onConflict: 'order_id,country' });
      }
      updated++;
    }
  }
  console.log({ updated, missing, truck: TRUCK_CODE });
}
void main();

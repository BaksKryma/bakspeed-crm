// Import LOADS-INFO Excel → orders + clients/carriers/trucks/managers.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FILE=... tsx import_loadsinfo.ts
import ExcelJS from 'exceljs';
import { supabase, normName, parseDate, parseNum, parseBool } from './lib.ts';

const FILE = process.env.FILE ?? '/Users/kryma/Downloads/2026 LOADS-INFO Bakspeed Sp. z o.o. .xlsx';
const SHEETS = ['Styczeń ', 'Luty', 'Marzec', 'Kwiecień'];

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  // Preload reference dicts
  const [{ data: clients }, { data: carriers }, { data: trucks }, { data: managers }] = await Promise.all([
    supabase.from('clients').select('id, company_name'),
    supabase.from('carriers').select('id, company_name'),
    supabase.from('trucks').select('id, name'),
    supabase.from('managers').select('id, code'),
  ]);
  const clientMap = new Map((clients ?? []).map(c => [normName(c.company_name), c.id]));
  const carrierMap = new Map((carriers ?? []).map(c => [normName(c.company_name), c.id]));
  const truckMap = new Map((trucks ?? []).map(t => [t.name.trim(), t.id]));
  const managerMap = new Map((managers ?? []).map(m => [m.code, m.id]));

  async function findOrCreateClient(name: string | null): Promise<string | null> {
    if (!name) return null;
    const key = normName(name);
    if (clientMap.has(key)) return clientMap.get(key)!;
    const { data } = await supabase.from('clients').insert({ company_name: name }).select('id').single();
    if (data) clientMap.set(key, data.id);
    return data?.id ?? null;
  }

  async function findOrCreateCarrier(name: string | null): Promise<string | null> {
    if (!name) return null;
    const key = normName(name);
    if (carrierMap.has(key)) return carrierMap.get(key)!;
    const { data } = await supabase.from('carriers').insert({ company_name: name }).select('id').single();
    if (data) carrierMap.set(key, data.id);
    return data?.id ?? null;
  }

  let imported = 0, skipped = 0;

  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.warn('Sheet missing:', sheetName); continue; }
    // Headers at row 4; data starts row 5
    for (let r = 5; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ourNum = row.getCell(3).value as string | null;
      if (!ourNum || String(ourNum).length < 8) continue;

      const clientName = (row.getCell(4).value as string | null) ?? null;
      const carrierName = (row.getCell(13).value as string | null) ?? null;
      const managerCode = (row.getCell(6).value as string | null)?.toString().trim() ?? null;
      const truckName = (row.getCell(12).value as string | null)?.toString().trim() ?? null;

      const clientId = await findOrCreateClient(clientName);
      const carrierId = await findOrCreateCarrier(carrierName);
      const truckId = truckName ? truckMap.get(truckName) ?? null : null;
      const managerId = managerCode ? managerMap.get(managerCode) ?? null : null;

      // Guess currency from client_order_number prefix or carrier-side PL → fallback EUR
      const priceCarrier = parseNum(row.getCell(15).value);
      const turnover = parseNum(row.getCell(18).value);
      const vatCarrier = parseNum(row.getCell(16).value);
      const vatClient = parseNum(row.getCell(19).value);

      // heuristic: if VAT is 0 → likely EUR export; if VAT/netto ≈ 0.23 → standard
      const vatCarrierRate = priceCarrier && vatCarrier != null && priceCarrier > 0
        ? Math.round((vatCarrier / priceCarrier) * 100) / 100 : 0.23;
      const vatClientRate = turnover && vatClient != null && turnover > 0
        ? Math.round((vatClient / turnover) * 100) / 100 : 0.23;

      const payload: any = {
        our_order_number: String(ourNum).trim(),
        client_order_number: (row.getCell(2).value as string | null)?.toString() ?? null,
        client_id: clientId,
        manager_id: managerId,
        carrier_id: carrierId,
        truck_id: truckId,
        loading_place: (row.getCell(7).value as string | null)?.toString() ?? null,
        unloading_place: (row.getCell(8).value as string | null)?.toString() ?? null,
        loading_date: parseDate(row.getCell(9).value),
        unloading_date: parseDate(row.getCell(10).value),
        adr: parseBool(row.getCell(11).value),
        price_carrier_netto_original: priceCarrier,
        vat_carrier_rate: vatCarrierRate,
        turnover_netto_original: turnover,
        vat_client_rate: vatClientRate,
        payment_term_client_days: parseNum(row.getCell(26).value),
        payment_due_date_client: parseDate(row.getCell(27).value),
        payment_received_client: parseBool(row.getCell(28).value),
        dispatch_date_to_carrier: parseDate(row.getCell(29).value)
          ? `${parseDate(row.getCell(29).value)}T00:00:00Z` : null,
        payment_term_carrier_days: parseNum(row.getCell(34).value) ?? 60,
        payment_to_carrier_date: parseDate(row.getCell(35).value),
        paid_to_carrier: parseBool(row.getCell(36).value),
        // Heuristic: default EUR. If turnover looks like 4-5 digits and VAT 23% → could be PLN; keep EUR for v1.
        client_currency: 'EUR',
        carrier_currency: 'EUR',
        status: parseBool(row.getCell(36).value) ? 'paid' : 'delivered',
      };

      const { error } = await supabase.from('orders').upsert(payload, { onConflict: 'our_order_number' });
      if (error) {
        console.warn('Row', r, 'error:', error.message);
        skipped++;
      } else imported++;
    }
  }
  console.log({ imported, skipped });
}
void main();

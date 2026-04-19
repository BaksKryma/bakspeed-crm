// Create outbound invoice via Saldeo API (or local-only if SALDEO_API_KEY not set).
// Always bilingual (EUR+PLN), VAT in PLN at NBP rate from unloading_date - 1. (Warunki п.39)

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const { order_id } = await req.json();
  if (!order_id) return jsonResponse({ error: 'order_id required' }, 400);

  const supabase = getServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*, client:clients(*)')
    .eq('id', order_id)
    .single();
  if (!order) return jsonResponse({ error: 'not found' }, 404);
  if (order.status === 'draft') return jsonResponse({ error: 'order is draft' }, 400);
  if (!order.unloading_date) return jsonResponse({ error: 'no unloading date' }, 400);

  // NBP rate for the day before unloading_date
  const rateDate = new Date(new Date(order.unloading_date).getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: rate } = await supabase.rpc('nbp_eur_pln_rate_row', { p_date: rateDate });
  if (!rate || !rate[0]) return jsonResponse({ error: 'no NBP rate available' }, 500);

  const nbpRate = Number(rate[0].rate);
  const netto = Number(order.turnover_netto_original ?? 0);
  const vatRate = Number(order.vat_client_rate ?? 0.23);

  // VAT always in PLN (п.39b)
  let vatPln: number;
  if (order.client_currency === 'PLN') {
    vatPln = Math.round(netto * vatRate * 100) / 100;
  } else {
    vatPln = Math.round(netto * nbpRate * vatRate * 100) / 100;
  }
  const bruttoPln = order.client_currency === 'PLN'
    ? Math.round(netto * (1 + vatRate) * 100) / 100
    : Math.round((netto * nbpRate * (1 + vatRate)) * 100) / 100;

  const saldeoKey = Deno.env.get('SALDEO_API_KEY');
  let invoiceNumber: string;
  let saldeoInvoiceId: string | null = null;
  let pdfPath: string | null = null;
  let syncStatus = 'pending';

  if (saldeoKey) {
    // Call Saldeo API (placeholder — adapt to actual API schema)
    const res = await fetch('https://api.saldeo.pl/api/v1/invoices', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${saldeoKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractor: {
          name: order.client?.company_name,
          nip: order.client?.nip,
          address: order.client?.address,
        },
        items: [{
          name: `Transport ${order.loading_place} → ${order.unloading_place} (№${order.our_order_number})`,
          quantity: 1,
          netto: netto,
          currency: order.client_currency,
          vat_rate: vatRate,
        }],
        sale_date: order.unloading_date,
        payment_due_date: order.payment_due_date_client,
        nbp_rate: nbpRate,
        nbp_rate_date: rateDate,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: `Saldeo ${res.status}: ${text}` }, 500);
    }
    const data = await res.json();
    invoiceNumber = data.invoice_number;
    saldeoInvoiceId = data.id;
    if (data.pdf_url) {
      try {
        const blob = await (await fetch(data.pdf_url)).blob();
        pdfPath = `invoices-out/${invoiceNumber}.pdf`;
        await supabase.storage.from('documents').upload(pdfPath, blob, {
          contentType: 'application/pdf', upsert: true,
        });
      } catch (_) {/* ignore */}
    }
    syncStatus = 'synced';
  } else {
    // Local-only fallback numbering
    const d = new Date(order.unloading_date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    const { data: last } = await supabase
      .from('invoices_out')
      .select('invoice_number')
      .like('invoice_number', `${y}/${m}/%`)
      .order('created_at', { ascending: false })
      .limit(1);
    const nextSeq = last?.[0]?.invoice_number
      ? Number(String(last[0].invoice_number).split('/').pop()) + 1 : 1;
    invoiceNumber = `${y}/${m}/${String(nextSeq).padStart(4, '0')}`;
  }

  const { data: inv, error } = await supabase.from('invoices_out').insert({
    order_id,
    invoice_number: invoiceNumber,
    saldeo_invoice_id: saldeoInvoiceId,
    saldeo_sync_status: syncStatus,
    saldeo_synced_at: saldeoInvoiceId ? new Date().toISOString() : null,
    issued_date: new Date().toISOString().slice(0, 10),
    sale_date: order.unloading_date,
    payment_due_date: order.payment_due_date_client,
    payment_term_days: order.payment_term_client_days,
    netto_currency: order.client_currency,
    netto_amount: netto,
    vat_rate: vatRate,
    vat_mode: order.vat_client_mode,
    vat_amount_pln: vatPln,
    brutto_amount_pln: bruttoPln,
    nbp_rate_date: rateDate,
    nbp_pln_per_eur: nbpRate,
    pdf_path: pdfPath,
    status: 'issued',
  }).select('*').single();

  if (error) return jsonResponse({ error: error.message }, 500);

  await supabase.from('orders').update({ invoice_out_id: inv.id, status: 'invoiced' }).eq('id', order_id);

  await supabase.from('notifications').insert([
    { order_id, channel: 'telegram', template_code: 'invoice_created_owner',
      body: `Фактура ${invoiceNumber} створена для ${order.client?.company_name}, ${netto} ${order.client_currency} (VAT ${vatPln} PLN).` },
  ]);

  return jsonResponse({ ok: true, invoice: inv });
});

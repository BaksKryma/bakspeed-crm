// Generate carrier order PDF (TIMOCOM-style) using pdf-lib, attach Warunki, email carrier.
// Body: { order_id: uuid, send?: boolean }

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { BAKSPEED, letterheadFooter } from '../_shared/letterhead.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const A4 = { w: 595.28, h: 841.89 };
const ORANGE = rgb(0.976, 0.451, 0.086);
const DARK = rgb(0.06, 0.09, 0.16);

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);
  const { order_id, send } = await req.json();
  if (!order_id) return jsonResponse({ error: 'order_id required' }, 400);

  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select(`*,
      client:clients(*),
      carrier:carriers(*),
      truck:trucks(*),
      driver:drivers(*),
      manager:managers(*)`)
    .eq('id', order_id)
    .single();

  if (!order) return jsonResponse({ error: 'order not found' }, 404);

  // Validate OCP (Warunki п.30)
  if (order.carrier && !order.carrier.is_own_fleet) {
    const expiry = order.carrier.ocp_insurance_expiry ? new Date(order.carrier.ocp_insurance_expiry) : null;
    if (!expiry || expiry < new Date()) {
      return jsonResponse({ error: 'OCP insurance expired or missing (Warunki п.30)' }, 400);
    }
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([A4.w, A4.h]);

  let y = A4.h - 40;

  // Header
  page.drawText('BAKSPEED', { x: 40, y, size: 24, font: bold, color: ORANGE });
  page.drawText('Sp. z o.o.', { x: 140, y: y + 4, size: 10, font });
  y -= 8;
  page.drawText(BAKSPEED.slogan, { x: 40, y, size: 8, font, color: DARK });

  page.drawText(`ORDER: ${order.our_order_number}`, { x: A4.w - 200, y: A4.h - 40, size: 12, font: bold });
  page.drawText(`Date: ${new Date().toISOString().slice(0, 10)}`, { x: A4.w - 200, y: A4.h - 55, size: 9, font });
  page.drawText(`TIMOCOM ID: ${BAKSPEED.timocomId}`, { x: A4.w - 200, y: A4.h - 68, size: 9, font });

  y -= 30;
  line(page, y); y -= 15;

  // Service provider
  section(page, bold, 'Service provider (Carrier)', y); y -= 14;
  kv(page, font, 'Company', order.carrier?.company_name ?? '—', y); y -= 12;
  kv(page, font, 'NIP',     order.carrier?.nip ?? '—', y); y -= 12;
  kv(page, font, 'Address', order.carrier?.address ?? '—', y); y -= 12;
  kv(page, font, 'Contact', `${order.carrier?.contact_person ?? '—'} · ${order.carrier?.phone ?? ''} · ${order.carrier?.email ?? ''}`, y); y -= 14;

  // Loading
  section(page, bold, 'Loading', y); y -= 14;
  kv(page, font, 'Place',    `${order.loading_place ?? ''} · ${order.loading_address ?? ''}`, y); y -= 12;
  kv(page, font, 'Date',     `${order.loading_date ?? ''} ${order.loading_time_from ?? ''}–${order.loading_time_to ?? ''}`, y); y -= 12;
  kv(page, font, 'Reference', order.loading_reference ?? '—', y); y -= 12;
  kv(page, font, 'Notes',    order.loading_notes ?? '—', y); y -= 14;

  // Unloading
  section(page, bold, 'Unloading', y); y -= 14;
  kv(page, font, 'Place',    `${order.unloading_place ?? ''} · ${order.unloading_address ?? ''}`, y); y -= 12;
  kv(page, font, 'Date',     `${order.unloading_date ?? ''} ${order.unloading_time_from ?? ''}–${order.unloading_time_to ?? ''}`, y); y -= 12;
  kv(page, font, 'Reference', order.unloading_reference ?? '—', y); y -= 12;
  kv(page, font, 'Notes',    order.unloading_notes ?? '—', y); y -= 14;

  // Freight description
  section(page, bold, 'Freight description', y); y -= 14;
  kv(page, font, 'Type of goods', order.goods_type ?? '—', y); y -= 12;
  kv(page, font, 'Weight / LDM / Volume', `${order.weight_kg ?? '—'} kg · ${order.loading_meters ?? '—'} LDM · ${order.volume_m3 ?? '—'} m³`, y); y -= 12;
  kv(page, font, 'Pallets',  `${order.pallets_count ?? '—'} × ${order.pallets_type ?? ''} ${order.pallets_exchange_required ? '(exchange)' : ''}`, y); y -= 12;
  kv(page, font, 'ADR',      order.adr ? `YES · ${order.adr_class ?? ''} UN ${order.un_number ?? ''}` : 'NO', y); y -= 12;
  kv(page, font, 'Stackable / Temperature', `${order.stackable ? 'YES' : 'NO'} · ${order.temperature_required ? `${order.temperature_min}…${order.temperature_max}°C` : 'none'}`, y); y -= 14;

  // Vehicle / driver
  section(page, bold, 'Vehicle', y); y -= 14;
  kv(page, font, 'Type',     `${order.vehicle_type ?? 'Articulated truck'} · ${order.body_type ?? order.truck?.body_type ?? ''}`, y); y -= 12;
  kv(page, font, 'Truck',    `${order.truck?.name ?? '—'} · ${order.truck?.tractor_plate ?? ''} / ${order.truck?.trailer_plate ?? ''}`, y); y -= 12;
  kv(page, font, 'Driver',   `${order.driver?.full_name ?? '—'} · ${order.driver?.phone ?? ''}`, y); y -= 14;

  // Payment
  section(page, bold, 'Payment', y); y -= 14;
  const price = Number(order.price_carrier_netto_original ?? 0).toFixed(2);
  kv(page, font, 'Freight charge (netto)', `${price} ${order.carrier_currency}`, y); y -= 12;
  kv(page, font, 'Payment term', `${order.payment_term_carrier_days ?? 60} days (Warunki p.38)`, y); y -= 12;
  kv(page, font, 'Remittance',
    `EUR: ${BAKSPEED.ibanEur} · PLN: ${BAKSPEED.ibanPln} · BIC ${BAKSPEED.bic}`, y); y -= 14;

  // Agreements
  section(page, bold, 'Additional terms', y); y -= 14;
  wrap(page, font, 'This order is subject to "Warunki realizacji zlecenia transportowego BAKSPEED Sp. z o.o." (attached). 30-min no-reply = auto-accept (p.9).', 40, y, A4.w - 80, 9); y -= 40;

  // Attachments
  section(page, bold, 'Attachments', y); y -= 14;
  page.drawText('• Warunki realizacji zlecenia transportowego BAKSPEED Sp. z o.o..pdf', { x: 40, y, size: 9, font });
  y -= 30;

  // Footer
  const footer = letterheadFooter();
  const fl = footer.split('\n');
  let fy = 60;
  for (const l of fl) {
    page.drawText(l, { x: 40, y: fy, size: 7.5, font, color: DARK });
    fy -= 10;
  }
  page.drawLine({ start: { x: 40, y: 100 }, end: { x: A4.w - 40, y: 100 }, thickness: 0.5, color: ORANGE });

  // Try to append Warunki attachment (from storage bucket 'static')
  try {
    const { data: warunki } = await supabase.storage.from('static').download('warunki.pdf');
    if (warunki) {
      const wBytes = new Uint8Array(await warunki.arrayBuffer());
      const wDoc = await PDFDocument.load(wBytes);
      const copied = await pdfDoc.copyPages(wDoc, wDoc.getPageIndices());
      copied.forEach((p) => pdfDoc.addPage(p));
    }
  } catch (_) { /* optional */ }

  const pdfBytes = await pdfDoc.save();
  const storagePath = `carrier-pdf/${order.our_order_number}.pdf`;
  await supabase.storage.from('documents').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf', upsert: true,
  });

  const { data: docRow } = await supabase.from('documents').insert({
    order_id,
    kind: 'carrier_order_pdf',
    file_path: storagePath,
    file_name: `${order.our_order_number}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: pdfBytes.length,
  }).select('id').single();

  // Mark dispatched + schedule auto-accept (30 min, Warunki п.9)
  const now = new Date().toISOString();
  await supabase.from('orders').update({
    status: 'dispatched',
    dispatch_date_to_carrier: now,
  }).eq('id', order_id);

  const at = new Date(Date.now() + 30 * 60_000).toISOString();
  await supabase.from('scheduled_reminders').insert({
    order_id, reminder_type: 'auto_accept', scheduled_for: at,
  });

  // Notify owner
  await supabase.from('notifications').insert({
    order_id,
    channel: 'telegram',
    template_code: 'order_dispatched_owner',
    body: `Замовлення ${order.our_order_number} відправлено перевізнику ${order.carrier?.company_name}.`,
  });

  // Email carrier if send=true
  if (send && order.carrier?.email) {
    await supabase.from('notifications').insert({
      order_id,
      recipient_carrier_id: order.carrier.id,
      recipient_raw_email: order.carrier.email,
      channel: 'email',
      template_code: 'carrier_order_email',
      subject: `Zlecenie transportowe ${order.our_order_number} — Bakspeed`,
      body: `W załączeniu zlecenie ${order.our_order_number} oraz Warunki.`,
      payload: { attachments: [storagePath] },
    });
  }

  return jsonResponse({ ok: true, document_id: docRow?.id, pdf_path: storagePath });
});

function section(p: any, f: any, text: string, y: number) {
  p.drawRectangle({ x: 40, y: y - 2, width: A4.w - 80, height: 14, color: ORANGE, opacity: 0.08 });
  p.drawText(text, { x: 44, y: y + 2, size: 10, font: f, color: ORANGE });
}
function kv(p: any, f: any, k: string, v: string, y: number) {
  p.drawText(k, { x: 44, y, size: 8.5, font: f, color: DARK });
  p.drawText(v.substring(0, 120), { x: 180, y, size: 9, font: f });
}
function line(p: any, y: number) {
  p.drawLine({ start: { x: 40, y }, end: { x: A4.w - 40, y }, thickness: 0.5, color: ORANGE });
}
function wrap(p: any, f: any, text: string, x: number, y: number, maxW: number, size: number) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = f.widthOfTextAtSize(test, size);
    if (width > maxW) {
      p.drawText(line, { x, y: cy, size, font: f });
      line = w; cy -= size + 2;
    } else line = test;
  }
  if (line) p.drawText(line, { x, y: cy, size, font: f });
}

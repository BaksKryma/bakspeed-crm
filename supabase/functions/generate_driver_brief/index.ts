// Generate driver brief PDF (3 pages: Task + Route + Instructions).
// Body: { order_id: uuid }

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { BAKSPEED, letterheadFooter } from '../_shared/letterhead.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const A4 = { w: 595.28, h: 841.89 };
const ORANGE = rgb(0.976, 0.451, 0.086);

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);
  const { order_id } = await req.json();
  if (!order_id) return jsonResponse({ error: 'order_id required' }, 400);

  const supabase = getServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select(`*, client:clients(*), manager:managers(*), truck:trucks(*), driver:drivers(*)`)
    .eq('id', order_id)
    .single();
  if (!order) return jsonResponse({ error: 'not found' }, 404);

  const { data: plan } = await supabase.from('route_plans').select('*').eq('order_id', order_id).maybeSingle();

  // If no route plan yet — trigger Fleet Hand first (or fallback to no map).
  if (!plan) {
    await supabase.functions.invoke('fleethand_build_route', { body: { order_id } }).catch(() => { /* non-blocking */ });
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ========= PAGE 1: Task =========
  const p1 = pdfDoc.addPage([A4.w, A4.h]);
  header(p1, bold, font, 'ЗАВДАННЯ ВОДІЮ', order.our_order_number);
  let y = A4.h - 110;

  box(p1, bold, 'ЗАВАНТАЖЕННЯ', y); y -= 18;
  txt(p1, font, `Адреса: ${order.loading_address ?? order.loading_place ?? '—'}`, y); y -= 12;
  txt(p1, font, `Координати: ${order.loading_lat ?? '—'}, ${order.loading_lng ?? '—'}`, y); y -= 12;
  txt(p1, font, `Дата: ${order.loading_date ?? ''}  Час: ${order.loading_time_from ?? ''}–${order.loading_time_to ?? ''}`, y); y -= 12;
  txt(p1, font, `Reference: ${order.loading_reference ?? '—'}`, y); y -= 12;
  txt(p1, font, `Контакт: ${order.loading_contact_name ?? '—'} · ${order.loading_contact_phone ?? ''}`, y); y -= 12;
  txt(p1, font, `Нотатки: ${order.loading_notes ?? '—'}`, y); y -= 20;

  box(p1, bold, 'РОЗВАНТАЖЕННЯ', y); y -= 18;
  txt(p1, font, `Адреса: ${order.unloading_address ?? order.unloading_place ?? '—'}`, y); y -= 12;
  txt(p1, font, `Координати: ${order.unloading_lat ?? '—'}, ${order.unloading_lng ?? '—'}`, y); y -= 12;
  txt(p1, font, `Дата: ${order.unloading_date ?? ''}  Час: ${order.unloading_time_from ?? ''}–${order.unloading_time_to ?? ''}`, y); y -= 12;
  txt(p1, font, `Reference: ${order.unloading_reference ?? '—'}`, y); y -= 12;
  txt(p1, font, `Контакт: ${order.unloading_contact_name ?? '—'} · ${order.unloading_contact_phone ?? ''}`, y); y -= 20;

  box(p1, bold, 'ВАНТАЖ', y); y -= 18;
  txt(p1, font, `Тип: ${order.goods_type ?? '—'} · Вага: ${order.weight_kg ?? '—'} кг · LDM: ${order.loading_meters ?? '—'}`, y); y -= 12;
  txt(p1, font, `Палети: ${order.pallets_count ?? '—'} × ${order.pallets_type ?? ''}${order.pallets_exchange_required ? ' (обмін)' : ''}`, y); y -= 12;
  if (order.adr) txt(p1, font, `ADR: клас ${order.adr_class ?? '—'}, UN ${order.un_number ?? '—'}`, y, ORANGE);
  if (order.adr) y -= 12;
  if (order.temperature_required) txt(p1, font, `Температурний режим: ${order.temperature_min}–${order.temperature_max}°C`, y, ORANGE);
  if (order.temperature_required) y -= 12;
  y -= 12;

  box(p1, bold, 'КОНТАКТИ', y); y -= 18;
  txt(p1, font, `Диспетчер: ${order.manager?.full_name ?? ''} · ${order.manager?.phone ?? ''} · ${order.manager?.telegram_chat_id ?? ''}`, y); y -= 12;
  txt(p1, font, `Клієнт: ${order.client?.company_name ?? '—'}`, y); y -= 20;

  footer(p1, font);

  // ========= PAGE 2: Route =========
  const p2 = pdfDoc.addPage([A4.w, A4.h]);
  header(p2, bold, font, 'МАРШРУТ', order.our_order_number);

  y = A4.h - 110;
  // Try embed map screenshot
  if (plan?.map_image_path) {
    try {
      const { data: mapBlob } = await supabase.storage.from('documents').download(plan.map_image_path);
      if (mapBlob) {
        const bytes = new Uint8Array(await mapBlob.arrayBuffer());
        let img: any;
        if (plan.map_image_path.endsWith('.png')) img = await pdfDoc.embedPng(bytes);
        else img = await pdfDoc.embedJpg(bytes);
        const dims = img.scaleToFit(A4.w - 80, 360);
        p2.drawImage(img, { x: 40, y: y - 360, width: dims.width, height: dims.height });
        y -= 370;
      }
    } catch (_) { /* ignore */ }
  } else {
    p2.drawText('Карта маршруту недоступна — перевірте Fleet Hand.', { x: 40, y, size: 10, font });
    y -= 20;
  }

  box(p2, bold, 'КІЛОМЕТРАЖ ПО КРАЇНАХ', y); y -= 18;
  const countries = (plan?.countries_breakdown as any[]) ?? [];
  header2(p2, bold, y, ['Країна', 'Loaded', 'Empty', 'Total']);
  y -= 14;
  let totL = 0, totE = 0;
  for (const c of countries) {
    totL += c.loaded_km ?? 0; totE += c.empty_km ?? 0;
    row(p2, font, y, [c.country, String(c.loaded_km ?? 0), String(c.empty_km ?? 0), String((c.loaded_km ?? 0) + (c.empty_km ?? 0))]);
    y -= 12;
  }
  row(p2, bold, y, ['TOTAL', String(totL), String(totE), String(totL + totE)]);
  y -= 18;
  txt(p2, font, `Очікуваний toll: ${plan?.total_toll_eur ?? '—'} EUR`, y); y -= 12;
  txt(p2, font, `Очікуване паливо: ${plan?.total_fuel_liters ?? '—'} л`, y);

  footer(p2, font);

  // ========= PAGE 3: Instructions =========
  const p3 = pdfDoc.addPage([A4.w, A4.h]);
  header(p3, bold, font, 'ІНСТРУКЦІЇ ВОДІЮ', order.our_order_number);

  y = A4.h - 110;
  box(p3, bold, 'Обов\'язкові ЗІЗ (Warunki п.11)', y); y -= 18;
  for (const item of ['Черевики зі сталевими носками', 'Сигнальний жилет', 'Захисні окуляри', 'Каска', 'Рукавиці']) {
    txt(p3, font, `• ${item}`, y); y -= 12;
  }
  y -= 6;

  if (order.adr) {
    box(p3, bold, 'ADR-вимоги (Warunki п.12)', y); y -= 18;
    for (const item of ['Повний ADR-пакет в кабіні', 'Діючі ADR-права при собі', `Знаки класу ${order.adr_class ?? ''}`]) {
      txt(p3, font, `• ${item}`, y); y -= 12;
    }
    y -= 6;
  }

  box(p3, bold, 'Паркування (Warunki п.17)', y); y -= 18;
  txt(p3, font, '• Тільки на охоронюваних майданчиках або закритих територіях', y); y -= 18;

  box(p3, bold, 'Документи', y); y -= 18;
  for (const item of ['CMR — 2 оригінали, печатки на обох', 'WZ / Lieferschein', 'Пакет палет', 'Фото перед завантаженням', 'Термограф (якщо є температурний режим)']) {
    txt(p3, font, `• ${item}`, y); y -= 12;
  }
  y -= 6;

  box(p3, bold, 'У разі проблем', y); y -= 18;
  txt(p3, font, `• Негайно зателефонуйте диспетчеру: ${order.manager?.phone ?? BAKSPEED.phone}`, y); y -= 12;
  txt(p3, font, `• Telegram: ${order.manager?.telegram_chat_id ?? '@bakspeed'}`, y); y -= 12;
  txt(p3, font, '• НЕ пускайте третіх осіб до вантажу без узгодження', y); y -= 12;

  footer(p3, font);

  const pdfBytes = await pdfDoc.save();
  const storagePath = `driver-briefs/${order.our_order_number}.pdf`;
  await supabase.storage.from('documents').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf', upsert: true,
  });

  // JWT-style token (simple random for now)
  const token = crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const { data: brief } = await supabase.from('driver_briefs').insert({
    order_id,
    driver_id: order.driver_id,
    pdf_path: storagePath,
    sms_link_token: token,
    sms_link_expires_at: expires,
    sent_at: new Date().toISOString(),
    sent_via: 'sms',
  }).select('id').single();

  await supabase.from('documents').insert({
    order_id,
    kind: 'driver_brief_pdf',
    file_path: storagePath,
    file_name: `${order.our_order_number}_brief.pdf`,
    mime_type: 'application/pdf',
    size_bytes: pdfBytes.length,
  });

  const appUrl = Deno.env.get('APP_URL') ?? 'https://app.bakspeed.pl';
  const link = `${appUrl}/d/${token}`;

  if (order.driver?.phone) {
    await supabase.from('notifications').insert({
      order_id,
      recipient_driver_id: order.driver_id,
      recipient_raw_phone: order.driver.phone,
      channel: 'sms',
      template_code: 'driver_brief_sms',
      body: `Завдання ${order.our_order_number}: ${order.loading_place ?? ''} → ${order.unloading_place ?? ''}. Деталі: ${link}`,
    });
  }

  return jsonResponse({ ok: true, brief_id: brief?.id, pdf_path: storagePath, link });
});

function header(p: any, b: any, f: any, title: string, num: string) {
  p.drawRectangle({ x: 0, y: A4.h - 80, width: A4.w, height: 80, color: ORANGE });
  p.drawText(title, { x: 40, y: A4.h - 40, size: 20, font: b, color: rgb(1, 1, 1) });
  p.drawText(`№ ${num}`, { x: 40, y: A4.h - 62, size: 12, font: f, color: rgb(1, 1, 1) });
  p.drawText(BAKSPEED.slogan, { x: A4.w - 180, y: A4.h - 40, size: 10, font: b, color: rgb(1, 1, 1) });
}
function box(p: any, f: any, text: string, y: number) {
  p.drawRectangle({ x: 40, y: y - 2, width: A4.w - 80, height: 16, color: ORANGE, opacity: 0.12 });
  p.drawText(text, { x: 46, y: y + 2, size: 11, font: f, color: ORANGE });
}
function txt(p: any, f: any, text: string, y: number, color?: any) {
  p.drawText(text.substring(0, 110), { x: 44, y, size: 10, font: f, ...(color ? { color } : {}) });
}
function header2(p: any, f: any, y: number, cells: string[]) {
  const xs = [44, 280, 360, 450];
  cells.forEach((c, i) => p.drawText(c, { x: xs[i], y, size: 9, font: f }));
}
function row(p: any, f: any, y: number, cells: string[]) {
  const xs = [44, 280, 360, 450];
  cells.forEach((c, i) => p.drawText(c, { x: xs[i], y, size: 9.5, font: f }));
}
function footer(p: any, f: any) {
  const fl = letterheadFooter().split('\n');
  let fy = 50;
  for (const l of fl) { p.drawText(l, { x: 40, y: fy, size: 7.5, font: f }); fy -= 10; }
}

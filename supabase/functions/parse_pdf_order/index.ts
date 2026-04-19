// Parse incoming client PDF → structured order draft via Claude API.
// Expects body: { storage_path: string, bucket: string }
// Returns: { order_id: uuid, extracted: {...}, confidences: {...} }

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const MODEL = 'claude-opus-4-7';
const SYSTEM = `Ти — експерт з експедиції, що витягує дані з PDF-замовлень на перевезення. Повертай СУВОРО валідний JSON згідно схеми tool. Дати у форматі YYYY-MM-DD, час HH:MM. Валюта EUR або PLN. Якщо поле неясне — залиш null + поясни у field_notes з confidence (0..1).`;

const TOOL = {
  name: 'extract_order',
  description: 'Витягти структуровані дані замовлення на перевезення',
  input_schema: {
    type: 'object',
    properties: {
      client_company_name: { type: 'string' },
      client_order_number: { type: 'string' },
      client_contact_name: { type: 'string' },
      client_contact_email: { type: 'string' },
      client_contact_phone: { type: 'string' },
      loading_date: { type: 'string' },
      loading_time_from: { type: 'string' },
      loading_time_to: { type: 'string' },
      loading_place: { type: 'string' },
      loading_address: { type: 'string' },
      loading_post_code: { type: 'string' },
      loading_country: { type: 'string' },
      loading_reference: { type: 'string' },
      loading_notes: { type: 'string' },
      unloading_date: { type: 'string' },
      unloading_time_from: { type: 'string' },
      unloading_time_to: { type: 'string' },
      unloading_place: { type: 'string' },
      unloading_address: { type: 'string' },
      unloading_post_code: { type: 'string' },
      unloading_country: { type: 'string' },
      unloading_reference: { type: 'string' },
      goods_type: { type: 'string' },
      weight_kg: { type: 'number' },
      loading_meters: { type: 'number' },
      volume_m3: { type: 'number' },
      adr: { type: 'boolean' },
      adr_class: { type: 'string' },
      un_number: { type: 'string' },
      stackable: { type: 'boolean' },
      temperature_required: { type: 'boolean' },
      temperature_min: { type: 'number' },
      temperature_max: { type: 'number' },
      pallets_type: { type: 'string', enum: ['EPAL', 'H1', 'DUSSELDORFER', 'GITTERBOX', 'OTHER'] },
      pallets_count: { type: 'integer' },
      pallets_exchange_required: { type: 'boolean' },
      turnover_netto_original: { type: 'number' },
      client_currency: { type: 'string', enum: ['EUR', 'PLN'] },
      payment_term_client_days: { type: 'integer' },
      vehicle_type: { type: 'string' },
      body_type: { type: 'string' },
      field_notes: {
        type: 'object',
        description: 'Carrier-confidence map: { field_name: { confidence: 0..1, note: string } }',
      },
    },
    required: ['loading_place', 'unloading_place'],
  },
};

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST required' }, 405);

  const body = await req.json();
  const { storage_path, bucket = 'orders-pdf' } = body;
  if (!storage_path) return jsonResponse({ error: 'storage_path required' }, 400);

  const supabase = getServiceClient();
  const { data: fileBlob, error: dlErr } = await supabase.storage.from(bucket).download(storage_path);
  if (dlErr || !fileBlob) return jsonResponse({ error: dlErr?.message ?? 'download failed' }, 500);

  const arrBuf = await fileBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrBuf)));

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not set' }, 500);

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'extract_order' },
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Витягни структуровані дані цього замовлення на перевезення.' },
        ],
      }],
    }),
  });

  if (!apiRes.ok) {
    const text = await apiRes.text();
    return jsonResponse({ error: `Claude API ${apiRes.status}: ${text}` }, 500);
  }

  const aiData = await apiRes.json();
  const toolUse = aiData.content?.find((c: any) => c.type === 'tool_use');
  if (!toolUse) return jsonResponse({ error: 'no tool_use in response', raw: aiData }, 500);

  const ex = toolUse.input;

  // Fuzzy-match client by name
  let clientId: string | null = null;
  if (ex.client_company_name) {
    const { data: matches } = await supabase
      .from('clients')
      .select('id, company_name')
      .ilike('company_name', `%${ex.client_company_name.slice(0, 12)}%`)
      .limit(1);
    if (matches && matches.length) clientId = matches[0].id;
    else {
      const { data: inserted } = await supabase
        .from('clients')
        .insert({ company_name: ex.client_company_name, default_currency: ex.client_currency ?? 'EUR' })
        .select('id')
        .single();
      clientId = inserted?.id ?? null;
    }
  }

  // Save PDF document
  const { data: docIns } = await supabase
    .from('documents')
    .insert({
      order_id: null,
      kind: 'client_order_pdf',
      file_path: storage_path,
      file_name: storage_path.split('/').pop(),
      meta: { extraction: ex.field_notes ?? {} },
    })
    .select('id')
    .single();

  // Create draft order
  const { data: order, error: insErr } = await supabase
    .from('orders')
    .insert({
      status: 'draft',
      client_id: clientId,
      client_order_number: ex.client_order_number,
      loading_date: ex.loading_date || null,
      loading_time_from: ex.loading_time_from || null,
      loading_time_to: ex.loading_time_to || null,
      loading_place: ex.loading_place,
      loading_address: ex.loading_address,
      loading_post_code: ex.loading_post_code,
      loading_country: ex.loading_country,
      loading_reference: ex.loading_reference,
      loading_notes: ex.loading_notes,
      unloading_date: ex.unloading_date || null,
      unloading_time_from: ex.unloading_time_from || null,
      unloading_time_to: ex.unloading_time_to || null,
      unloading_place: ex.unloading_place,
      unloading_address: ex.unloading_address,
      unloading_post_code: ex.unloading_post_code,
      unloading_country: ex.unloading_country,
      unloading_reference: ex.unloading_reference,
      goods_type: ex.goods_type,
      weight_kg: ex.weight_kg,
      loading_meters: ex.loading_meters,
      volume_m3: ex.volume_m3,
      adr: !!ex.adr,
      adr_class: ex.adr_class,
      un_number: ex.un_number,
      stackable: !!ex.stackable,
      temperature_required: !!ex.temperature_required,
      temperature_min: ex.temperature_min,
      temperature_max: ex.temperature_max,
      pallets_type: ex.pallets_type,
      pallets_count: ex.pallets_count,
      pallets_exchange_required: !!ex.pallets_exchange_required,
      turnover_netto_original: ex.turnover_netto_original,
      client_currency: ex.client_currency ?? 'EUR',
      payment_term_client_days: ex.payment_term_client_days,
      vehicle_type: ex.vehicle_type,
      body_type: ex.body_type,
      source_pdf_id: docIns?.id ?? null,
    })
    .select('id, our_order_number')
    .single();

  if (insErr) return jsonResponse({ error: insErr.message, extracted: ex }, 500);

  if (docIns?.id && order?.id) {
    await supabase.from('documents').update({ order_id: order.id }).eq('id', docIns.id);
  }

  return jsonResponse({
    order_id: order!.id,
    our_order_number: order!.our_order_number,
    extracted: ex,
    confidences: ex.field_notes ?? {},
  });
});

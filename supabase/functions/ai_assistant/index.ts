// Claude tool-use chat agent for /ai-assistant page.
// Body: { message: string, history: [{role,content}] }
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const MODEL = 'claude-opus-4-7';
const SYSTEM = `Ти — диспетчер-асистент Bakspeed CRM (транспортна компанія). Відповідай українською стисло. Використовуй tools для даних.`;

const TOOLS = [
  {
    name: 'list_overdue_payments',
    description: 'Прострочені платежі клієнтів',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'free_trucks_today',
    description: 'Вантажівки без призначеного замовлення на сьогодні',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_nbp_rate',
    description: 'Курс NBP EUR/PLN',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD' } },
    },
  },
  {
    name: 'truck_month_profit',
    description: 'Оборот/маржа вантажівки за місяць',
    input_schema: {
      type: 'object',
      properties: {
        truck_name: { type: 'string' },
        month: { type: 'string', description: 'YYYY-MM' },
      },
      required: ['truck_name', 'month'],
    },
  },
];

async function runTool(name: string, input: any, supabase: any) {
  if (name === 'list_overdue_payments') {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('orders')
      .select('our_order_number, turnover_netto_original, client_currency, payment_due_date_client, client:clients(company_name)')
      .eq('payment_received_client', false)
      .lt('payment_due_date_client', today);
    return data;
  }
  if (name === 'free_trucks_today') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: busy } = await supabase.from('orders').select('truck_id')
      .gte('loading_date', today).lte('unloading_date', today);
    const busyIds = (busy ?? []).map((o: any) => o.truck_id);
    const { data: trucks } = await supabase.from('trucks').select('name, tractor_plate, body_type').eq('is_active', true);
    return (trucks ?? []).filter((t: any) => !busyIds.includes(t.id));
  }
  if (name === 'get_nbp_rate') {
    const d = input.date ?? new Date().toISOString().slice(0, 10);
    const { data } = await supabase.rpc('nbp_eur_pln_rate_row', { p_date: d });
    return data?.[0];
  }
  if (name === 'truck_month_profit') {
    const { data: truck } = await supabase.from('trucks').select('id').eq('name', input.truck_name).maybeSingle();
    if (!truck) return null;
    const { data } = await supabase.from('truck_month_stats').select('*').eq('truck_id', truck.id).eq('month', input.month + '-01').maybeSingle();
    return data;
  }
  return null;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const { message, history = [] } = await req.json();
  const anthropic = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropic) return jsonResponse({ reply: 'ANTHROPIC_API_KEY не встановлено. Додайте ключ у Vault Supabase.' });

  const supabase = getServiceClient();
  const messages = [...history, { role: 'user', content: message }];

  let loops = 0;
  while (loops++ < 5) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': anthropic, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: SYSTEM, tools: TOOLS, messages }),
    });
    if (!r.ok) return jsonResponse({ error: await r.text() }, 500);
    const body = await r.json();

    const toolUse = body.content.find((c: any) => c.type === 'tool_use');
    const textBlock = body.content.find((c: any) => c.type === 'text');

    if (!toolUse) {
      return jsonResponse({ reply: textBlock?.text ?? '' });
    }

    const result = await runTool(toolUse.name, toolUse.input, supabase);
    messages.push({ role: 'assistant', content: body.content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result ?? {}) }],
    });
  }
  return jsonResponse({ reply: 'Надто багато циклів tool-use' });
});

// Cron every 15 min: scan scheduled_reminders.reminder_type='auto_accept' that are due
// and auto-mark dispatched orders as auto_accepted (Warunki п.9).
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from('scheduled_reminders')
    .select('*, order:orders(id, status, carrier:carriers(company_name))')
    .eq('reminder_type', 'auto_accept')
    .eq('status', 'pending')
    .lt('scheduled_for', now)
    .limit(100);

  let updated = 0;
  for (const r of (due ?? [])) {
    const o: any = r.order;
    if (!o) continue;
    if (o.status === 'dispatched') {
      await supabase.from('orders').update({
        status: 'auto_accepted',
        auto_accepted_at: new Date().toISOString(),
      }).eq('id', o.id);
      await supabase.from('notifications').insert({
        order_id: o.id, channel: 'telegram', template_code: 'auto_accept_reminder',
        body: `⏰ 30 хв без відповіді — ${o.carrier?.company_name ?? ''}. Статус auto_accepted.`,
      });
      updated++;
    }
    await supabase.from('scheduled_reminders').update({
      status: 'executed', executed_at: new Date().toISOString(),
    }).eq('id', r.id);
  }

  return jsonResponse({ ok: true, updated, checked: due?.length ?? 0 });
});

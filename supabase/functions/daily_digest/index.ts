// Daily 08:00. Telegram digest to owner.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async () => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [todayOrders, inTransit, overdueClient, overdueCarrier, monthTotal] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('loading_date', today),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .eq('payment_received_client', false).lt('payment_due_date_client', today),
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .eq('paid_to_carrier', false).lt('payment_due_date_carrier', today),
    supabase.from('monthly_totals').select('turnover_eur, delta_eur').eq('month', today.slice(0, 7) + '-01').maybeSingle(),
  ]);

  const lines = [
    `📊 Bakspeed daily digest · ${today}`,
    `• Завантаження сьогодні: ${todayOrders.count ?? 0}`,
    `• В дорозі: ${inTransit.count ?? 0}`,
    `• Прострочено (клієнти): ${overdueClient.count ?? 0}`,
    `• Прострочено (перевізники): ${overdueCarrier.count ?? 0}`,
    `• Оборот місяця: ${Number(monthTotal.data?.turnover_eur ?? 0).toFixed(2)} EUR`,
    `• Маржа місяця: ${Number(monthTotal.data?.delta_eur ?? 0).toFixed(2)} EUR`,
  ];

  const { data: owner } = await supabase
    .from('managers').select('telegram_chat_id').eq('role', 'owner').maybeSingle();

  await supabase.from('notifications').insert({
    recipient_raw_chat_id: owner?.telegram_chat_id,
    channel: 'telegram',
    template_code: 'daily_digest',
    body: lines.join('\n'),
  });

  return jsonResponse({ ok: true, digest: lines.join('\n') });
});

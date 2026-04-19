// Daily 09:00. Scan unpaid invoices and enqueue reminders: −7d, 0d, +7d, +14d (overdue).
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const DAY = 86400_000;

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const supabase = getServiceClient();
  const today = new Date();

  const { data: invoices } = await supabase
    .from('invoices_out')
    .select('id, invoice_number, payment_due_date, order_id, order:orders!inner(client:clients(email, company_name))')
    .neq('status', 'paid')
    .not('payment_due_date', 'is', null);

  let queued = 0;
  for (const inv of (invoices ?? [])) {
    const due = new Date(inv.payment_due_date!);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / DAY);
    const stages: Record<number, string> = {
      [-14]: 'payment_overdue_14', [-7]: 'payment_overdue_7',
      [0]: 'payment_reminder_client_0', [7]: 'payment_reminder_client_m7',
    };
    const template = stages[diffDays];
    if (!template) continue;

    const client = (inv.order as any)?.client;
    await supabase.from('notifications').insert({
      order_id: inv.order_id,
      channel: 'email',
      template_code: template,
      recipient_raw_email: client?.email,
      subject: `Przypomnienie o płatności ${inv.invoice_number}`,
      body: `Faktura ${inv.invoice_number} · termin ${inv.payment_due_date}`,
      payload: { invoice_id: inv.id, diffDays },
    });
    queued++;
  }

  return jsonResponse({ ok: true, queued });
});

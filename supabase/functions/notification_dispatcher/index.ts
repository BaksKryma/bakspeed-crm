// Runs every minute. Picks pending notifications and sends via provider (Telegram/Resend/Twilio).
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = Deno.env.get('TWILIO_FROM') ?? '+';

async function sendTelegram(chat_id: string, text: string) {
  if (!TG_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  });
  if (!r.ok) throw new Error(`TG ${r.status}: ${await r.text()}`);
  return (await r.json()).result?.message_id;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY not set');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Bakspeed <noreply@bakspeed.pl>', to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return (await r.json()).id;
}

async function sendSms(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN) throw new Error('Twilio not set');
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
  return (await r.json()).sid;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const supabase = getServiceClient();

  const { data: pending } = await supabase
    .from('notifications')
    .select('*, order:orders(our_order_number), client:clients(email), carrier:carriers(email), manager:managers(telegram_chat_id, email), driver:drivers(phone, telegram_chat_id)')
    .eq('status', 'pending')
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(50);

  let sent = 0;
  for (const n of (pending ?? [])) {
    try {
      let providerId: string | undefined;
      if (n.channel === 'telegram') {
        const chatId = n.recipient_raw_chat_id
          ?? (n as any).manager?.telegram_chat_id
          ?? (n as any).driver?.telegram_chat_id;
        if (!chatId) throw new Error('no chat_id');
        providerId = await sendTelegram(chatId, n.body ?? '');
      } else if (n.channel === 'email') {
        const to = n.recipient_raw_email
          ?? (n as any).client?.email
          ?? (n as any).carrier?.email
          ?? (n as any).manager?.email;
        if (!to) throw new Error('no email');
        providerId = await sendEmail(to, n.subject ?? '', `<p>${(n.body ?? '').replace(/\n/g, '<br/>')}</p>`);
      } else if (n.channel === 'sms') {
        const to = n.recipient_raw_phone ?? (n as any).driver?.phone;
        if (!to) throw new Error('no phone');
        providerId = await sendSms(to, n.body ?? '');
      } else {
        // whatsapp / in_app — fall-through
      }
      await supabase.from('notifications').update({
        status: 'sent', sent_at: new Date().toISOString(),
        provider_message_id: providerId, attempts: (n.attempts ?? 0) + 1,
      }).eq('id', n.id);
      sent++;
    } catch (e) {
      await supabase.from('notifications').update({
        status: (n.attempts ?? 0) + 1 >= 3 ? 'failed' : 'pending',
        error_message: String(e), attempts: (n.attempts ?? 0) + 1,
      }).eq('id', n.id);
    }
  }
  return jsonResponse({ ok: true, sent, pending: pending?.length ?? 0 });
});

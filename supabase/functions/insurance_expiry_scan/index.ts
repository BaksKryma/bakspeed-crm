// Daily 11:30. OCP/Licence expiry ≤ 30d — notify owner.
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const DAY = 86400_000;

Deno.serve(async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * DAY).toISOString().slice(0, 10);

  const { data: carriers } = await supabase
    .from('carriers')
    .select('id, company_name, email, ocp_insurance_expiry')
    .lte('ocp_insurance_expiry', in30)
    .gte('ocp_insurance_expiry', today.toISOString().slice(0, 10));

  let queued = 0;
  for (const c of (carriers ?? [])) {
    await supabase.from('notifications').insert({
      recipient_carrier_id: c.id,
      channel: 'telegram',
      template_code: 'ocp_expiry_warning',
      body: `⚠️ ${c.company_name}: OCP спливає ${c.ocp_insurance_expiry}`,
    });
    queued++;
  }

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, full_name, licence_expiry, adr_cert_expiry, has_adr_cert')
    .or(`licence_expiry.lte.${in30},adr_cert_expiry.lte.${in30}`);

  for (const d of (drivers ?? [])) {
    await supabase.from('notifications').insert({
      recipient_driver_id: d.id,
      channel: 'telegram',
      body: `⚠️ ${d.full_name}: licence ${d.licence_expiry ?? '—'}${d.has_adr_cert ? ` · ADR ${d.adr_cert_expiry ?? '—'}` : ''}`,
    });
    queued++;
  }

  return jsonResponse({ ok: true, queued });
});

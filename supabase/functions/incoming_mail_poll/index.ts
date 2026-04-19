// Every 15 min. Poll IMAP inbox dispo@bakspeed.pl for new order PDFs.
// Requires: IMAP_HOST, IMAP_USER, IMAP_PASS. (v2 — real implementation)
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async () => {
  // Stub — real IMAP implementation requires full mail library (Deno.std mail is limited).
  // Integrate with Mailgun / SendGrid inbound webhooks instead of IMAP in v1.
  return jsonResponse({ ok: true, skipped: 'IMAP v2' });
});

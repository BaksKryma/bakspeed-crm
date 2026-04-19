import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';

export function InvoiceTab({ order }: { order: any; onSaved?: () => void }) {
  const { data: invOut } = useQuery({
    queryKey: ['invoice-out', order.id],
    queryFn: async () => {
      const { data } = await supabase.from('invoices_out').select('*').eq('order_id', order.id).maybeSingle();
      return data;
    },
  });
  const { data: invIn } = useQuery({
    queryKey: ['invoice-in', order.id],
    queryFn: async () => {
      const { data } = await supabase.from('invoices_in').select('*').eq('order_id', order.id).maybeSingle();
      return data;
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Вихідна фактура (клієнту)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {invOut ? (
            <>
              <div className="flex justify-between"><span>№</span><span className="font-mono">{invOut.invoice_number}</span></div>
              <div className="flex justify-between"><span>Saldeo</span><Badge variant={invOut.saldeo_sync_status === 'synced' ? 'success' : 'warning'}>{invOut.saldeo_sync_status}</Badge></div>
              <div className="flex justify-between"><span>Netto</span><span className="numeric">{formatCurrency(invOut.netto_amount, invOut.netto_currency)}</span></div>
              <div className="flex justify-between"><span>VAT (PLN)</span><span className="numeric">{formatCurrency(invOut.vat_amount_pln, 'PLN')}</span></div>
              <div className="flex justify-between"><span>Термін оплати</span><span>{formatDate(invOut.payment_due_date)}</span></div>
              <div className="flex justify-between"><span>Статус</span><Badge>{invOut.status}</Badge></div>
            </>
          ) : <div className="text-muted-foreground">Фактуру ще не виставлено</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Вхідна фактура (перевізника)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {invIn ? (
            <>
              <div className="flex justify-between"><span>№</span><span className="font-mono">{invIn.invoice_number}</span></div>
              <div className="flex justify-between"><span>Netto</span><span className="numeric">{formatCurrency(invIn.netto_amount, invIn.netto_currency)}</span></div>
              <div className="flex justify-between"><span>Термін оплати</span><span>{formatDate(invIn.payment_due_date)}</span></div>
              <div className="flex justify-between"><span>Whitelist</span><Badge variant={invIn.is_whitelist_ok ? 'success' : 'warning'}>{invIn.is_whitelist_ok ? 'ok' : 'не перевірено'}</Badge></div>
              <div className="flex justify-between"><span>Penalty п.35</span><Badge variant="outline">{invIn.penalty_kind}</Badge></div>
            </>
          ) : <div className="text-muted-foreground">Фактуру не отримано</div>}
        </CardContent>
      </Card>
    </div>
  );
}

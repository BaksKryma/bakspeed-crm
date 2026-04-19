import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';

function severity(days: number | null): 'success' | 'warning' | 'destructive' | 'outline' {
  if (days == null) return 'outline';
  if (days > 7) return 'success';
  if (days >= 0) return 'warning';
  if (days > -7) return 'warning';
  return 'destructive';
}

export default function Payments() {
  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, our_order_number, payment_due_date_client, turnover_netto_original, client_currency, client:clients(company_name)')
        .eq('payment_received_client', false)
        .not('payment_due_date_client', 'is', null)
        .order('payment_due_date_client', { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, our_order_number, payment_due_date_carrier, price_carrier_netto_original, carrier_currency, carrier_penalty_kind, carrier:carriers(company_name, whitelist_status)')
        .eq('paid_to_carrier', false)
        .not('payment_due_date_carrier', 'is', null)
        .order('payment_due_date_carrier', { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Платежі</h1>
        <Button variant="outline"><Upload className="h-4 w-4 mr-1" />Імпорт MT940</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Нам винні</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left pb-2">№</th><th className="text-left">Клієнт</th><th className="text-right">Сума</th><th className="text-right">Термін</th><th className="text-right">Днів</th></tr>
                </thead>
                <tbody>
                  {(receivables as any[]).map((o) => {
                    const d = daysUntil(o.payment_due_date_client);
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="py-2"><Link to={`/orders/${o.id}`} className="font-mono text-xs hover:underline">{o.our_order_number}</Link></td>
                        <td>{o.client?.company_name}</td>
                        <td className="text-right numeric">{formatCurrency(o.turnover_netto_original, o.client_currency)}</td>
                        <td className="text-right text-xs">{formatDate(o.payment_due_date_client)}</td>
                        <td className="text-right"><Badge variant={severity(d)}>{d ?? '—'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ми винні</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left pb-2">№</th><th className="text-left">Перевізник</th><th className="text-right">Сума</th><th className="text-right">Термін</th><th className="text-right">Днів</th><th className="text-left">Whitelist</th></tr>
                </thead>
                <tbody>
                  {(payables as any[]).map((o) => {
                    const d = daysUntil(o.payment_due_date_carrier);
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="py-2"><Link to={`/orders/${o.id}`} className="font-mono text-xs hover:underline">{o.our_order_number}</Link></td>
                        <td>{o.carrier?.company_name}</td>
                        <td className="text-right numeric">{formatCurrency(o.price_carrier_netto_original, o.carrier_currency)}</td>
                        <td className="text-right text-xs">{formatDate(o.payment_due_date_carrier)}</td>
                        <td className="text-right"><Badge variant={severity(d)}>{d ?? '—'}</Badge></td>
                        <td><Badge variant={o.carrier?.whitelist_status === 'ok' ? 'success' : 'warning'}>{o.carrier?.whitelist_status ?? '—'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

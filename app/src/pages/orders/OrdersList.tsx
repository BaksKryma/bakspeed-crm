import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Upload, Filter as FilterIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatEUR, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/orders/StatusBadge';
import { UploadPdfDialog } from '@/components/orders/UploadPdfDialog';

export default function OrdersList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [month, setMonth] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', search, status, month],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, our_order_number, client_order_number, loading_date, unloading_date, loading_place, unloading_place, status, turnover_netto_eur, price_carrier_netto_eur, delta_netto_eur, client:clients(company_name), carrier:carriers(company_name), truck:trucks(name), manager:managers(code)')
        .order('loading_date', { ascending: false })
        .limit(500);
      if (status !== 'all') q = q.eq('status', status as never);
      if (month !== 'all') {
        const [y, m] = month.split('-').map(Number);
        const from = new Date(y, m - 1, 1).toISOString().slice(0, 10);
        const to = new Date(y, m, 1).toISOString().slice(0, 10);
        q = q.gte('loading_date', from).lt('loading_date', to);
      }
      if (search) {
        q = q.or(`our_order_number.ilike.%${search}%,client_order_number.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const months = useMemo(() => {
    const now = new Date();
    const arr: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('orders.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> {t('orders.fromPdf')}
          </Button>
          <Button asChild>
            <Link to="/orders/new">
              <Plus className="h-4 w-4 mr-1" /> {t('orders.new')}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-3 flex gap-2 items-center">
        <FilterIcon className="h-4 w-4 text-muted-foreground ml-2" />
        <Input placeholder="№ замовлення…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
          <option value="all">{t('common.all')} {t('common.status')}</option>
          {(['draft','planned','dispatched','auto_accepted','loading','in_transit','unloading','delivered','invoiced','paid','cancelled'] as const).map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
          <option value="all">{t('common.all')}</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Card>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">№</th>
                <th className="text-left p-3">Клієнт</th>
                <th className="text-left p-3">Маршрут</th>
                <th className="text-left p-3">Завант.</th>
                <th className="text-left p-3">Розв.</th>
                <th className="text-left p-3">Перевізник</th>
                <th className="text-left p-3">М.</th>
                <th className="text-right p-3">Оборот</th>
                <th className="text-right p-3">Перевіз.</th>
                <th className="text-right p-3">Маржа</th>
                <th className="text-left p-3">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">{t('common.loading')}</td></tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">{t('common.noData')}</td></tr>
              )}
              {orders.map((o: any) => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">
                    <Link to={`/orders/${o.id}`} className="hover:underline">{o.our_order_number}</Link>
                  </td>
                  <td className="p-3">{o.client?.company_name ?? '—'}</td>
                  <td className="p-3 text-xs">{o.loading_place} → {o.unloading_place}</td>
                  <td className="p-3 text-xs">{formatDate(o.loading_date)}</td>
                  <td className="p-3 text-xs">{formatDate(o.unloading_date)}</td>
                  <td className="p-3">{o.carrier?.company_name ?? '—'}</td>
                  <td className="p-3"><Badge variant="outline">{o.manager?.code ?? '—'}</Badge></td>
                  <td className="p-3 text-right numeric">{formatEUR(o.turnover_netto_eur)}</td>
                  <td className="p-3 text-right numeric">{formatEUR(o.price_carrier_netto_eur)}</td>
                  <td className="p-3 text-right numeric font-medium">{formatEUR(o.delta_netto_eur)}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <UploadPdfDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

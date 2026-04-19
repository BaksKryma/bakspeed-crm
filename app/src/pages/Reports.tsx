import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { formatEUR } from '@/lib/utils';

export default function Reports() {
  const { data: monthly = [] } = useQuery({
    queryKey: ['report-monthly'],
    queryFn: async () => {
      const { data } = await supabase.from('monthly_totals').select('*').order('month');
      return (data ?? []).map((r: any) => ({
        month: String(r.month).slice(0, 7),
        turnover: Number(r.turnover_eur),
        delta: Number(r.delta_eur),
        ratio: Number(r.delta_turnover_ratio ?? 0) * 100,
      }));
    },
  });

  const { data: byManager = [] } = useQuery({
    queryKey: ['report-manager'],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const { data } = await supabase.from('manager_month_stats').select('*').eq('month', month);
      return data ?? [];
    },
  });

  const { data: byClient = [] } = useQuery({
    queryKey: ['report-client'],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const { data } = await supabase.from('client_month_stats').select('*').eq('month', month).order('turnover_eur', { ascending: false }).limit(15);
      return data ?? [];
    },
  });

  const totalTurnover = monthly.reduce((s, r) => s + r.turnover, 0);
  const totalDelta = monthly.reduce((s, r) => s + r.delta, 0);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Звіти</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Оборот YTD</CardTitle></CardHeader><CardContent className="numeric text-2xl font-semibold">{formatEUR(totalTurnover)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Маржа YTD</CardTitle></CardHeader><CardContent className="numeric text-2xl font-semibold">{formatEUR(totalDelta)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Середня маржа %</CardTitle></CardHeader><CardContent className="numeric text-2xl font-semibold">{totalTurnover ? ((totalDelta / totalTurnover) * 100).toFixed(1) : '—'}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Оборот / Маржа по місяцях</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="turnover" name="Оборот €" fill="#F97316" />
              <Bar dataKey="delta" name="Маржа €" fill="#16A34A" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Топ клієнтів (цей місяць)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left pb-1">Клієнт</th><th className="text-right">Замов.</th><th className="text-right">Оборот</th><th className="text-right">Маржа</th></tr>
              </thead>
              <tbody className="numeric">
                {(byClient as any[]).map((r) => (
                  <tr key={r.client_id} className="border-t">
                    <td className="py-1.5">{r.company_name}</td>
                    <td className="text-right">{r.orders_count}</td>
                    <td className="text-right">{formatEUR(Number(r.turnover_eur))}</td>
                    <td className="text-right">{formatEUR(Number(r.delta_eur))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Менеджери (цей місяць)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left pb-1">Код</th><th className="text-right">Замов.</th><th className="text-right">Оборот</th><th className="text-right">Маржа</th><th className="text-right">%</th></tr>
              </thead>
              <tbody className="numeric">
                {(byManager as any[]).map((r) => (
                  <tr key={r.manager_id} className="border-t">
                    <td className="py-1.5">{r.manager_code}</td>
                    <td className="text-right">{r.orders_count}</td>
                    <td className="text-right">{formatEUR(Number(r.turnover_eur))}</td>
                    <td className="text-right">{formatEUR(Number(r.delta_eur))}</td>
                    <td className="text-right">{r.margin_ratio ? (Number(r.margin_ratio) * 100).toFixed(1) : '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

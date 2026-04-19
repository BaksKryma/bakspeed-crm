import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';

export function MonthlyChart() {
  const { data } = useQuery({
    queryKey: ['monthly-totals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_totals')
        .select('month, turnover_eur, delta_eur')
        .order('month', { ascending: true })
        .limit(12);
      return (data ?? []).map((r) => ({
        month: String(r.month).slice(0, 7),
        turnover: Number(r.turnover_eur),
        delta: Number(r.delta_eur),
      }));
    },
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data ?? []}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="month" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar dataKey="turnover" fill="#F97316" name="Оборот EUR" />
          <Bar dataKey="delta" fill="#16A34A" name="Маржа EUR" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

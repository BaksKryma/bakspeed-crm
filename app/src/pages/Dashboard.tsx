import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package, Truck, Wallet, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatEUR } from '@/lib/utils';
import { EuropeMap } from '@/components/dashboard/EuropeMap';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';

export default function Dashboard() {
  const { t } = useTranslation();

  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const [active, inTransit, monthStats, overdue] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .not('status', 'in', '(draft,cancelled,paid)'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
        supabase.from('monthly_totals').select('turnover_eur').eq('month', month + '-01').maybeSingle(),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('payment_received_client', false)
          .lt('payment_due_date_client', new Date().toISOString().slice(0, 10)),
      ]);
      return {
        active: active.count ?? 0,
        inTransit: inTransit.count ?? 0,
        turnover: monthStats.data?.turnover_eur ?? 0,
        overdue: overdue.count ?? 0,
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('dashboard.active')} value={kpi?.active ?? '—'} icon={<Package className="h-4 w-4" />} />
        <Kpi label={t('dashboard.inTransit')} value={kpi?.inTransit ?? '—'} icon={<Truck className="h-4 w-4" />} />
        <Kpi label={t('dashboard.turnoverMonth')} value={formatEUR(Number(kpi?.turnover ?? 0))} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label={t('dashboard.overdue')} value={kpi?.overdue ?? '—'} icon={<AlertTriangle className="h-4 w-4" />} danger />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t('reports.monthlyTurnover')}</CardTitle></CardHeader>
          <CardContent><MonthlyChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('dashboard.map')}</CardTitle></CardHeader>
          <CardContent className="p-0"><EuropeMap /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, danger }: { label: string; value: React.ReactNode; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={danger ? 'text-destructive' : 'text-primary'}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold numeric">{value}</div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileDown, MapPinned, Send, FileSpreadsheet, Smartphone, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/orders/StatusBadge';
import { OverviewTab } from '@/components/orders/tabs/OverviewTab';
import { RouteTab } from '@/components/orders/tabs/RouteTab';
import { DocumentsTab } from '@/components/orders/tabs/DocumentsTab';
import { TimelineTab } from '@/components/orders/tabs/TimelineTab';
import { MessagesTab } from '@/components/orders/tabs/MessagesTab';
import { InvoiceTab } from '@/components/orders/tabs/InvoiceTab';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`*,
          client:clients(*),
          client_contact:client_contacts(*),
          manager:managers(*),
          carrier:carriers(*),
          truck:trucks(*),
          driver:drivers(*)`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const invoke = async (fn: string) => {
    const { error } = await supabase.functions.invoke(fn, { body: { order_id: id } });
    if (error) toast.error(error.message);
    else { toast.success('Готово'); await refetch(); }
  };

  if (!order) return <div className="p-6 text-muted-foreground">Завантаження…</div>;
  const isOwnFleet = Boolean(order.carrier?.is_own_fleet);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <div className="text-2xl font-semibold font-mono">{order.our_order_number}</div>
          <div className="text-sm text-muted-foreground">{order.client?.company_name}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={order.status} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Огляд</TabsTrigger>
          <TabsTrigger value="route">Маршрут</TabsTrigger>
          <TabsTrigger value="documents">Документи</TabsTrigger>
          <TabsTrigger value="timeline">Історія</TabsTrigger>
          <TabsTrigger value="messages">Повідомлення</TabsTrigger>
          <TabsTrigger value="invoice">Фактура</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab order={order} onSaved={refetch} /></TabsContent>
        <TabsContent value="route"><RouteTab order={order} onSaved={refetch} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab orderId={order.id} /></TabsContent>
        <TabsContent value="timeline"><TimelineTab orderId={order.id} /></TabsContent>
        <TabsContent value="messages"><MessagesTab orderId={order.id} /></TabsContent>
        <TabsContent value="invoice"><InvoiceTab order={order} onSaved={refetch} /></TabsContent>
      </Tabs>

      <Card className="sticky bottom-4">
        <CardContent className="flex flex-wrap gap-2 p-4">
          <Button size="sm" onClick={() => invoke('generate_driver_brief')}>
            <Smartphone className="h-4 w-4 mr-1" /> Driver Brief
          </Button>
          {!isOwnFleet && (
            <Button size="sm" variant="outline" onClick={() => invoke('generate_carrier_order_pdf')}>
              <FileDown className="h-4 w-4 mr-1" /> PDF перевізнику
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => invoke('fleethand_build_route')}>
            <MapPinned className="h-4 w-4 mr-1" /> Маршрут Fleet Hand
          </Button>
          <Button size="sm" variant="outline" onClick={() => invoke('saldeo_create_invoice')}
            disabled={order.status !== 'delivered' && order.status !== 'documents_received'}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Створити фактуру (Saldeo)
          </Button>
          <Button size="sm" variant="ghost" onClick={async () => {
            await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.id);
            await refetch();
          }}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Delivered
          </Button>
          <Button size="sm" variant="ghost">
            <Send className="h-4 w-4 mr-1" /> SMS водієві
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

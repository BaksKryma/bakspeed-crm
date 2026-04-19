import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Camera, Truck, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function DriverWebview() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc('driver_webview_get', { p_token: token });
      if (data?.error) toast.error(data.error);
      else setData(data);
    })();
  }, [token]);

  if (!data) return <div className="min-h-screen grid place-items-center">Завантаження…</div>;

  const setStatus = async (status: string) => {
    const { data: r } = await supabase.rpc('driver_webview_mark_status', { p_token: token, p_status: status });
    if (r?.error) toast.error(r.error);
    else toast.success('Оновлено');
  };

  const uploadPhoto = async (kind: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as any).capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = `driver-uploads/${token}/${Date.now()}-${kind}.jpg`;
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) toast.error(error.message);
      else toast.success('Фото завантажено');
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto space-y-3">
      <div className="rounded-xl bg-primary text-white p-4">
        <div className="text-xs opacity-75">Замовлення</div>
        <div className="text-xl font-bold font-mono">{data.order.our_order_number}</div>
        <div className="text-xs mt-1">{data.truck.name} · {data.truck.tractor_plate}</div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Truck className="h-4 w-4" /> Завантаження</div>
        <div className="text-sm">{data.order.loading_address ?? data.order.loading_place}</div>
        <div className="text-xs text-muted-foreground">{data.order.loading_date} · {data.order.loading_time_from}–{data.order.loading_time_to}</div>
        <Button size="sm" className="mt-2 w-full" onClick={() => uploadPhoto('loading')}>
          <Camera className="h-4 w-4 mr-1" /> Фото завантаження
        </Button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Package className="h-4 w-4" /> Розвантаження</div>
        <div className="text-sm">{data.order.unloading_address ?? data.order.unloading_place}</div>
        <div className="text-xs text-muted-foreground">{data.order.unloading_date} · {data.order.unloading_time_from}–{data.order.unloading_time_to}</div>
        <Button size="sm" className="mt-2 w-full" onClick={() => uploadPhoto('cmr')}>
          <Camera className="h-4 w-4 mr-1" /> CMR / розвантаження
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setStatus('loading')}>Завантажено</Button>
        <Button onClick={() => setStatus('delivered')}><CheckCircle2 className="h-4 w-4 mr-1" /> Delivered</Button>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';

export function TimelineTab({ orderId }: { orderId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ['events', orderId],
    queryFn: async () => {
      const { data } = await supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  return (
    <Card>
      <CardHeader><CardTitle>Історія</CardTitle></CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">Немає подій</div>
        ) : (
          <ol className="relative border-l pl-4 space-y-3">
            {events.map((e: any) => (
              <li key={e.id} className="ml-2">
                <div className="text-sm font-medium">{e.event_type}</div>
                <div className="text-xs text-muted-foreground numeric">{formatDateTime(e.created_at)}</div>
                {e.new_value && <pre className="text-xs bg-muted/50 p-2 rounded mt-1 overflow-auto">{JSON.stringify(e.new_value, null, 2)}</pre>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

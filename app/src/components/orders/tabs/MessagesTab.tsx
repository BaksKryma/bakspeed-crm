import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

export function MessagesTab({ orderId }: { orderId: string }) {
  const { data: notes = [] } = useQuery({
    queryKey: ['messages', orderId],
    queryFn: async () => {
      const { data } = await supabase.from('notifications').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  return (
    <Card>
      <CardHeader><CardTitle>Повідомлення</CardTitle></CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <div className="text-sm text-muted-foreground">Повідомлень ще не було</div>
        ) : (
          <ul className="space-y-2">
            {notes.map((n: any) => (
              <li key={n.id} className="p-3 rounded border">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{n.channel}</Badge>
                  <Badge variant={n.status === 'sent' ? 'success' : n.status === 'failed' ? 'destructive' : 'secondary'}>{n.status}</Badge>
                  <span className="text-muted-foreground numeric">{formatDateTime(n.created_at)}</span>
                </div>
                {n.subject && <div className="font-medium text-sm mt-1">{n.subject}</div>}
                <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                {n.error_message && <div className="text-xs text-destructive mt-1">{n.error_message}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

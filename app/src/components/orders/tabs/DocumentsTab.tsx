import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const KIND_LABELS: Record<string, string> = {
  client_order_pdf: 'PDF клієнта',
  carrier_order_pdf: 'PDF перевізнику',
  driver_brief_pdf: 'Driver Brief',
  warunki_realizacji_pdf: 'Warunki',
  cmr: 'CMR',
  wz: 'WZ',
  invoice_out_pdf: 'Наша фактура',
  invoice_in_pdf: 'Фактура перевізника',
  thermograph_printout: 'Термограф',
  pallet_receipt: 'Палети',
  photo_loading: 'Фото завантаження',
  photo_unloading: 'Фото розвантаження',
  map_screenshot: 'Карта',
  other: 'Інше',
};

export function DocumentsTab({ orderId }: { orderId: string }) {
  const { data: docs = [], refetch } = useQuery({
    queryKey: ['documents', orderId],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('order_id', orderId).order('uploaded_at', { ascending: false });
      return data ?? [];
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      for (const file of files) {
        const path = `orders/${orderId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
        if (upErr) { toast.error(upErr.message); continue; }
        await supabase.from('documents').insert({
          order_id: orderId,
          kind: 'other',
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
      }
      await refetch();
      toast.success('Файли завантажено');
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Документи</CardTitle></CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center text-sm cursor-pointer transition-colors mb-4 ${
            isDragActive ? 'border-primary bg-primary/5' : 'text-muted-foreground'
          }`}
        >
          <input {...getInputProps()} />
          Перетягніть CMR / WZ / фото / фактуру сюди
        </div>

        {docs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Немає документів</div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d: any) => (
              <li key={d.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40">
                <FileIcon className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.file_name ?? d.file_path}</div>
                  <div className="text-xs text-muted-foreground">{KIND_LABELS[d.kind] ?? d.kind} · {d.size_bytes ? (d.size_bytes / 1024).toFixed(0) + ' КБ' : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

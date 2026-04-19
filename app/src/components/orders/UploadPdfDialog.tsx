import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function UploadPdfDialog({ open, onOpenChange }: Props) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = `incoming/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('orders-pdf').upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke('parse_pdf_order', {
        body: { storage_path: path, bucket: 'orders-pdf' },
      });
      if (error) throw error;
      toast.success('AI розпізнав файл. Перевірте виділені поля.');
      onOpenChange(false);
      if (data?.order_id) navigate(`/orders/${data.order_id}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Помилка обробки PDF');
    } finally {
      setBusy(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Завантажити PDF-замовлення</DialogTitle>
          <DialogDescription>Перетягніть PDF від клієнта — AI автоматично заповнить поля.</DialogDescription>
        </DialogHeader>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          {busy ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> AI аналізує…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <FileUp className="h-8 w-8" />
              <div>Перетягніть файл або клацніть для вибору</div>
              <div className="text-xs">Підтримка: .pdf</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

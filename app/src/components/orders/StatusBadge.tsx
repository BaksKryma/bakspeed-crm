import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  draft: 'outline',
  planned: 'info',
  dispatched: 'info',
  auto_accepted: 'info',
  loading: 'warning',
  loading_missed: 'destructive',
  in_transit: 'info',
  unloading: 'warning',
  delivered: 'success',
  documents_received: 'success',
  invoiced: 'secondary',
  paid: 'success',
  cancelled: 'outline',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge variant={variants[status] ?? 'outline'}>{t(`status.${status}`)}</Badge>;
}

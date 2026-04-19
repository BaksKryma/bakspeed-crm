import { useEffect, useState } from 'react';
import { Search, LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export function TopBar() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [rate, setRate] = useState<{ rate: number; date: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('currency_rates')
        .select('rate, rate_date')
        .eq('currency', 'EUR')
        .eq('base_currency', 'PLN')
        .lte('rate_date', today)
        .order('rate_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setRate({ rate: Number(data.rate), date: String(data.rate_date) });
    })();
  }, []);

  return (
    <header className="h-14 border-b bg-background flex items-center gap-4 px-5">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('common.search') as string} className="pl-9" />
        <kbd className="hidden sm:inline-block absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Ctrl+K
        </kbd>
      </div>
      <div className="numeric text-xs text-muted-foreground">
        {rate ? `${t('common.nbp')}: ${rate.rate.toFixed(4)} PLN/EUR · ${rate.date}` : t('common.nbp')}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          <span>{auth.profile?.full_name ?? auth.session?.user.email ?? '—'}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void auth.signOut()} title={t('auth.signOut') as string}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

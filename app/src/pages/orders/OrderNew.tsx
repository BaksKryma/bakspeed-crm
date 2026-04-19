import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';

export default function OrderNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    client_order_number: '',
    loading_place: '',
    loading_address: '',
    loading_date: '',
    unloading_place: '',
    unloading_address: '',
    unloading_date: '',
    client_currency: 'EUR',
    carrier_currency: 'EUR',
    turnover_netto_original: '',
    price_carrier_netto_original: '',
    payment_term_client_days: 30,
    payment_term_carrier_days: 60,
    notes: '',
  });

  const { data: refs } = useQuery({
    queryKey: ['new-order-refs'],
    queryFn: async () => {
      const [clients, carriers, managers, trucks] = await Promise.all([
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('carriers').select('id, company_name, is_own_fleet').order('company_name'),
        supabase.from('managers').select('id, code, full_name').eq('is_active', true),
        supabase.from('trucks').select('id, name, carrier_id').eq('is_active', true),
      ]);
      return {
        clients: clients.data ?? [],
        carriers: carriers.data ?? [],
        managers: managers.data ?? [],
        trucks: trucks.data ?? [],
      };
    },
  });

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    const payload: any = { ...form };
    // numeric casts
    for (const k of ['turnover_netto_original', 'price_carrier_netto_original', 'payment_term_client_days', 'payment_term_carrier_days']) {
      if (payload[k] === '' || payload[k] == null) delete payload[k];
      else payload[k] = Number(payload[k]);
    }
    for (const k of ['loading_date', 'unloading_date']) if (!payload[k]) delete payload[k];

    const { data, error } = await supabase.from('orders').insert(payload).select('id').single();
    if (error) return toast.error(error.message);
    toast.success('Замовлення створено');
    navigate(`/orders/${data.id}`);
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <h1 className="text-2xl font-semibold">Нове замовлення</h1>
      <Card>
        <CardHeader><CardTitle>Клієнт і маршрут</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Клієнт">
            <select value={form.client_id ?? ''} onChange={(e) => upd('client_id', e.target.value || null)} className="w-full h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">—</option>
              {refs?.clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </Field>
          <Field label="Менеджер">
            <select value={form.manager_id ?? ''} onChange={(e) => upd('manager_id', e.target.value || null)} className="w-full h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">—</option>
              {refs?.managers.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.full_name}</option>)}
            </select>
          </Field>
          <Field label="Номер замовлення клієнта"><Input value={form.client_order_number} onChange={(e) => upd('client_order_number', e.target.value)} /></Field>
          <div />
          <Field label="Місце завантаження (код)"><Input value={form.loading_place} onChange={(e) => upd('loading_place', e.target.value)} placeholder="DE 12345" /></Field>
          <Field label="Дата завантаження"><Input type="date" value={form.loading_date} onChange={(e) => upd('loading_date', e.target.value)} /></Field>
          <Field label="Адреса завантаження"><Input value={form.loading_address} onChange={(e) => upd('loading_address', e.target.value)} /></Field>
          <div />
          <Field label="Місце розвантаження (код)"><Input value={form.unloading_place} onChange={(e) => upd('unloading_place', e.target.value)} /></Field>
          <Field label="Дата розвантаження"><Input type="date" value={form.unloading_date} onChange={(e) => upd('unloading_date', e.target.value)} /></Field>
          <Field label="Адреса розвантаження"><Input value={form.unloading_address} onChange={(e) => upd('unloading_address', e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Перевізник і ціна</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Перевізник">
            <select value={form.carrier_id ?? ''} onChange={(e) => upd('carrier_id', e.target.value || null)} className="w-full h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">—</option>
              {refs?.carriers.map((c) => <option key={c.id} value={c.id}>{c.company_name}{c.is_own_fleet ? ' ✓' : ''}</option>)}
            </select>
          </Field>
          <Field label="Вантажівка">
            <select value={form.truck_id ?? ''} onChange={(e) => upd('truck_id', e.target.value || null)} className="w-full h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">—</option>
              {refs?.trucks.filter(t => !form.carrier_id || t.carrier_id === form.carrier_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Оборот netto (клієнт)">
            <div className="flex gap-2">
              <Input type="number" step="0.01" value={form.turnover_netto_original} onChange={(e) => upd('turnover_netto_original', e.target.value)} />
              <select value={form.client_currency} onChange={(e) => upd('client_currency', e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
                <option>EUR</option><option>PLN</option>
              </select>
            </div>
          </Field>
          <Field label="Ціна перевізнику netto">
            <div className="flex gap-2">
              <Input type="number" step="0.01" value={form.price_carrier_netto_original} onChange={(e) => upd('price_carrier_netto_original', e.target.value)} />
              <select value={form.carrier_currency} onChange={(e) => upd('carrier_currency', e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm">
                <option>EUR</option><option>PLN</option>
              </select>
            </div>
          </Field>
          <Field label="Payment term клієнта (днів)"><Input type="number" value={form.payment_term_client_days} onChange={(e) => upd('payment_term_client_days', e.target.value)} /></Field>
          <Field label="Payment term перевізника (днів)"><Input type="number" value={form.payment_term_carrier_days} onChange={(e) => upd('payment_term_carrier_days', e.target.value)} /></Field>
          <Field label="Нотатки"><Textarea value={form.notes} onChange={(e) => upd('notes', e.target.value)} /></Field>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={submit}>Зберегти</Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>Скасувати</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

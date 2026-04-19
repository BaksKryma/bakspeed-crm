import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (v: any, row: T) => React.ReactNode;
  type?: 'text' | 'number' | 'date' | 'boolean';
  options?: Array<{ value: any; label: string }>;
}

export interface RefCrudProps<T> {
  title: string;
  table: string;
  columns: Column<T>[];
  defaultOrder?: string;
  searchField?: keyof T & string;
  canDelete?: boolean;
}

export function RefCrud<T extends { id: string }>({ title, table, columns, defaultOrder = 'created_at', searchField, canDelete = true }: RefCrudProps<T>) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table, search],
    queryFn: async () => {
      let q = supabase.from(table).select('*').order(defaultOrder, { ascending: false }).limit(500);
      if (search && searchField) q = q.ilike(searchField as string, `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as T[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      if ((payload as any).id) {
        const { error } = await supabase.from(table).update(payload).eq('id', (payload as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [table] }); setOpen(false); toast.success('Збережено'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [table] }); toast.success('Видалено'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          {searchField && <Input placeholder="Пошук…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />}
          <Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Новий</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((c) => <th key={c.key} className="text-left p-3">{c.label}</th>)}
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">Завантаження…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">Немає даних</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  {columns.map((c) => (
                    <td key={c.key} className="p-3">
                      {c.render ? c.render((row as any)[c.key], row) : String((row as any)[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="p-3 flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm('Видалити?')) del.mutate(row.id); }}>
                        <Trash className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing && (editing as any).id ? 'Редагувати' : 'Новий запис'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto">
            {columns.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <Label>{c.label}</Label>
                {c.options ? (
                  <select
                    className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                    value={(editing as any)?.[c.key] ?? ''}
                    onChange={(e) => setEditing((v) => ({ ...(v ?? {}), [c.key]: e.target.value || null } as any))}
                  >
                    <option value="">—</option>
                    {c.options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                  </select>
                ) : c.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean((editing as any)?.[c.key])}
                    onChange={(e) => setEditing((v) => ({ ...(v ?? {}), [c.key]: e.target.checked } as any))}
                  />
                ) : (
                  <Input
                    type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                    value={(editing as any)?.[c.key] ?? ''}
                    onChange={(e) => setEditing((v) => ({ ...(v ?? {}), [c.key]: e.target.value } as any))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Скасувати</Button>
            <Button onClick={() => editing && save.mutate(editing)}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

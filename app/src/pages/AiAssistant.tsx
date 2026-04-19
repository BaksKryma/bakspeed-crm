import { useState } from 'react';
import { Send, Loader2, Bot, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Msg { role: 'user' | 'assistant'; content: string }

const QUICK = [
  'Створи замовлення з PDF у черзі',
  'Прострочені платежі',
  'Вільні машини сьогодні',
  'Курс NBP EUR/PLN на сьогодні',
  'Скільки заробила BAKS1 у березні',
  'Згенеруй звіт за тиждень',
];

export default function AiAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setMsgs((m) => [...m, { role: 'user', content }]);
    setInput('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai_assistant', {
        body: { message: content, history: msgs },
      });
      if (error) throw error;
      setMsgs((m) => [...m, { role: 'assistant', content: data?.reply ?? '…' }]);
    } catch (e: any) {
      toast.error(e.message ?? 'Помилка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 h-full">
      <Card className="flex flex-col">
        <CardContent className="flex-1 overflow-auto space-y-3 py-4">
          {msgs.length === 0 && <div className="text-sm text-muted-foreground">Напишіть повідомлення або скористайтеся швидкими діями справа.</div>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <div className="p-2 bg-primary/10 rounded-full self-start"><Bot className="h-4 w-4 text-primary" /></div>}
              <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.content}</div>
              {m.role === 'user' && <div className="p-2 bg-muted rounded-full self-start"><UserIcon className="h-4 w-4" /></div>}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI думає…</div>}
        </CardContent>
        <div className="p-3 border-t flex gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введіть запит…" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <Button onClick={() => void send()} disabled={busy}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium">Швидкі дії</div>
          {QUICK.map((q) => (
            <Button key={q} variant="outline" className="w-full justify-start text-left" onClick={() => void send(q)}>
              {q}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

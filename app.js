// Bakspeed CRM — zero-build React app served directly by GitHub Pages.
// All imports via esm.sh + importmap in index.html.

import React, { useEffect, useMemo, useState, useCallback, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { createClient } from '@supabase/supabase-js';

const html = htm.bind(React.createElement);
const h = React.createElement;

// ========= Supabase client =========
const SUPABASE_URL = 'https://fzhfbunluqsqtgbhmlia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y6_R0sTpnXtefyo70Yeegw_urv0GZgX';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
});

// ========= Toast (stacked, independent timers) =========
function repositionToasts() {
  const list = Array.from(document.querySelectorAll('.toast'));
  list.forEach((el, i) => { el.style.top = `${1 + i * 3.25}rem`; });
}
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  repositionToasts();
  setTimeout(() => {
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); repositionToasts(); }, 200);
  }, 3500);
}

// ========= Utils =========
const EUR = (v) => v == null ? '—' : new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(v));
const CUR = (v, c) => v == null ? '—' : new Intl.NumberFormat('uk-UA', { style: 'currency', currency: c || 'EUR', maximumFractionDigits: 2 }).format(Number(v));
const DATE = (v) => !v ? '—' : new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
const daysUntil = (v) => !v ? null : Math.round((new Date(v).getTime() - Date.now()) / 86400000);

const STATUS_LABEL = {
  draft: 'Чернетка', planned: 'Заплановано', dispatched: 'Відправлено',
  auto_accepted: 'Авто-прийнято', loading: 'Завантаження',
  loading_missed: 'Неподання', in_transit: 'В дорозі', unloading: 'Розвантаження',
  delivered: 'Доставлено', documents_received: 'Документи отримано',
  invoiced: 'Виставлено', paid: 'Оплачено', cancelled: 'Скасовано',
};
const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-700',
  planned: 'bg-purple-100 text-purple-700',
  dispatched: 'bg-sky-100 text-sky-700',
  auto_accepted: 'bg-sky-100 text-sky-700',
  loading: 'bg-amber-100 text-amber-700',
  loading_missed: 'bg-red-100 text-red-700',
  in_transit: 'bg-blue-100 text-blue-700',
  unloading: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  documents_received: 'bg-emerald-100 text-emerald-700',
  invoiced: 'bg-slate-200 text-slate-800',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

// ========= Auth =========
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); return; }
    sb.from('managers').select('id, code, full_name, role').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session?.user?.id]);

  const signOut = useCallback(async () => { await sb.auth.signOut(); }, []);
  return html`<${AuthContext.Provider} value=${{ session, profile, ready, signOut }}>${children}</${AuthContext.Provider}>`;
}
const useAuth = () => useContext(AuthContext);

// ========= Router (hash-based, GitHub-Pages-safe) =========
const RouterContext = createContext({ path: '', navigate: () => {} });
function RouterProvider({ children }) {
  const [path, setPath] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const onHash = () => setPath(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((to) => { location.hash = to; }, []);
  return html`<${RouterContext.Provider} value=${{ path, navigate }}>${children}</${RouterContext.Provider}>`;
}
const useRouter = () => useContext(RouterContext);
const Link = ({ to, children, className }) => {
  const { navigate } = useRouter();
  return html`<a href=${'#' + to} className=${className} onClick=${(e) => { e.preventDefault(); navigate(to); }}>${children}</a>`;
};

// ========= Recovery: set new password =========
function RecoveryPassword({ onDone }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (p1.length < 6) return toast('Мін. 6 символів', 'error');
    if (p1 !== p2) return toast('Паролі не збігаються', 'error');
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    sessionStorage.removeItem('recovery_mode');
    toast('Пароль встановлено', 'success');
    onDone();
  };
  const inp = 'w-full h-10 px-3 rounded-md border border-slate-300 mb-3';
  return html`
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-orange-100 to-white">
      <form onSubmit=${save} className="bg-white p-8 rounded-2xl shadow-lg w-[min(420px,90vw)]">
        <div className="text-2xl font-bold text-brand">Bakspeed</div>
        <div className="text-xs text-slate-500 tracking-widest mb-6">SPEED YOU CAN TRUST</div>
        <div className="font-semibold mb-3">Встановіть пароль</div>
        <input type="password" required autoFocus placeholder="Новий пароль" value=${p1} onChange=${(e) => setP1(e.target.value)} className=${inp} />
        <input type="password" required placeholder="Повторіть пароль" value=${p2} onChange=${(e) => setP2(e.target.value)} className=${inp} />
        <button type="submit" disabled=${busy} className="w-full h-10 rounded-md bg-brand text-white font-medium">${busy ? 'Зачекайте…' : 'Зберегти'}</button>
      </form>
    </div>
  `;
}

// ========= Sign-in page =========
function SignIn() {
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'password') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) toast(error.message, 'error');
    } else {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      setBusy(false);
      if (error) toast(error.message, 'error');
      else toast('Лінк надіслано на пошту', 'success');
    }
  };

  return html`
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-orange-100 to-white">
      <form onSubmit=${submit} className="bg-white p-8 rounded-2xl shadow-lg w-[min(420px,90vw)]">
        <div className="text-2xl font-bold text-brand">Bakspeed</div>
        <div className="text-xs text-slate-500 tracking-widest mb-6">SPEED YOU CAN TRUST</div>

        <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 text-sm">
          <button type="button" onClick=${() => setMode('password')}
            className=${`px-3 py-1 rounded-md ${mode === 'password' ? 'bg-white shadow font-medium' : 'text-slate-600'}`}>
            Пароль
          </button>
          <button type="button" onClick=${() => setMode('magic')}
            className=${`px-3 py-1 rounded-md ${mode === 'magic' ? 'bg-white shadow font-medium' : 'text-slate-600'}`}>
            Magic link
          </button>
        </div>

        <label className="block mb-2 text-sm font-medium">Email</label>
        <input type="email" required value=${email} onChange=${(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full h-10 px-3 rounded-md border border-slate-300 mb-4" />

        ${mode === 'password' ? html`
          <label className="block mb-2 text-sm font-medium">Пароль</label>
          <input type="password" required value=${password} onChange=${(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full h-10 px-3 rounded-md border border-slate-300 mb-4" />
        ` : null}

        <button type="submit" disabled=${busy}
          className="w-full h-10 rounded-md bg-brand text-white font-medium hover:bg-brand-dark">
          ${busy ? 'Зачекайте…' : mode === 'password' ? 'Увійти' : 'Отримати magic link'}
        </button>
        ${mode === 'magic' ? html`<div className="mt-3 text-xs text-slate-500">Лінк прийде на пошту — відкрийте в цьому браузері.</div>` : null}
      </form>
    </div>
  `;
}

// ========= Sidebar + shell =========
const NAV = [
  ['/', '📊', 'Пульт'],
  ['/orders', '📋', 'Замовлення'],
  ['/ai', '🤖', 'AI-асистент'],
  ['/fleet', '🚛', 'Флот'],
  ['/clients', '🏢', 'Клієнти'],
  ['/carriers', '🚚', 'Перевізники'],
  ['/payments', '💰', 'Платежі'],
  ['/reports', '📈', 'Звіти'],
  ['/settings', '⚙️', 'Налаштування'],
];

function Sidebar() {
  const { path } = useRouter();
  const active = (to) => to === '/' ? path === '/' : path.startsWith(to);
  return html`
    <aside className="hidden md:flex w-56 flex-col bg-sidebar text-slate-200">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="text-lg font-bold text-brand">Bakspeed</div>
        <div className="text-[10px] text-white/50 tracking-widest">SPEED YOU CAN TRUST</div>
      </div>
      <nav className="flex-1 py-3 space-y-1">
        ${NAV.map(([to, icon, label]) => html`
          <${Link} key=${to} to=${to}
            className=${`flex items-center gap-3 px-5 py-2 text-sm ${active(to) ? 'bg-brand text-white' : 'hover:bg-white/5'}`}>
            <span>${icon}</span><span>${label}</span>
          <//>
        `)}
      </nav>
      <div className="px-5 py-3 text-[10px] text-white/40 border-t border-white/10">v1 · Bakspeed Sp. z o.o.</div>
    </aside>
  `;
}

function TopBar() {
  const { profile, session, signOut } = useAuth();
  const [rate, setRate] = useState(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    sb.from('currency_rates')
      .select('rate, rate_date').eq('currency', 'EUR').eq('base_currency', 'PLN')
      .lte('rate_date', today).order('rate_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => data && setRate(data));
  }, []);
  return html`
    <header className="h-14 border-b bg-white flex items-center gap-4 px-5">
      <div className="flex-1"></div>
      <div className="numeric text-xs text-slate-500">
        ${rate ? `NBP: ${Number(rate.rate).toFixed(4)} PLN/EUR · ${rate.rate_date}` : 'NBP: —'}
      </div>
      <div className="hidden sm:block text-sm">${profile?.full_name || session?.user?.email || '—'}</div>
      <button onClick=${signOut} className="text-sm text-slate-600 hover:text-brand" title="Вийти">🚪</button>
    </header>
  `;
}

function Shell({ children }) {
  return html`
    <div className="flex h-screen w-full overflow-hidden">
      <${Sidebar} />
      <div className="flex flex-1 flex-col min-w-0">
        <${TopBar} />
        <main className="flex-1 overflow-auto">${children}</main>
      </div>
    </div>
  `;
}

// ========= Dashboard =========
function Dashboard() {
  const [kpi, setKpi] = useState(null);
  useEffect(() => { void (async () => {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7) + '-01';
    const [active, inTransit, month_, overdue] = await Promise.all([
      sb.from('orders').select('*', { count: 'exact', head: true }).not('status', 'in', '(draft,cancelled,paid)'),
      sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
      sb.from('monthly_totals').select('turnover_eur, delta_eur').eq('month', month).maybeSingle(),
      sb.from('orders').select('*', { count: 'exact', head: true }).eq('payment_received_client', false).lt('payment_due_date_client', today),
    ]);
    setKpi({
      active: active.count ?? 0,
      inTransit: inTransit.count ?? 0,
      turnover: month_.data?.turnover_eur ?? 0,
      delta: month_.data?.delta_eur ?? 0,
      overdue: overdue.count ?? 0,
    });
  })(); }, []);

  const K = ({ label, value, hint }) => html`
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm text-slate-500">${label}</div>
      <div className="mt-2 text-2xl font-semibold numeric">${value}</div>
      ${hint ? html`<div className="mt-1 text-xs text-slate-500">${hint}</div>` : null}
    </div>
  `;

  return html`
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Пульт</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <${K} label="Активні замовлення" value=${kpi?.active ?? '…'} />
        <${K} label="В дорозі" value=${kpi?.inTransit ?? '…'} />
        <${K} label="Оборот місяця" value=${EUR(kpi?.turnover)} hint=${`Маржа: ${EUR(kpi?.delta)}`} />
        <${K} label="Прострочено (клієнти)" value=${kpi?.overdue ?? '…'} />
      </div>
      <${RecentOrders} />
    </div>
  `;
}

function RecentOrders() {
  const [rows, setRows] = useState([]);
  useEffect(() => { void (async () => {
    const { data } = await sb.from('orders')
      .select('id, our_order_number, loading_date, unloading_date, loading_place, unloading_place, status, turnover_netto_eur, delta_netto_eur, client:clients(company_name), carrier:carriers(company_name)')
      .order('created_at', { ascending: false }).limit(10);
    setRows(data ?? []);
  })(); }, []);
  return html`
    <div className="rounded-xl border bg-white">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <div className="font-semibold">Останні замовлення</div>
        <${Link} to="/orders" className="text-sm text-brand hover:underline">Усі →<//>
      </div>
      <${OrdersTable} rows=${rows} />
    </div>
  `;
}

function StatusBadge({ status }) {
  return html`<span className=${`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_BADGE[status] || 'bg-slate-100'}`}>${STATUS_LABEL[status] || status}</span>`;
}

function OrdersTable({ rows, onEdit, onDelete }) {
  if (!rows.length) return html`<div className="p-6 text-sm text-slate-500">Немає даних</div>`;
  return html`
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
          <tr>
            <th className="text-left p-3">№</th>
            <th className="text-left p-3">Клієнт</th>
            <th className="text-left p-3">Маршрут</th>
            <th className="text-left p-3">Завант.</th>
            <th className="text-left p-3">Розв.</th>
            <th className="text-left p-3">Перевізник</th>
            <th className="text-right p-3">Оборот</th>
            <th className="text-right p-3">Маржа</th>
            <th className="text-left p-3">Статус</th>
            ${onEdit || onDelete ? html`<th className="p-3 w-28"></th>` : null}
          </tr>
        </thead>
        <tbody>
          ${rows.map((o) => html`
            <tr key=${o.id} className="border-t hover:bg-slate-50">
              <td className="p-3 font-mono text-xs">
                <${Link} to=${`/orders/${o.id}`} className="table-link">${o.our_order_number}<//>
              </td>
              <td className="p-3">${o.client?.company_name ?? '—'}</td>
              <td className="p-3 text-xs">${o.loading_place} → ${o.unloading_place}</td>
              <td className="p-3 text-xs">${DATE(o.loading_date)}</td>
              <td className="p-3 text-xs">${DATE(o.unloading_date)}</td>
              <td className="p-3">${o.carrier?.company_name ?? '—'}</td>
              <td className="p-3 text-right numeric">${EUR(o.turnover_netto_eur)}</td>
              <td className="p-3 text-right numeric">${EUR(o.delta_netto_eur)}</td>
              <td className="p-3"><${StatusBadge} status=${o.status} /></td>
              ${onEdit || onDelete ? html`
                <td className="p-3 text-right whitespace-nowrap">
                  ${onEdit ? html`<button onClick=${() => onEdit(o)} title="Редагувати" className="text-slate-600 hover:text-brand mr-3">✏️</button>` : null}
                  ${onDelete ? html`<button onClick=${() => onDelete(o)} title="Видалити" className="text-slate-600 hover:text-red-600">🗑</button>` : null}
                </td>
              ` : null}
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}

// Upload a PDF to orders-pdf bucket and call parse_pdf_order.
// Returns created order_id on success, throws on error.
async function uploadPdfAndParse(file, onStatus) {
  onStatus?.('Завантажую файл…');
  const path = `incoming/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
  const { error: upErr } = await sb.storage.from('orders-pdf').upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw new Error('Storage: ' + upErr.message);
  onStatus?.('AI розпізнає документ…');
  const { data, error } = await sb.functions.invoke('parse_pdf_order', { body: { storage_path: path, bucket: 'orders-pdf' } });
  if (error) {
    // Try to surface the function's JSON error body if present
    const bodyErr = data?.error || (error.context?.body ? await error.context.body.text().catch(() => null) : null);
    throw new Error(bodyErr || error.message || 'Невідома помилка Claude');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function PdfImportDialog({ onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast('Підтримуються тільки PDF', 'error'); return;
    }
    setBusy(true);
    try {
      const res = await uploadPdfAndParse(file, setStatus);
      toast(`Розпізнано: ${res.our_order_number}`, 'success');
      onDone(res.order_id);
    } catch (e) {
      toast(String(e.message ?? e), 'error');
    } finally {
      setBusy(false); setStatus('');
    }
  };

  return html`
    <${Drawer} title="Імпорт замовлення з PDF" onClose=${busy ? () => {} : onClose}>
      <div className="space-y-4 max-w-2xl">
        <div className="text-sm text-slate-600">
          Перетягніть сюди PDF-замовлення клієнта. AI розпізнає адреси завантаження/розвантаження,
          вантаж, дати, референції та суму. Замовлення буде створене зі статусом «Чернетка» —
          залишиться лише додати перевізника і ціну для нього.
        </div>

        <label
          onDragOver=${(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave=${() => setDragOver(false)}
          onDrop=${(e) => { e.preventDefault(); setDragOver(false); if (!busy) handle(e.dataTransfer.files?.[0]); }}
          className=${`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-brand bg-orange-50' : 'border-slate-300 hover:border-brand'} ${busy ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input type="file" accept="application/pdf,.pdf" className="hidden"
            disabled=${busy}
            onChange=${(e) => handle(e.target.files?.[0])} />
          ${busy ? html`
            <div className="flex flex-col items-center gap-2">
              <span className="loader" style=${{ width: 28, height: 28 }} />
              <div className="text-sm">${status || 'Обробка…'}</div>
              <div className="text-xs text-slate-500">Зазвичай 5–15 секунд</div>
            </div>
          ` : html`
            <div className="flex flex-col items-center gap-2">
              <div className="text-4xl">📄</div>
              <div className="font-medium">Перетягніть PDF або клацніть для вибору</div>
              <div className="text-xs text-slate-500">Підтримуються стандартні замовлення клієнта</div>
            </div>
          `}
        </label>

        <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
          💡 Після розпізнавання перевірте поля (особливо ціни й дати) — AI може помилятися.
          PDF буде прикріплений до замовлення у вкладці «Документи».
        </div>
      </div>
    <//>
  `;
}

// ========= Orders page (list + create + detail drawer) =========
function OrdersPage() {
  const { path, navigate } = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(null); // full order row or null

  const detailId = path.match(/^\/orders\/(.+)$/)?.[1];

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb.from('orders')
      .select('id, our_order_number, client_order_number, loading_date, unloading_date, loading_place, unloading_place, status, turnover_netto_eur, delta_netto_eur, client:clients(company_name), carrier:carriers(company_name), manager:managers!manager_id(code)')
      .order('loading_date', { ascending: false }).limit(300);
    if (status !== 'all') q = q.eq('status', status);
    if (search) q = q.or(`our_order_number.ilike.%${search}%,client_order_number.ilike.%${search}%`);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const openEdit = async (row) => {
    const { data, error } = await sb.from('orders').select('*').eq('id', row.id).maybeSingle();
    if (error) return toast(error.message, 'error');
    setEditing(data);
  };

  const del = async (row) => {
    if (!confirm(`Видалити ${row.our_order_number}?`)) return;
    const { error } = await sb.from('orders').delete().eq('id', row.id);
    if (error) return toast(error.message, 'error');
    toast('Видалено', 'success');
    if (detailId === row.id) navigate('/orders');
    load();
  };

  return html`
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Замовлення</h1>
        <div className="flex gap-2">
          <button onClick=${() => setImporting(true)}
            className="px-4 h-9 rounded-md border border-brand text-brand text-sm font-medium hover:bg-orange-50">📄 З PDF клієнта</button>
          <button onClick=${() => setCreating(true)}
            className="px-4 h-9 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark">+ Нове замовлення</button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3 flex flex-wrap gap-2 items-center">
        <input placeholder="№ замовлення…" value=${search} onChange=${(e) => setSearch(e.target.value)}
          className="h-9 px-3 rounded-md border border-slate-300 max-w-xs flex-1 min-w-[180px]" />
        <select value=${status} onChange=${(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          <option value="all">Усі статуси</option>
          ${Object.entries(STATUS_LABEL).map(([v, l]) => html`<option key=${v} value=${v}>${l}</option>`)}
        </select>
      </div>

      <div className="rounded-xl border bg-white">
        ${loading ? html`<div className="p-10 text-center"><span className="loader" /></div>` : html`<${OrdersTable} rows=${rows} onEdit=${openEdit} onDelete=${del} />`}
      </div>

      ${importing ? html`<${PdfImportDialog} onClose=${() => setImporting(false)} onDone=${(id) => { setImporting(false); load(); navigate(`/orders/${id}`); }} />` : null}
      ${creating ? html`<${OrderForm} onClose=${() => setCreating(false)} onSaved=${(id) => { setCreating(false); load(); navigate(`/orders/${id}`); }} />` : null}
      ${editing ? html`<${OrderForm} initial=${editing} onClose=${() => setEditing(null)} onSaved=${() => { setEditing(null); load(); }} />` : null}
      ${detailId ? html`<${OrderDetail} id=${detailId} onClose=${() => navigate('/orders')} onSaved=${load} onEdit=${openEdit} onDelete=${del} />` : null}
    </div>
  `;
}

function Drawer({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return html`
    <div className="drawer-backdrop" onClick=${onClose} />
    <div className="drawer">
      <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center gap-3 z-10">
        <button onClick=${onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        <div className="font-semibold">${title}</div>
      </div>
      <div className="p-5">${children}</div>
    </div>
  `;
}

// Geocode "DE 60486" (or "DE", "60486") via Nominatim → { city, lat, lng }
async function geocodePlace(code) {
  if (!code) return null;
  const parts = String(code).trim().match(/^([A-Za-z]{2})\s*([A-Za-z0-9\-\s]{2,})$/);
  if (!parts) return null;
  const country = parts[1].toUpperCase();
  const postal = parts[2].trim();
  try {
    const url = `https://nominatim.openstreetmap.org/search?country=${country}&postalcode=${encodeURIComponent(postal)}&format=json&addressdetails=1&limit=1&accept-language=uk,en`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!arr?.[0]) return null;
    const r = arr[0];
    const a = r.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || '';
    return { country, postal, city, lat: Number(r.lat), lng: Number(r.lon) };
  } catch (_) { return null; }
}

function OrderForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [refs, setRefs] = useState({ clients: [], carriers: [], managers: [], trucks: [] });
  const [form, setForm] = useState(() => initial ? { ...initial } : {
    client_currency: 'EUR', carrier_currency: 'EUR',
    payment_term_client_days: 30, payment_term_carrier_days: 60,
  });
  const [geoBusy, setGeoBusy] = useState({ loading: false, unloading: false });
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const updVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { void (async () => {
    const [c, cr, m, t] = await Promise.all([
      sb.from('clients').select('id, company_name').order('company_name'),
      sb.from('carriers').select('id, company_name, is_own_fleet').order('company_name'),
      sb.from('managers').select('id, code, full_name').eq('is_active', true),
      sb.from('trucks').select('id, name, carrier_id').eq('is_active', true),
    ]);
    setRefs({ clients: c.data ?? [], carriers: cr.data ?? [], managers: m.data ?? [], trucks: t.data ?? [] });
  })(); }, []);

  const resolveGeo = async (side, force = false) => {
    const placeKey = side + '_place';
    const code = form[placeKey];
    if (!code) return;
    // Don't re-geocode on blur if city already set (only force via 🔍 button)
    if (!force && form[side + '_city']) return;
    setGeoBusy((b) => ({ ...b, [side]: true }));
    const geo = await geocodePlace(code);
    setGeoBusy((b) => ({ ...b, [side]: false }));
    if (!geo) return toast('Не знайдено в OSM: ' + code, 'error');
    setForm((f) => ({
      ...f,
      [side + '_country']: geo.country,
      [side + '_post_code']: geo.postal,
      [side + '_city']: geo.city || f[side + '_city'] || '',
      [side + '_lat']: geo.lat,
      [side + '_lng']: geo.lng,
    }));
    toast(`${side === 'loading' ? 'Завантаження' : 'Розвантаження'}: ${geo.city || '?'} (${geo.country} ${geo.postal})`, 'success');
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    // Strip embedded/read-only/generated fields (come back from SELECT when editing)
    ['client', 'manager', 'carrier', 'truck', 'driver',
     'turnover_vat_original', 'turnover_brutto_original',
     'price_carrier_vat_original', 'price_carrier_brutto_original',
     'delta_netto_eur', 'price_per_km_eur',
     'our_order_number', 'created_at', 'updated_at', 'created_by']
      .forEach((k) => delete payload[k]);
    ['turnover_netto_original', 'price_carrier_netto_original', 'payment_term_client_days', 'payment_term_carrier_days', 'loading_lat', 'loading_lng', 'unloading_lat', 'unloading_lng']
      .forEach((k) => { if (payload[k] === '' || payload[k] == null) delete payload[k]; else payload[k] = Number(payload[k]); });
    ['loading_date', 'unloading_date'].forEach((k) => { if (!payload[k]) delete payload[k]; });

    if (isEdit) {
      const id = payload.id; delete payload.id;
      const { error } = await sb.from('orders').update(payload).eq('id', id);
      if (error) return toast(error.message, 'error');
      toast('Замовлення оновлено', 'success');
      onSaved(id);
    } else {
      delete payload.id;
      const { data, error } = await sb.from('orders').insert(payload).select('id').single();
      if (error) return toast(error.message, 'error');
      toast('Замовлення створено', 'success');
      onSaved(data.id);
    }
  };

  const inp = 'w-full h-9 px-3 rounded-md border border-slate-300';
  const lbl = 'block text-sm font-medium mb-1';

  return html`
    <${Drawer} title=${isEdit ? `Редагувати ${initial.our_order_number}` : 'Нове замовлення'} onClose=${onClose}>
      <form onSubmit=${save} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className=${lbl}>Клієнт</label>
            <select className=${inp} value=${form.client_id ?? ''} onChange=${upd('client_id')}>
              <option value="">—</option>
              ${refs.clients.map((c) => html`<option key=${c.id} value=${c.id}>${c.company_name}</option>`)}
            </select>
          </div>
          <div>
            <label className=${lbl}>Менеджер</label>
            <select className=${inp} value=${form.manager_id ?? ''} onChange=${upd('manager_id')}>
              <option value="">—</option>
              ${refs.managers.map((m) => html`<option key=${m.id} value=${m.id}>${m.code} · ${m.full_name}</option>`)}
            </select>
          </div>
          <div>
            <label className=${lbl}>Номер замовлення клієнта</label>
            <input className=${inp} value=${form.client_order_number ?? ''} onChange=${upd('client_order_number')} />
          </div>
          <div></div>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-semibold text-brand">🚛 Завантаження</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className=${lbl}>Країна + індекс</label>
              <div className="flex gap-1">
                <input className=${inp} placeholder="DE 60486" value=${form.loading_place ?? ''}
                  onChange=${upd('loading_place')}
                  onBlur=${() => resolveGeo('loading')} />
                <button type="button" onClick=${() => resolveGeo('loading', true)}
                  disabled=${geoBusy.loading}
                  className="h-9 px-2 rounded-md border text-sm whitespace-nowrap"
                  title="Знайти в OSM">🔍</button>
              </div>
            </div>
            <div>
              <label className=${lbl}>Місто ${geoBusy.loading ? html`<span className="loader" style=${{ width: 10, height: 10, borderWidth: 1.5 }}/>` : ''}</label>
              <input className=${inp} value=${form.loading_city ?? ''} onChange=${upd('loading_city')} />
            </div>
            <div>
              <label className=${lbl}>Дата</label>
              <input className=${inp} type="date" value=${form.loading_date ?? ''} onChange=${upd('loading_date')} />
            </div>
            <div className="md:col-span-3">
              <label className=${lbl}>Адреса (вулиця / назва об'єкта)</label>
              <input className=${inp} value=${form.loading_address ?? ''} onChange=${upd('loading_address')} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-semibold text-emerald-700">📦 Розвантаження</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className=${lbl}>Країна + індекс</label>
              <div className="flex gap-1">
                <input className=${inp} placeholder="AT 2282" value=${form.unloading_place ?? ''}
                  onChange=${upd('unloading_place')}
                  onBlur=${() => resolveGeo('unloading')} />
                <button type="button" onClick=${() => resolveGeo('unloading', true)}
                  disabled=${geoBusy.unloading}
                  className="h-9 px-2 rounded-md border text-sm whitespace-nowrap"
                  title="Знайти в OSM">🔍</button>
              </div>
            </div>
            <div>
              <label className=${lbl}>Місто ${geoBusy.unloading ? html`<span className="loader" style=${{ width: 10, height: 10, borderWidth: 1.5 }}/>` : ''}</label>
              <input className=${inp} value=${form.unloading_city ?? ''} onChange=${upd('unloading_city')} />
            </div>
            <div>
              <label className=${lbl}>Дата</label>
              <input className=${inp} type="date" value=${form.unloading_date ?? ''} onChange=${upd('unloading_date')} />
            </div>
            <div className="md:col-span-3">
              <label className=${lbl}>Адреса</label>
              <input className=${inp} value=${form.unloading_address ?? ''} onChange=${upd('unloading_address')} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className=${lbl}>Перевізник</label>
            <select className=${inp} value=${form.carrier_id ?? ''} onChange=${upd('carrier_id')}>
              <option value="">—</option>
              ${refs.carriers.map((c) => html`<option key=${c.id} value=${c.id}>${c.company_name}${c.is_own_fleet ? ' ✓' : ''}</option>`)}
            </select>
          </div>
          <div>
            <label className=${lbl}>Вантажівка</label>
            <select className=${inp} value=${form.truck_id ?? ''} onChange=${upd('truck_id')}>
              <option value="">—</option>
              ${refs.trucks.filter((t) => !form.carrier_id || t.carrier_id === form.carrier_id).map((t) => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}
            </select>
          </div>
          <div>
            <label className=${lbl}>Оборот netto (клієнт)</label>
            <div className="flex gap-2">
              <input className=${inp} type="number" step="0.01" value=${form.turnover_netto_original ?? ''} onChange=${upd('turnover_netto_original')} />
              <select className="h-9 w-24 rounded-md border border-slate-300 px-2" value=${form.client_currency} onChange=${upd('client_currency')}>
                <option>EUR</option><option>PLN</option>
              </select>
            </div>
          </div>
          <div>
            <label className=${lbl}>Ціна перевізнику netto</label>
            <div className="flex gap-2">
              <input className=${inp} type="number" step="0.01" value=${form.price_carrier_netto_original ?? ''} onChange=${upd('price_carrier_netto_original')} />
              <select className="h-9 w-24 rounded-md border border-slate-300 px-2" value=${form.carrier_currency} onChange=${upd('carrier_currency')}>
                <option>EUR</option><option>PLN</option>
              </select>
            </div>
          </div>
          <div>
            <label className=${lbl}>Payment term клієнта (дн)</label>
            <input className=${inp} type="number" value=${form.payment_term_client_days} onChange=${upd('payment_term_client_days')} />
          </div>
          <div>
            <label className=${lbl}>Payment term перевізнику (дн)</label>
            <input className=${inp} type="number" value=${form.payment_term_carrier_days} onChange=${upd('payment_term_carrier_days')} />
          </div>
          <div>
            <label className=${lbl}>Документи від клієнта</label>
            <select className=${inp} value=${form.client_docs_form ?? 'none'} onChange=${upd('client_docs_form')}>
              <option value="none">Ще не отримано</option>
              <option value="scans">Скани</option>
              <option value="originals">Оригінали</option>
              <option value="mixed">Змішано</option>
            </select>
          </div>
          <div>
            <label className=${lbl}>Документи від перевізника</label>
            <select className=${inp} value=${form.carrier_docs_form ?? 'none'} onChange=${upd('carrier_docs_form')}>
              <option value="none">Ще не отримано</option>
              <option value="scans">Скани</option>
              <option value="originals">Оригінали</option>
              <option value="mixed">Змішано</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" className="h-9 px-4 rounded-md bg-brand text-white font-medium">${isEdit ? 'Зберегти зміни' : 'Створити'}</button>
          <button type="button" onClick=${onClose} className="h-9 px-4 rounded-md border">Скасувати</button>
        </div>
      </form>
    </${Drawer}>
  `;
}

function OrderDetail({ id, onClose, onSaved, onEdit, onDelete }) {
  const [order, setOrder] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [tab, setTab] = useState('overview');
  const [events, setEvents] = useState([]);
  const [docs, setDocs] = useState([]);
  const [notes, setNotes] = useState([]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const { data, error } = await sb.from('orders')
        .select('*, client:clients(*), manager:managers!manager_id(*), carrier:carriers(*), truck:trucks(*), driver:drivers(*)')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Замовлення не знайдено (можливо прибрано RLS).');
      setOrder(data);
    } catch (e) {
      setLoadErr(String(e.message ?? e));
      toast('Картка замовлення: ' + (e.message ?? e), 'error');
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'timeline') sb.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }).limit(50).then(({ data }) => setEvents(data ?? []));
    if (tab === 'documents') sb.from('documents').select('*').eq('order_id', id).order('uploaded_at', { ascending: false }).then(({ data }) => setDocs(data ?? []));
    if (tab === 'messages') sb.from('notifications').select('*').eq('order_id', id).order('created_at', { ascending: false }).limit(50).then(({ data }) => setNotes(data ?? []));
  }, [tab, id]);

  const invoke = async (fn) => {
    const { data, error } = await sb.functions.invoke(fn, { body: { order_id: id } });
    if (error) return toast(error.message, 'error');
    toast(`${fn}: ${data?.ok ? 'OK' : 'готово'}`, 'success');
    await load(); onSaved?.();
  };

  const markStatus = async (status) => {
    await sb.from('orders').update({ status }).eq('id', id);
    await load(); onSaved?.();
    toast(`Статус: ${STATUS_LABEL[status]}`, 'success');
  };

  if (!order) return html`<${Drawer} title=${loadErr ? 'Помилка' : '...'} onClose=${onClose}>
    ${loadErr ? html`
      <div className="p-6 space-y-3">
        <div className="text-red-600 text-sm whitespace-pre-wrap">${loadErr}</div>
        <button onClick=${load} className="h-9 px-4 rounded-md bg-brand text-white text-sm">Спробувати ще</button>
      </div>
    ` : html`<div className="p-10 text-center"><span className="loader" /></div>`}
  <//>`;

  const R = ({ k, v }) => html`<div className="flex justify-between gap-4 text-sm py-1"><span className="text-slate-500">${k}</span><span className="font-medium text-right">${v ?? '—'}</span></div>`;
  const Tab = ({ id: tid, children }) => html`
    <button onClick=${() => setTab(tid)}
      className=${`px-3 py-1.5 text-sm rounded-md ${tab === tid ? 'bg-white shadow font-medium' : 'text-slate-600 hover:text-slate-900'}`}>${children}</button>
  `;

  return html`
    <${Drawer} title=${order.our_order_number} onClose=${onClose}>
      <div className="flex items-center gap-3 mb-3">
        <div className="font-mono text-xl">${order.our_order_number}</div>
        <${StatusBadge} status=${order.status} />
        <div className="text-sm text-slate-500 ml-3">${order.client?.company_name ?? '—'}</div>
      </div>

      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
        <${Tab} id="overview">Огляд<//>
        <${Tab} id="documents">Документи<//>
        <${Tab} id="timeline">Історія<//>
        <${Tab} id="messages">Повідомлення<//>
      </div>

      ${tab === 'overview' ? html`
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 bg-white">
            <div className="font-semibold mb-2">Завантаження</div>
            <${R} k="Місце" v=${[order.loading_place, order.loading_city, order.loading_address].filter(Boolean).join(' · ') || '—'} />
            <${R} k="Дата" v=${DATE(order.loading_date)} />
            <${R} k="Час" v=${`${order.loading_time_from ?? ''}–${order.loading_time_to ?? ''}`} />
            <${R} k="Reference" v=${order.loading_reference} />
            <${R} k="Контакт" v=${order.loading_contact_name} />
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="font-semibold mb-2">Розвантаження</div>
            <${R} k="Місце" v=${[order.unloading_place, order.unloading_city, order.unloading_address].filter(Boolean).join(' · ') || '—'} />
            <${R} k="Дата" v=${DATE(order.unloading_date)} />
            <${R} k="Час" v=${`${order.unloading_time_from ?? ''}–${order.unloading_time_to ?? ''}`} />
            <${R} k="Reference" v=${order.unloading_reference} />
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="font-semibold mb-2">Вантаж</div>
            <${R} k="Тип" v=${order.goods_type} />
            <${R} k="Вага" v=${order.weight_kg ? `${order.weight_kg} кг` : null} />
            <${R} k="LDM" v=${order.loading_meters} />
            <${R} k="ADR" v=${order.adr ? `так ${order.adr_class ?? ''}` : 'ні'} />
            <${R} k="Палети" v=${order.pallets_count ? `${order.pallets_count} × ${order.pallets_type}` : null} />
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="font-semibold mb-2">Виконавець</div>
            <${R} k="Перевізник" v=${order.carrier?.company_name} />
            <${R} k="Вантажівка" v=${order.truck?.name} />
            <${R} k="Плати" v=${order.truck ? `${order.truck.tractor_plate ?? ''} / ${order.truck.trailer_plate ?? ''}` : null} />
            <${R} k="Водій" v=${order.driver?.full_name} />
          </div>
          <div className="rounded-xl border p-4 bg-white numeric lg:col-span-2">
            <div className="font-semibold mb-2">Фінанси</div>
            <${R} k="Оборот (netto)" v=${`${CUR(order.turnover_netto_original, order.client_currency)} = ${EUR(order.turnover_netto_eur)}`} />
            <${R} k="Перевізнику (netto)" v=${`${CUR(order.price_carrier_netto_original, order.carrier_currency)} = ${EUR(order.price_carrier_netto_eur)}`} />
            <${R} k="Маржа" v=${EUR(order.delta_netto_eur)} />
            <${R} k="Курс NBP" v=${order.nbp_pln_per_eur ? `${order.nbp_pln_per_eur} PLN/EUR · ${order.nbp_rate_date}` : null} />
            <${R} k="Оплата клієнта" v=${`${DATE(order.payment_due_date_client)} · ${order.payment_received_client ? 'отримано' : 'очікується'}`} />
            <${R} k="Оплата перевізнику" v=${`${DATE(order.payment_due_date_carrier)} · ${order.paid_to_carrier ? 'сплачено' : 'очікується'}`} />
            <${R} k="Документи клієнта" v=${({ none: 'Ще не отримано', scans: '📄 Скани', originals: '📜 Оригінали', mixed: 'Змішано' })[order.client_docs_form ?? 'none']} />
            <${R} k="Документи перевізника" v=${({ none: 'Ще не отримано', scans: '📄 Скани', originals: '📜 Оригінали', mixed: 'Змішано' })[order.carrier_docs_form ?? 'none']} />
          </div>
        </div>
      ` : null}

      ${tab === 'documents' ? html`
        <div className="space-y-2">
          ${docs.length === 0 ? html`<div className="text-sm text-slate-500">Немає документів</div>` : docs.map((d) => html`
            <div key=${d.id} className="flex items-center gap-3 border rounded-lg p-3 bg-white">
              <div className="flex-1 truncate">
                <div className="text-sm font-medium truncate">${d.file_name ?? d.file_path}</div>
                <div className="text-xs text-slate-500">${d.kind} · ${d.size_bytes ? (d.size_bytes / 1024).toFixed(0) + ' КБ' : ''}</div>
              </div>
            </div>
          `)}
        </div>
      ` : null}

      ${tab === 'timeline' ? html`
        <ol className="border-l pl-4 space-y-3">
          ${events.length === 0 ? html`<div className="text-sm text-slate-500">Немає подій</div>` : events.map((e) => html`
            <li key=${e.id}>
              <div className="text-sm font-medium">${e.event_type}</div>
              <div className="text-xs text-slate-500">${DATE(e.created_at)} ${new Date(e.created_at).toLocaleTimeString('uk-UA')}</div>
              ${e.new_value ? html`<pre className="text-xs bg-slate-50 p-2 rounded mt-1 overflow-auto">${JSON.stringify(e.new_value, null, 2)}</pre>` : null}
            </li>
          `)}
        </ol>
      ` : null}

      ${tab === 'messages' ? html`
        <div className="space-y-2">
          ${notes.length === 0 ? html`<div className="text-sm text-slate-500">Повідомлень не було</div>` : notes.map((n) => html`
            <div key=${n.id} className="border rounded-lg p-3 bg-white">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-slate-100 rounded">${n.channel}</span>
                <span className=${`px-2 py-0.5 rounded ${n.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : n.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>${n.status}</span>
                <span className="text-slate-500 numeric">${DATE(n.created_at)}</span>
              </div>
              ${n.subject ? html`<div className="font-medium text-sm mt-1">${n.subject}</div>` : null}
              <div className="text-sm whitespace-pre-wrap mt-1">${n.body}</div>
              ${n.error_message ? html`<div className="text-xs text-red-600 mt-1">${n.error_message}</div>` : null}
            </div>
          `)}
        </div>
      ` : null}

      <hr className="my-4" />
      <div className="flex flex-wrap gap-2">
        ${onEdit ? html`<button onClick=${() => onEdit(order)} className="h-9 px-3 rounded-md bg-slate-800 text-white text-sm">✏️ Редагувати</button>` : null}
        <button onClick=${() => invoke('generate_driver_brief')} className="h-9 px-3 rounded-md bg-brand text-white text-sm">📱 Driver Brief</button>
        ${!order.carrier?.is_own_fleet ? html`
          <button onClick=${() => invoke('generate_carrier_order_pdf')} className="h-9 px-3 rounded-md border text-sm">📄 PDF перевізнику</button>
        ` : null}
        <button onClick=${() => invoke('fleethand_build_route')} className="h-9 px-3 rounded-md border text-sm">🗺️ Маршрут</button>
        <button onClick=${() => invoke('saldeo_create_invoice')}
          disabled=${!['delivered', 'documents_received'].includes(order.status)}
          className="h-9 px-3 rounded-md border text-sm">🧾 Фактура (Saldeo)</button>
        <button onClick=${() => markStatus('delivered')} className="h-9 px-3 rounded-md border text-sm">✓ Delivered</button>
        <button onClick=${() => markStatus('paid')} className="h-9 px-3 rounded-md border text-sm">💰 Paid</button>
        ${onDelete ? html`<button onClick=${() => onDelete(order)} className="h-9 px-3 rounded-md border border-red-300 text-red-700 hover:bg-red-50 text-sm ml-auto">🗑 Видалити</button>` : null}
      </div>
    <//>
  `;
}

// ========= Generic CRUD page =========
function CrudPage({ title, table, columns, searchField, defaultOrder = 'created_at' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // object or null
  const [fkOpts, setFkOpts] = useState({}); // { columnKey: [{value,label}] }

  // Load FK options once
  useEffect(() => { void (async () => {
    const fkCols = columns.filter((c) => c.fk);
    if (!fkCols.length) return;
    const out = {};
    for (const c of fkCols) {
      const { data } = await sb.from(c.fk.table).select(`id, ${c.fk.label}`).order(c.fk.label);
      out[c.key] = (data ?? []).map((r) => ({ value: r.id, label: r[c.fk.label] }));
    }
    setFkOpts(out);
  })(); }, [columns]);

  const fkLabel = (colKey, value) => fkOpts[colKey]?.find((o) => o.value === value)?.label ?? value;

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb.from(table).select('*').order(defaultOrder, { ascending: false }).limit(500);
    if (search && searchField) q = q.ilike(searchField, `%${search}%`);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }, [table, search, searchField, defaultOrder]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload = { ...editing };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (payload.id) {
      const id = payload.id; delete payload.id;
      const { error } = await sb.from(table).update(payload).eq('id', id);
      if (error) return toast(error.message, 'error');
    } else {
      delete payload.id;
      const { error } = await sb.from(table).insert(payload);
      if (error) return toast(error.message, 'error');
    }
    toast('Збережено', 'success');
    setEditing(null);
    load();
  };
  const del = async (id) => {
    if (!confirm('Видалити?')) return;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Видалено', 'success');
    load();
  };

  return html`
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">${title}</h1>
        <div className="flex gap-2">
          ${searchField ? html`<input placeholder="Пошук…" value=${search} onChange=${(e) => setSearch(e.target.value)} className="h-9 px-3 rounded-md border border-slate-300 w-60" />` : null}
          <button onClick=${() => setEditing({})} className="h-9 px-4 rounded-md bg-brand text-white text-sm font-medium">+ Новий</button>
        </div>
      </div>
      <div className="rounded-xl border bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>${columns.map((c) => html`<th key=${c.key} className="text-left p-3">${c.label}</th>`)}<th></th></tr>
          </thead>
          <tbody>
            ${loading ? html`<tr><td colSpan=${columns.length + 1} className="p-10 text-center"><span className="loader" /></td></tr>` :
              rows.length === 0 ? html`<tr><td colSpan=${columns.length + 1} className="p-6 text-center text-slate-500">Немає даних</td></tr>` :
              rows.map((r) => html`
                <tr key=${r.id} className="border-t hover:bg-slate-50">
                  ${columns.map((c) => html`<td key=${c.key} className="p-3">
                    ${c.render ? c.render(r[c.key], r) : (c.fk ? (fkLabel(c.key, r[c.key]) ?? '—') : (r[c.key] ?? '—'))}
                  </td>`)}
                  <td className="p-3 text-right">
                    <button onClick=${() => setEditing(r)} className="text-xs text-brand mr-2">✏️</button>
                    <button onClick=${() => del(r.id)} className="text-xs text-red-600">🗑</button>
                  </td>
                </tr>
              `)}
          </tbody>
        </table>
      </div>

      ${editing !== null ? html`
        <${Drawer} title=${editing.id ? 'Редагувати' : 'Новий запис'} onClose=${() => setEditing(null)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${columns.map((c) => {
              const opts = c.fk ? (fkOpts[c.key] ?? []) : c.options;
              return html`
                <div key=${c.key} className="space-y-1">
                  <label className="text-sm font-medium">${c.label}</label>
                  ${opts ? html`
                    <select value=${editing[c.key] ?? ''} onChange=${(e) => setEditing((v) => ({ ...v, [c.key]: e.target.value || null }))}
                      className="w-full h-9 px-3 rounded-md border border-slate-300">
                      <option value="">—</option>
                      ${opts.map((o) => html`<option key=${String(o.value)} value=${o.value}>${o.label}</option>`)}
                    </select>
                  ` : c.type === 'boolean' ? html`
                    <input type="checkbox" checked=${Boolean(editing[c.key])}
                      onChange=${(e) => setEditing((v) => ({ ...v, [c.key]: e.target.checked }))} />
                  ` : html`
                    <input type=${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                      value=${editing[c.key] ?? ''} onChange=${(e) => setEditing((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full h-9 px-3 rounded-md border border-slate-300" />
                  `}
                </div>
              `;
            })}
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick=${save} className="h-9 px-4 rounded-md bg-brand text-white">Зберегти</button>
            <button onClick=${() => setEditing(null)} className="h-9 px-4 rounded-md border">Скасувати</button>
          </div>
        <//>
      ` : null}
    </div>
  `;
}

// ========= CRUD configs =========
function ClientsPage() {
  return html`<${CrudPage} title="Клієнти" table="clients" searchField="company_name" columns=${[
    { key: 'company_name', label: 'Компанія' },
    { key: 'nip', label: 'NIP' },
    { key: 'country', label: 'Країна' },
    { key: 'city', label: 'Місто' },
    { key: 'default_currency', label: 'Валюта', options: [{ value: 'EUR', label: 'EUR' }, { value: 'PLN', label: 'PLN' }] },
    { key: 'default_payment_term_days', label: 'Термін, дн', type: 'number' },
  ]} />`;
}
function CarriersPage() {
  return html`<${CrudPage} title="Перевізники" table="carriers" searchField="company_name" columns=${[
    { key: 'company_name', label: 'Компанія' },
    { key: 'nip', label: 'NIP' },
    { key: 'country', label: 'Країна' },
    { key: 'is_own_fleet', label: 'Власний', type: 'boolean', render: (v) => v ? '✓' : '' },
    { key: 'default_payment_term_days', label: 'Термін, дн', type: 'number' },
    { key: 'default_currency', label: 'Валюта', options: [{ value: 'EUR', label: 'EUR' }, { value: 'PLN', label: 'PLN' }] },
    { key: 'ocp_insurance_expiry', label: 'OCP до', type: 'date' },
    { key: 'ocp_insurance_sum_eur', label: 'OCP, €', type: 'number' },
  ]} />`;
}

// ========= Fleet =========
function FleetPage() {
  const [trucks, setTrucks] = useState([]);
  const [stats, setStats] = useState({});
  useEffect(() => { void (async () => {
    const { data: ts } = await sb.from('trucks').select('id, name, tractor_plate, trailer_plate, body_type, carrier:carriers(id, company_name, is_own_fleet)').eq('is_active', true).order('name');
    setTrucks(ts ?? []);
    const month = new Date().toISOString().slice(0, 7) + '-01';
    const { data: ss } = await sb.from('truck_month_stats').select('*').eq('month', month);
    setStats(Object.fromEntries((ss ?? []).map((s) => [s.truck_id, s])));
  })(); }, []);
  const own = trucks.filter((t) => t.carrier?.is_own_fleet);
  const ext = trucks.filter((t) => !t.carrier?.is_own_fleet);
  const Card = ({ t }) => {
    const s = stats[t.id] || {};
    return html`
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="font-mono font-semibold">${t.name}</div>
          ${t.carrier?.is_own_fleet ? html`<span className="text-xs px-1.5 py-0.5 bg-brand/10 text-brand rounded">Own</span>` : null}
          <span className="text-xs text-slate-500">${t.body_type ?? '—'}</span>
        </div>
        <div className="text-xs text-slate-500">${t.tractor_plate} / ${t.trailer_plate}</div>
        <div className="text-xs">${t.carrier?.company_name}</div>
        <div className="text-sm numeric mt-3 space-y-1">
          <div className="flex justify-between"><span>Замовлень</span><span>${s.orders_count ?? 0}</span></div>
          <div className="flex justify-between"><span>Всього км</span><span>${s.total_km ?? 0}</span></div>
          <div className="flex justify-between"><span>Оборот</span><span>${EUR(s.turnover_eur)}</span></div>
          <div className="flex justify-between"><span>Маржа</span><span>${EUR(s.delta_eur)}</span></div>
          <div className="flex justify-between"><span>€/км</span><span>${s.eur_per_km ? Number(s.eur_per_km).toFixed(2) : '—'}</span></div>
        </div>
      </div>
    `;
  };
  return html`
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Флот</h1>
      <section>
        <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Власний</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${own.map((t) => html`<${Card} key=${t.id} t=${t} />`)}</div>
      </section>
      <section>
        <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Залучений</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${ext.map((t) => html`<${Card} key=${t.id} t=${t} />`)}</div>
      </section>
    </div>
  `;
}

// ========= Payments =========
function PaymentsPage() {
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  useEffect(() => { void (async () => {
    const [r, p] = await Promise.all([
      sb.from('orders').select('id, our_order_number, payment_due_date_client, turnover_netto_original, client_currency, client:clients(company_name)').eq('payment_received_client', false).not('payment_due_date_client', 'is', null).order('payment_due_date_client').limit(200),
      sb.from('orders').select('id, our_order_number, payment_due_date_carrier, price_carrier_netto_original, carrier_currency, carrier:carriers(company_name, whitelist_status)').eq('paid_to_carrier', false).not('payment_due_date_carrier', 'is', null).order('payment_due_date_carrier').limit(200),
    ]);
    setReceivables(r.data ?? []); setPayables(p.data ?? []);
  })(); }, []);
  const sev = (d) => d == null ? 'bg-slate-100' : d > 7 ? 'bg-emerald-100 text-emerald-700' : d >= 0 ? 'bg-amber-100 text-amber-700' : d > -7 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  const Table = ({ rows, kind }) => html`
    <div className="rounded-xl border bg-white overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500 bg-slate-50">
          <tr>
            <th className="text-left p-3">№</th>
            <th className="text-left p-3">${kind === 'r' ? 'Клієнт' : 'Перевізник'}</th>
            <th className="text-right p-3">Сума</th>
            <th className="text-right p-3">Термін</th>
            <th className="text-right p-3">Днів</th>
            ${kind === 'p' ? html`<th className="text-left p-3">Whitelist</th>` : null}
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colSpan="6" className="p-6 text-center text-slate-500">Немає</td></tr>` : rows.map((o) => {
            const d = daysUntil(kind === 'r' ? o.payment_due_date_client : o.payment_due_date_carrier);
            return html`
              <tr key=${o.id} className="border-t">
                <td className="p-3"><${Link} to=${`/orders/${o.id}`} className="font-mono text-xs table-link">${o.our_order_number}<//></td>
                <td className="p-3">${kind === 'r' ? o.client?.company_name : o.carrier?.company_name}</td>
                <td className="p-3 text-right numeric">${CUR(kind === 'r' ? o.turnover_netto_original : o.price_carrier_netto_original, kind === 'r' ? o.client_currency : o.carrier_currency)}</td>
                <td className="p-3 text-right text-xs">${DATE(kind === 'r' ? o.payment_due_date_client : o.payment_due_date_carrier)}</td>
                <td className="p-3 text-right"><span className=${`inline-flex px-2 py-0.5 text-xs rounded ${sev(d)}`}>${d ?? '—'}</span></td>
                ${kind === 'p' ? html`<td className="p-3"><span className=${`text-xs px-2 py-0.5 rounded ${o.carrier?.whitelist_status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>${o.carrier?.whitelist_status ?? '—'}</span></td>` : null}
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
  return html`
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Платежі</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div><div className="font-semibold mb-2">Нам винні</div><${Table} rows=${receivables} kind="r" /></div>
        <div><div className="font-semibold mb-2">Ми винні</div><${Table} rows=${payables} kind="p" /></div>
      </div>
    </div>
  `;
}

// ========= Reports =========
function ReportsPage() {
  const [monthly, setMonthly] = useState([]);
  const [byClient, setByClient] = useState([]);
  const [byManager, setByManager] = useState([]);
  useEffect(() => { void (async () => {
    const month = new Date().toISOString().slice(0, 7) + '-01';
    const [m, c, mg] = await Promise.all([
      sb.from('monthly_totals').select('*').order('month'),
      sb.from('client_month_stats').select('*').eq('month', month).order('turnover_eur', { ascending: false }).limit(15),
      sb.from('manager_month_stats').select('*').eq('month', month),
    ]);
    setMonthly(m.data ?? []); setByClient(c.data ?? []); setByManager(mg.data ?? []);
  })(); }, []);
  const totalT = monthly.reduce((s, r) => s + Number(r.turnover_eur || 0), 0);
  const totalD = monthly.reduce((s, r) => s + Number(r.delta_eur || 0), 0);
  return html`
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Звіти</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5"><div className="text-sm text-slate-500">Оборот YTD</div><div className="text-2xl font-semibold numeric mt-1">${EUR(totalT)}</div></div>
        <div className="rounded-xl border bg-white p-5"><div className="text-sm text-slate-500">Маржа YTD</div><div className="text-2xl font-semibold numeric mt-1">${EUR(totalD)}</div></div>
        <div className="rounded-xl border bg-white p-5"><div className="text-sm text-slate-500">Середня маржа</div><div className="text-2xl font-semibold numeric mt-1">${totalT ? ((totalD / totalT) * 100).toFixed(1) : '—'}%</div></div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="font-semibold mb-3">Оборот по місяцях</div>
        <div className="space-y-2">
          ${monthly.length === 0 ? html`<div className="text-sm text-slate-500">Немає даних</div>` : monthly.map((r) => {
            const pct = totalT ? (Number(r.turnover_eur || 0) / Math.max(...monthly.map((x) => Number(x.turnover_eur || 0)))) * 100 : 0;
            return html`
              <div key=${r.month} className="flex items-center gap-3 text-sm">
                <div className="w-20 text-slate-500 numeric">${String(r.month).slice(0, 7)}</div>
                <div className="flex-1 bg-slate-100 h-6 rounded overflow-hidden relative">
                  <div className="h-full bg-brand" style=${{ width: `${pct}%` }}></div>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">${EUR(r.turnover_eur)}</span>
                </div>
                <div className="w-24 text-right numeric text-emerald-700">${EUR(r.delta_eur)}</div>
              </div>
            `;
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-5">
          <div className="font-semibold mb-3">Топ клієнтів (цей місяць)</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="text-left pb-2">Клієнт</th><th className="text-right">К-сть</th><th className="text-right">Оборот</th><th className="text-right">Маржа</th></tr></thead>
            <tbody className="numeric">
              ${byClient.map((r) => html`<tr key=${r.client_id} className="border-t"><td className="py-1.5">${r.company_name}</td><td className="text-right">${r.orders_count}</td><td className="text-right">${EUR(r.turnover_eur)}</td><td className="text-right">${EUR(r.delta_eur)}</td></tr>`)}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="font-semibold mb-3">Менеджери</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="text-left pb-2">Код</th><th className="text-right">К-сть</th><th className="text-right">Оборот</th><th className="text-right">Маржа</th><th className="text-right">%</th></tr></thead>
            <tbody className="numeric">
              ${byManager.map((r) => html`<tr key=${r.manager_id} className="border-t"><td className="py-1.5">${r.manager_code}</td><td className="text-right">${r.orders_count}</td><td className="text-right">${EUR(r.turnover_eur)}</td><td className="text-right">${EUR(r.delta_eur)}</td><td className="text-right">${r.margin_ratio ? (Number(r.margin_ratio) * 100).toFixed(1) : '—'}%</td></tr>`)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ========= AI Assistant =========
function AiPage() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setMsgs((m) => [...m, { role: 'user', content }]);
    setInput('');
    setBusy(true);
    const { data, error } = await sb.functions.invoke('ai_assistant', { body: { message: content, history: msgs } });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    setMsgs((m) => [...m, { role: 'assistant', content: data?.reply ?? '…' }]);
  };

  const QUICK = ['Прострочені платежі', 'Вільні машини сьогодні', 'Курс NBP EUR/PLN', 'Скільки заробила BAKS1 у березні'];

  return html`
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4 h-full">
      <div className="rounded-xl border bg-white flex flex-col h-[calc(100vh-140px)]">
        <div className="flex-1 overflow-auto p-4 space-y-3">
          ${msgs.length === 0 ? html`<div className="text-sm text-slate-500">Напишіть запит або оберіть швидку дію.</div>` :
            msgs.map((m, i) => html`
              <div key=${i} className=${`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
                <div className=${`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand text-white' : 'bg-slate-100'}`}>${m.content}</div>
              </div>
            `)}
          ${busy ? html`<div className="text-sm text-slate-500 flex gap-2 items-center"><span className="loader" /> AI думає…</div>` : null}
        </div>
        <div className="border-t p-3 flex gap-2">
          <textarea rows="2" value=${input} onChange=${(e) => setInput(e.target.value)}
            onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Введіть запит…"
            className="flex-1 px-3 py-2 rounded-md border border-slate-300 text-sm" />
          <button onClick=${() => send()} disabled=${busy} className="h-9 px-4 rounded-md bg-brand text-white self-end">▶</button>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div className="font-medium text-sm mb-2">Швидкі дії</div>
        ${QUICK.map((q) => html`<button key=${q} onClick=${() => send(q)} className="w-full text-left text-sm border rounded-md px-3 py-2 hover:bg-slate-50">${q}</button>`)}
      </div>
    </div>
  `;
}

// ========= Managers (owner-only auth user creation) =========
function ManagersPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ role: 'manager' });
  const isOwner = profile?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from('managers').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.email || !form.password || !form.code || !form.full_name) {
      return toast('Email, пароль, код і ім\'я — обов\'язкові', 'error');
    }
    const { data, error } = await sb.functions.invoke('admin_create_manager', { body: form });
    if (error) return toast(error.message, 'error');
    if (data?.error) return toast(data.error, 'error');
    toast('Менеджера створено', 'success');
    setCreating(false);
    setForm({ role: 'manager' });
    load();
  };

  const toggleActive = async (m) => {
    const { error } = await sb.from('managers').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) return toast(error.message, 'error');
    load();
  };

  const inp = 'w-full h-9 px-3 rounded-md border border-slate-300';

  return html`
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Менеджери (${rows.length})</h2>
        ${isOwner ? html`
          <button onClick=${() => setCreating(true)} className="h-9 px-4 rounded-md bg-brand text-white text-sm font-medium">+ Новий менеджер</button>
        ` : html`<div className="text-xs text-slate-500">Створювати може лише owner</div>`}
      </div>

      <div className="rounded-xl border bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500 bg-slate-50">
            <tr>
              <th className="text-left p-3">Код</th>
              <th className="text-left p-3">Ім'я</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Телефон</th>
              <th className="text-left p-3">Telegram</th>
              <th className="text-left p-3">Роль</th>
              <th className="text-left p-3">Auth</th>
              <th className="text-center p-3">Активний</th>
            </tr>
          </thead>
          <tbody>
            ${loading ? html`<tr><td colSpan="8" className="p-10 text-center"><span className="loader" /></td></tr>` :
              rows.length === 0 ? html`<tr><td colSpan="8" className="p-6 text-center text-slate-500">Немає</td></tr>` :
              rows.map((m) => html`
                <tr key=${m.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono">${m.code}</td>
                  <td className="p-3">${m.full_name}</td>
                  <td className="p-3">${m.email ?? '—'}</td>
                  <td className="p-3">${m.phone ?? '—'}</td>
                  <td className="p-3">${m.telegram_chat_id ?? '—'}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-slate-100">${m.role}</span></td>
                  <td className="p-3 text-xs">${m.user_id ? html`<span className="text-emerald-700">✓ прив'язано</span>` : html`<span className="text-slate-400">не прив'язано</span>`}</td>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked=${m.is_active} disabled=${!isOwner} onChange=${() => toggleActive(m)} />
                  </td>
                </tr>
              `)}
          </tbody>
        </table>
      </div>

      ${creating ? html`
        <${Drawer} title="Новий менеджер" onClose=${() => { setCreating(false); setForm({ role: 'manager' }); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Код *</label>
              <input className=${inp} placeholder="SK" value=${form.code ?? ''} onChange=${(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ім'я *</label>
              <input className=${inp} value=${form.full_name ?? ''} onChange=${(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <input className=${inp} type="email" value=${form.email ?? ''} onChange=${(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Пароль *</label>
              <input className=${inp} type="text" value=${form.password ?? ''} onChange=${(e) => setForm({ ...form, password: e.target.value })} placeholder="мін 6 символів" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Телефон</label>
              <input className=${inp} value=${form.phone ?? ''} onChange=${(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telegram chat_id</label>
              <input className=${inp} value=${form.telegram_chat_id ?? ''} onChange=${(e) => setForm({ ...form, telegram_chat_id: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Роль</label>
              <select className=${inp} value=${form.role} onChange=${(e) => setForm({ ...form, role: e.target.value })}>
                <option value="manager">manager — звичайний диспетчер</option>
                <option value="accountant">accountant — бухгалтер (платежі, фактури)</option>
                <option value="viewer">viewer — лише перегляд</option>
                <option value="owner">owner — повні права</option>
              </select>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-md p-2">
            💡 Менеджер зможе увійти за вказаним email + паролем. Пароль можна буде змінити після першого входу у «Мій профіль».
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick=${create} className="h-9 px-4 rounded-md bg-brand text-white">Створити</button>
            <button onClick=${() => { setCreating(false); setForm({ role: 'manager' }); }} className="h-9 px-4 rounded-md border">Скасувати</button>
          </div>
        <//>
      ` : null}
    </div>
  `;
}

// ========= My profile / change password =========
function ProfilePanel() {
  const { session, profile } = useAuth();
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (newPass.length < 6) return toast('Пароль мін. 6 символів', 'error');
    if (newPass !== newPass2) return toast('Паролі не збігаються', 'error');
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Пароль змінено', 'success');
    setNewPass(''); setNewPass2('');
  };

  const inp = 'w-full h-9 px-3 rounded-md border border-slate-300';

  return html`
    <div className="rounded-xl border bg-white p-5 text-sm space-y-3 max-w-lg">
      <div className="font-semibold">Мій профіль</div>
      <div className="text-xs text-slate-500 space-y-0.5">
        <div><b>Email:</b> ${session?.user?.email}</div>
        <div><b>Код менеджера:</b> ${profile?.code ?? '—'}</div>
        <div><b>Ім'я:</b> ${profile?.full_name ?? '—'}</div>
        <div><b>Роль:</b> ${profile?.role ?? '—'}</div>
      </div>
      <hr />
      <div className="font-semibold">Змінити пароль</div>
      <div className="space-y-2">
        <input type="password" className=${inp} placeholder="Новий пароль (мін 6)" value=${newPass} onChange=${(e) => setNewPass(e.target.value)} />
        <input type="password" className=${inp} placeholder="Повторіть пароль" value=${newPass2} onChange=${(e) => setNewPass2(e.target.value)} />
        <button onClick=${change} disabled=${busy} className="h-9 px-4 rounded-md bg-brand text-white">${busy ? 'Зачекайте…' : 'Змінити пароль'}</button>
      </div>
    </div>
  `;
}

// ========= Settings =========
function SettingsPage() {
  const [tab, setTab] = useState('company');
  const Tab = ({ id: tid, children }) => html`<button onClick=${() => setTab(tid)} className=${`px-3 py-1.5 text-sm rounded-md ${tab === tid ? 'bg-white shadow font-medium' : 'text-slate-600'}`}>${children}</button>`;
  return html`
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Налаштування</h1>
      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
        <${Tab} id="profile">Мій профіль<//>
        <${Tab} id="company">Реквізити<//>
        <${Tab} id="managers">Користувачі<//>
        <${Tab} id="trucks">Вантажівки<//>
        <${Tab} id="drivers">Водії<//>
        <${Tab} id="templates">Шаблони<//>
        <${Tab} id="penalties">Warunki<//>
      </div>
      ${tab === 'profile' ? html`<${ProfilePanel} />` : null}
      ${tab === 'company' ? html`
        <div className="rounded-xl border bg-white p-5 text-sm space-y-2">
          <div className="font-semibold text-lg">Bakspeed Sp. z o.o.</div>
          <div><b>Адреса:</b> Henryka Sienkiewicza 22/618, 60-818 Poznań, Poland</div>
          <div><b>NIP:</b> 7812023271 · <b>KRS:</b> 0000911850 · <b>REGON:</b> 389468581</div>
          <div><b>TIMOCOM ID:</b> 436346</div>
          <div><b>Bank:</b> Santander Bank Polska S.A. · BIC WBKPPLPPXXX</div>
          <div><b>IBAN EUR:</b> PL46 1090 1362 0000 0001 4837 7635</div>
          <div><b>IBAN PLN:</b> PL64 1090 1362 0000 0001 4837 7602</div>
          <div className="text-xs text-slate-500 mt-4 tracking-widest">SPEED YOU CAN TRUST</div>
        </div>
      ` : null}
      ${tab === 'managers' ? html`<${ManagersPage} />` : null}
      ${tab === 'trucks' ? html`<${CrudPage} title="Вантажівки" table="trucks" searchField="name" columns=${[
        { key: 'name', label: 'Код' },
        { key: 'carrier_id', label: 'Перевізник', fk: { table: 'carriers', label: 'company_name' } },
        { key: 'tractor_plate', label: 'Тягач' }, { key: 'trailer_plate', label: 'Причіп' },
        { key: 'body_type', label: 'Кузов' }, { key: 'capacity_kg', label: 'Вант., кг', type: 'number' },
        { key: 'has_adr_equipment', label: 'ADR', type: 'boolean' },
        { key: 'is_active', label: 'Активна', type: 'boolean' },
      ]} />` : null}
      ${tab === 'drivers' ? html`<${CrudPage} title="Водії" table="drivers" searchField="full_name" columns=${[
        { key: 'full_name', label: 'Ім\'я' }, { key: 'phone', label: 'Телефон' },
        { key: 'carrier_id', label: 'Перевізник', fk: { table: 'carriers', label: 'company_name' } },
        { key: 'current_truck_id', label: 'Вантажівка', fk: { table: 'trucks', label: 'name' } },
        { key: 'licence_number', label: 'Права №' },
        { key: 'licence_expiry', label: 'Права до', type: 'date' },
        { key: 'has_adr_cert', label: 'ADR', type: 'boolean' },
        { key: 'adr_cert_expiry', label: 'ADR до', type: 'date' },
        { key: 'is_active', label: 'Активний', type: 'boolean' },
      ]} />` : null}
      ${tab === 'templates' ? html`<${CrudPage} title="Шаблони повідомлень" table="notification_templates" searchField="code" columns=${[
        { key: 'code', label: 'Код' },
        { key: 'channel', label: 'Канал', options: [{ value: 'email', label: 'email' }, { value: 'telegram', label: 'telegram' }, { value: 'sms', label: 'sms' }, { value: 'whatsapp', label: 'whatsapp' }] },
        { key: 'language', label: 'Мова' }, { key: 'subject', label: 'Тема' }, { key: 'body', label: 'Текст' },
      ]} />` : null}
      ${tab === 'penalties' ? html`<${CrudPage} title="Warunki 39 пунктів" table="penalty_rules" defaultOrder="warunki_point" columns=${[
        { key: 'warunki_point', label: '#', type: 'number' },
        { key: 'title', label: 'Правило' },
        { key: 'penalty_amount_eur', label: 'Сума €', type: 'number' },
        { key: 'trigger_type', label: 'Тригер' },
        { key: 'is_auto', label: 'Авто', type: 'boolean' },
      ]} />` : null}
    </div>
  `;
}

// ========= Driver webview =========
function DriverWebview({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { void (async () => {
    const { data: d } = await sb.rpc('driver_webview_get', { p_token: token });
    if (d?.error) setErr(d.error); else setData(d);
  })(); }, [token]);
  const setStatus = async (status) => {
    const { data: d } = await sb.rpc('driver_webview_mark_status', { p_token: token, p_status: status });
    if (d?.error) toast(d.error, 'error'); else toast('Оновлено', 'success');
  };
  if (err) return html`<div className="min-h-screen grid place-items-center">Посилання недійсне або прострочене.</div>`;
  if (!data) return html`<div className="min-h-screen grid place-items-center"><span className="loader" /></div>`;
  const o = data.order;
  return html`
    <div className="min-h-screen p-4 max-w-md mx-auto space-y-3">
      <div className="rounded-xl bg-brand text-white p-4">
        <div className="text-xs opacity-75">Замовлення</div>
        <div className="text-xl font-bold font-mono">${o.our_order_number}</div>
        <div className="text-xs mt-1">${data.truck?.name} · ${data.truck?.tractor_plate}</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm border">
        <div className="font-semibold mb-2">🚛 Завантаження</div>
        <div className="text-sm">${o.loading_address || o.loading_place}</div>
        <div className="text-xs text-slate-500">${o.loading_date} · ${o.loading_time_from}–${o.loading_time_to}</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm border">
        <div className="font-semibold mb-2">📦 Розвантаження</div>
        <div className="text-sm">${o.unloading_address || o.unloading_place}</div>
        <div className="text-xs text-slate-500">${o.unloading_date} · ${o.unloading_time_from}–${o.unloading_time_to}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick=${() => setStatus('loading')} className="h-12 rounded-md bg-slate-200 font-medium">Завантажено</button>
        <button onClick=${() => setStatus('delivered')} className="h-12 rounded-md bg-brand text-white font-medium">✓ Delivered</button>
      </div>
    </div>
  `;
}

// ========= Root =========
function App() {
  const { session, ready } = useAuth();
  const { path } = useRouter();
  const [recovery, setRecovery] = useState(() => !!sessionStorage.getItem('recovery_mode'));

  // Driver webview — public route
  const driverToken = path.match(/^\/d\/(.+)$/)?.[1];
  if (driverToken) return html`<${DriverWebview} token=${driverToken} />`;

  if (!ready) return html`<div className="min-h-screen grid place-items-center"><span className="loader" /></div>`;
  if (recovery && session) return html`<${RecoveryPassword} onDone=${() => setRecovery(false)} />`;
  if (!session) return html`<${SignIn} />`;

  let page;
  if (path === '/' || path === '') page = html`<${Dashboard} />`;
  else if (path.startsWith('/orders')) page = html`<${OrdersPage} />`;
  else if (path === '/ai') page = html`<${AiPage} />`;
  else if (path === '/fleet') page = html`<${FleetPage} />`;
  else if (path === '/clients') page = html`<${ClientsPage} />`;
  else if (path === '/carriers') page = html`<${CarriersPage} />`;
  else if (path === '/payments') page = html`<${PaymentsPage} />`;
  else if (path === '/reports') page = html`<${ReportsPage} />`;
  else if (path === '/settings') page = html`<${SettingsPage} />`;
  else page = html`<div className="p-6">404</div>`;

  return html`<${Shell}>${page}<//>`;
}

// Bootstrap: handle auth callbacks before React mounts.
// - Magic link (PKCE): ?code=<uuid> → exchangeCodeForSession
// - Password recovery / implicit magic link: #access_token=...&refresh_token=...&type=recovery
async function bootstrap() {
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) toast('Auth: ' + error.message, 'error');
      history.replaceState({}, '', location.pathname + location.hash);
    }

    // Implicit-flow tokens (recovery email, OAuth callbacks)
    if (location.hash.startsWith('#access_token=') || location.hash.includes('access_token=')) {
      const h = new URLSearchParams(location.hash.slice(1));
      const access_token = h.get('access_token');
      const refresh_token = h.get('refresh_token');
      const type = h.get('type');
      if (access_token && refresh_token) {
        const { error } = await sb.auth.setSession({ access_token, refresh_token });
        if (error) toast('Auth: ' + error.message, 'error');
        if (type === 'recovery') sessionStorage.setItem('recovery_mode', '1');
        history.replaceState({}, '', location.pathname);
      }
    }

    const err = params.get('error_description') || params.get('error');
    if (err) toast('Auth: ' + err, 'error');
  } catch (e) {
    toast('Bootstrap error: ' + e.message, 'error');
  }
  createRoot(document.getElementById('root')).render(
    h(RouterProvider, null, h(AuthProvider, null, h(App))),
  );
}
bootstrap();

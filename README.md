# Bakspeed CRM

CRM/TMS для **Bakspeed Sp. z o.o.** — реалізація ТЗ v2.0.

**Live backend:** `https://fzhfbunluqsqtgbhmlia.supabase.co` (проєкт `Bakspeed General`, eu-west-1, ACTIVE).
**Стек:** React + TypeScript + Vite + Tailwind + shadcn/ui · Supabase · Claude API · Cloudflare Pages.

## Що ВЖЕ задеплоєно в Supabase

- **24 таблиці** з RLS, FK-індексами, пошуковими `gin_trgm` індексами, generated columns для VAT/brutto/delta/€-per-km.
- **5 materialized views** (truck/manager/client/country/monthly) + нічний refresh через pg_cron.
- **Seeds:** 3 менеджери (SK/AA/BA), 7 перевізників (власний Bakspeed + 6 зовнішніх з реальними назвами з LOADSINFO), 11 вантажівок (BAKS1/2, BKT, FCD/FCDL, LKW4/6/9, MAJA, SMART, TRAN), 39 правил Warunki, 8 шаблонів повідомлень.
- **NBP backfill:** курси EUR→PLN за 2025-07-01 … 2026-04-20 (201 робочих днів).
- **11 cron jobs** у `pg_cron` (daily digest, NBP sync, payment reminders, auto-accept timer, penalty scanners, dispatcher).
- **16 Edge Functions** (Deno) задеплоєні й ACTIVE:
  - `nbp_daily_sync` (public)
  - `parse_pdf_order` (Claude vision → order draft)
  - `generate_carrier_order_pdf` (TIMOCOM-стайл + Warunki attach)
  - `generate_driver_brief` (3-page PDF)
  - `fleethand_build_route` (API + OSRM fallback)
  - `saldeo_create_invoice`, `saldeo_sync`
  - `whitelist_check` (mf.gov.pl)
  - `auto_accept_timer` (Warunki п.9)
  - `payment_reminders_scan`, `documents_missing_scan` (п.35),
    `thermograph_missing_scan` (п.13), `pallets_missing_scan` (п.32),
    `insurance_expiry_scan` (п.30)
  - `daily_digest`, `notification_dispatcher`, `ai_assistant`, `incoming_mail_poll`
- **Security:** усі 8 функцій мають pinned `search_path = public`, RLS скрізь, matviews доступні лише `authenticated`, `order_number_sequences` закрита від API.
- **Performance:** 22 FK-covering index додано.

## Що ще треба від вас (мінімум)

### 1. Owner-користувач в Auth
У Supabase Studio → **Authentication → Users → Add user**: створіть `info@bakspeed.pl` (password або magic link).
Далі в SQL editor:
```sql
update managers
  set user_id = (select id from auth.users where email = 'info@bakspeed.pl')
  where code = 'SK';
```

### 2. Секрети Edge Functions
У Studio → **Edge Functions → Secrets** (або `supabase secrets set`):
```
ANTHROPIC_API_KEY=sk-ant-...        # для parse_pdf_order, ai_assistant
TELEGRAM_BOT_TOKEN=...              # для notifications
RESEND_API_KEY=re_...               # для email
TWILIO_ACCOUNT_SID=AC...            # опц.
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+48...
FLEETHAND_TOKEN=...                 # опц. (інакше OSRM fallback)
SALDEO_API_KEY=...                  # опц. (інакше локальна нумерація)
APP_URL=https://app.bakspeed.pl
```

### 3. Налаштування pg_cron для виклику edge
У SQL editor (один раз):
```sql
alter database postgres set app.project_url = 'https://fzhfbunluqsqtgbhmlia.supabase.co';
alter database postgres set app.service_role = '<service_role_key_з_Studio>';
```

### 4. Upload Warunki PDF
Studio → **Storage → static** → завантажити `warunki.pdf` (з `/Users/kryma/Downloads/Warunki realizacji zlecenia transportowego BAKSPEED Sp. z o.o.pdf`).

### 5. GitHub (один-раз інтерактивна авторизація)
```bash
~/.local/bin/gh auth login          # вибір: GitHub.com → HTTPS → Browser
cd "/Users/kryma/Documents/CRM BAKSPEED"
~/.local/bin/gh repo create kryma/bakspeed-crm --private --source=. --push
```
Далі в GitHub repo → Settings → Secrets → додати Cloudflare API credentials (для CI-деплою).

### 6. Запустити фронтенд локально
```bash
export PATH="$HOME/.local/node20/bin:$PATH"  # Node 20 у ~/.local
cd "/Users/kryma/Documents/CRM BAKSPEED/app"
npm install
npm run dev
# → http://127.0.0.1:5173
```
`.env.local` з `VITE_SUPABASE_URL` і ключем уже прописаний.

## Імпорт історичних даних

```bash
export PATH="$HOME/.local/node20/bin:$PATH"
cd "/Users/kryma/Documents/CRM BAKSPEED/scripts"
npm install

export SUPABASE_URL=https://fzhfbunluqsqtgbhmlia.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role_з_Studio>

# LOADS-INFO 4 місяці
FILE="/Users/kryma/Downloads/2026 LOADS-INFO Bakspeed Sp. z o.o. .xlsx" npm run import:loadsinfo

# BK-TRANS (km breakdown)
FILE="/Users/kryma/Downloads/BK-TRANS Tomasz Barczak .xlsx" TRUCK_CODE=BKT npm run import:bktrans
```

## Структура репо

```
.
├── app/                     # Frontend (Vite + React + TS)
│   └── src/
│       ├── components/      # UI, layout, dashboard, orders tabs
│       ├── pages/           # 10 розділів + driver webview
│       ├── lib/             # supabase client, auth store, utils
│       └── i18n/            # uk.json
├── supabase/
│   ├── migrations/          # 0001..0019 (повна схема + RLS + cron + security)
│   └── functions/           # 18 Edge Functions (Deno) — 16 у продакшні
├── scripts/                 # LOADSINFO + BKTRANS + NBP backfill
└── .github/workflows/deploy.yml
```

## Warunki — автоматизовані пункти

| # | Правило | Реалізація |
|---|---|---|
| 9  | Auto-accept 30хв | `auto_accept_timer` (cron кожні 15хв) |
| 11 | ЗІЗ водія | Блок у Driver Brief |
| 12 | ADR сертифікат | Валідація перед carrier-PDF |
| 13 | Термограф 14д | `thermograph_missing_scan` |
| 14 | Неподання | `status = loading_missed` |
| 22 | Запізнення | cron (потребує actual vs ETA) |
| 25 | Субпідряд | fraud detection stub |
| 29 | Обхід клієнтів 5р | Текст у PDF |
| 30 | OCP ≥500k | Валідація в `generate_carrier_order_pdf` |
| 32 | Паліти 21д | `pallets_missing_scan` |
| 35 | Оригінали 14д | `documents_missing_scan` + UI вибір |
| 37 | Реквізити фактури | Letterhead footer |
| 38 | Term 60 днів | `carriers.default_payment_term_days = 60` |
| 39 | Whitelist | `whitelist_check` + cron 12:00 |

## Roadmap до v1.0

- [ ] Owner-user створено + `managers.user_id` прив'язано
- [ ] Secrets виставлені + `app.project_url` + `app.service_role`
- [ ] `warunki.pdf` завантажено в `static` bucket
- [ ] GitHub repo створено + push
- [ ] Cloudflare Pages підключено до repo
- [ ] Імпорт історичних даних (LOADSINFO + BKTRANS) виконано
- [ ] WhatsApp Business через Twilio (якщо бюджет підтверджено)
- [ ] Повний carrier-PDF з логотипом + fonts з кирилицею/польською
- [ ] Trans.eu / TIMOCOM інтеграція (v2)
- [ ] GPS-трекінг (v2)

---

*SPEED YOU CAN TRUST.*

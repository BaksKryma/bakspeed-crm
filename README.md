# Bakspeed CRM

CRM/TMS для **Bakspeed Sp. z o.o.** — реалізація ТЗ v2.0.

**Стек:** React + TypeScript + Vite + Tailwind + shadcn/ui · Supabase (Postgres + Auth + Storage + Edge Functions + pg_cron) · Claude API · Cloudflare Pages.

## Структура

```
.
├── app/                     # Frontend (Vite + React + TS)
│   └── src/
│       ├── components/      # UI, layout, dashboard, orders tabs
│       ├── pages/           # 10 розділів + driver webview
│       ├── lib/             # supabase client, auth store, utils
│       └── i18n/            # uk.json
├── supabase/
│   ├── migrations/          # 0001..0014 — повна схема + RLS + cron
│   │   ├── 0001_extensions_and_enums.sql
│   │   ├── 0002_references.sql
│   │   ├── 0003_currency_rates.sql
│   │   ├── 0004_orders.sql
│   │   ├── 0005_routes_and_briefs.sql
│   │   ├── 0006_documents.sql
│   │   ├── 0007_invoices.sql
│   │   ├── 0008_penalty_rules.sql
│   │   ├── 0009_notifications_events.sql
│   │   ├── 0010_matviews.sql
│   │   ├── 0011_rls.sql
│   │   ├── 0012_seed_penalty_rules.sql
│   │   ├── 0013_seed_references.sql
│   │   └── 0014_cron_jobs.sql
│   └── functions/           # 14 Edge Functions (Deno)
│       ├── nbp_daily_sync/
│       ├── parse_pdf_order/              (Claude vision → order draft)
│       ├── generate_carrier_order_pdf/   (TIMOCOM-стайл PDF + Warunki)
│       ├── generate_driver_brief/        (3-сторінковий PDF водієві)
│       ├── fleethand_build_route/        (Fleet Hand API або OSRM fallback)
│       ├── saldeo_create_invoice/        (Saldeo API або локальний PDF)
│       ├── saldeo_sync/
│       ├── whitelist_check/              (mf.gov.pl)
│       ├── auto_accept_timer/            (Warunki п.9 — 30хв)
│       ├── payment_reminders_scan/
│       ├── documents_missing_scan/       (Warunki п.35)
│       ├── thermograph_missing_scan/     (п.13)
│       ├── pallets_missing_scan/         (п.32)
│       ├── insurance_expiry_scan/        (п.30)
│       ├── daily_digest/
│       ├── notification_dispatcher/      (TG/Email/SMS)
│       ├── ai_assistant/                 (Claude tool-use)
│       └── incoming_mail_poll/
├── scripts/                 # Імпорт LOADS-INFO, BK-TRANS, NBP backfill
└── .github/workflows/deploy.yml
```

## Запуск локально

### 1. Frontend
```bash
cp .env.example app/.env.local   # заповни VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 2. Supabase локальний стек
```bash
npm i -g supabase
supabase start         # підніме Postgres + Auth + Storage + Studio
supabase db reset      # застосує міграції 0001..0014 + seed
supabase functions serve   # серверує edge functions локально
```

Storage buckets (створити через Studio або SQL):
- `orders-pdf` (private) — вхідні PDF від клієнтів
- `documents` (private) — усі документи замовлень
- `static` (private) — Warunki PDF (завантажити `warunki.pdf` з `/Users/kryma/Downloads/Warunki realizacji zlecenia transportowego BAKSPEED Sp. z o.o.pdf`)

### 3. Імпорт історичних даних
```bash
cd scripts
npm install
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

# NBP курси на період
FROM=2025-07-01 TO=2026-04-20 npm run backfill:nbp

# LOADS-INFO 4 місяці
FILE="/Users/kryma/Downloads/2026 LOADS-INFO Bakspeed Sp. z o.o. .xlsx" npm run import:loadsinfo

# BK-TRANS km breakdown (один файл на перевізника)
FILE="/Users/kryma/Downloads/BK-TRANS Tomasz Barczak .xlsx" TRUCK_CODE=BKT npm run import:bktrans
```

## Деплой

### Cloudflare Pages + Supabase (через GitHub Actions)

Потрібні secrets у repo:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — для фронта
- `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` — для міграцій
- `CF_API_TOKEN`, `CF_ACCOUNT_ID` — для Cloudflare Pages

Усе решта через `supabase secrets set`:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set FLEETHAND_TOKEN=...
supabase secrets set SALDEO_API_KEY=...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set RESEND_API_KEY=...
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+...
supabase secrets set APP_URL=https://app.bakspeed.pl
```

### Налаштування pg_cron
У Studio SQL editor один раз:
```sql
alter database postgres set app.project_url = 'https://your-project.supabase.co';
alter database postgres set app.service_role = 'eyJ...';
```

## Що реалізовано (v0.1)

**База даних (повна схема):** довідники (clients, carriers, trucks, drivers, managers), orders (мультивалютні з auto-recalc EUR через NBP trigger), route_plans, driver_briefs, documents, invoices_out (Saldeo-ready), invoices_in, bank_statements + MT940 transactions, penalty_rules (39 пунктів seeded), applied_penalties, notifications + templates, order_events, scheduled_reminders, audit_log, matviews (truck/manager/client/country/monthly), RLS + driver webview RPCs, atomic order-number generator `YYYY-MM-NNNNN`.

**Frontend:**
- Пульт (4 KPI + chart оборот/маржа + карта Європи з активними рейсами)
- Замовлення list (фільтри статус/місяць/пошук) + drag-drop PDF → AI parser
- Картка замовлення з 6 табами (Overview/Route/Documents/Timeline/Messages/Invoice) + action bar
- Ручне створення замовлення
- Флот (розділено власний/залучений, KPI з matview)
- Спедиція (замовлення без carrier)
- Клієнти, Перевізники (CRUD + OCP поля)
- Платежі (Receivables / Payables з колір-кодом, whitelist badge, п.35 badge)
- Звіти (оборот/маржа по місяцях, топ клієнтів, менеджери)
- AI-асистент (чат + швидкі дії)
- Налаштування (реквізити, користувачі, вантажівки, водії, шаблони, Warunki)
- Driver Webview (токен-лінк, без авторизації, фото CMR)

**Edge Functions:**
- AI-парсинг PDF (Claude Opus 4.7 tool-use)
- PDF генератор carrier-order (TIMOCOM-стайл + Warunki attach + letterhead footer)
- PDF генератор Driver Brief (3 сторінки)
- NBP daily + backfill
- Fleet Hand (API або OSRM fallback)
- Saldeo (API або local)
- Whitelist mf.gov.pl
- 10 cron-функцій (auto-accept, reminders, penalty scanners, digest)
- Notification dispatcher (TG / Resend / Twilio)
- AI-асистент (tool-use chat)

**Імпортери:** LOADSINFO (4 міс), BKTRANS (14 міс, country km + ціни), NBP backfill.

## Warunki — автоматизовані пункти

| # | Правило | Реалізація |
|---|---|---|
| 9  | Auto-accept 30хв | `auto_accept_timer` cron |
| 11 | ЗІЗ водія | Блок в Driver Brief |
| 12 | ADR сертифікат | Валідація перед carrier-PDF |
| 13 | Термограф 14д | `thermograph_missing_scan` |
| 14 | Неподання | `status = loading_missed` alert |
| 17 | Паркування | Інструкції у Driver Brief |
| 18 | Доп.завантаження | `audit_log` + applied_penalties manual |
| 22 | Запізнення | cron (потребує actual vs ETA) |
| 25 | Субпідряд | fraud detection stub |
| 29 | Обхід клієнтів 5р | Текст у PDF |
| 30 | OCP ≥500k | Валідація в `generate_carrier_order_pdf` |
| 32 | Паліти 21д | `pallets_missing_scan` |
| 35 | Оригінали 14д | `documents_missing_scan` + UI вибір |
| 37 | Реквізити фактури | Letterhead footer (shared) |
| 38 | Term 60 днів | `carriers.default_payment_term_days = 60` |
| 39 | Whitelist | `whitelist_check` + cron 12:00 |

## Roadmap до v1.0

- [ ] Повноцінний OAuth/magic-link Auth UI з роллю owner для `info@bakspeed.pl`
- [ ] Kontact binding існуючого Auth user → managers.user_id
- [ ] MT940 IMPORT UI + парсер (`@fintechbel/mt940` або власний)
- [ ] Telegram bot commands → `ai_assistant` tool-use
- [ ] WhatsApp Business через Twilio (після підтвердження бюджету)
- [ ] Weekly owner digest (PDF, понеділок 08:00)
- [ ] Повний QR-код на причепах (генерація + PIN-вхід водія)
- [ ] Повна адаптація PDF 2026-03-00160 (font-embedding + логотип)
- [ ] Trans.eu / TIMOCOM інтеграція (v2)
- [ ] GPS-трекінг (v2)

---

*SPEED YOU CAN TRUST.*

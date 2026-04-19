# Bakspeed CRM

Zero-build CRM для **Bakspeed Sp. z o.o.** — працює прямо з GitHub Pages, без Node, без Vite, без CI.

## Архітектура

- **Frontend:** 3 статичні файли (`index.html`, `app.js`, `styles.css`) → GitHub Pages
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions + pg_cron)
- **Залежності:** React, htm, @supabase/supabase-js — через `<script type="importmap">` з esm.sh. Tailwind через Play CDN.

## Як це працює

Відкриваєте `https://BaksKryma.github.io/bakspeed-crm/` → браузер завантажує React/Supabase з CDN → логін → працюєте.
Жоден файл не компілюється. Редагуєте `app.js`, комітите, оновлюєте сторінку — зміни одразу живі.

## Supabase (вже задеплоєно)

**Проєкт:** `Bakspeed General` (`fzhfbunluqsqtgbhmlia`, eu-west-1, ACTIVE).

- **24 таблиці** з RLS, generated columns (VAT/brutto/delta/€-per-km).
- **5 materialized views** (truck/manager/client/country/monthly) + нічний refresh.
- **39 правил Warunki** seeded, 3 менеджери (SK/AA/BA), 7 перевізників, 11 вантажівок.
- **NBP курси EUR→PLN** 2025-07-01 → 2026-04-20 (201 робочих днів).
- **16 Edge Functions** ACTIVE: `nbp_daily_sync`, `parse_pdf_order` (Claude), `generate_carrier_order_pdf`, `generate_driver_brief`, `fleethand_build_route`, `saldeo_create_invoice` + `saldeo_sync`, `whitelist_check`, `auto_accept_timer`, 4 penalty-scanners, `daily_digest`, `notification_dispatcher`, `ai_assistant`, `incoming_mail_poll`.
- **11 cron jobs** у pg_cron (NBP, digest, reminders, scanners).
- **Security:** pinned search_path, matviews для `authenticated` тільки, 22 FK-індекси.

## Що треба зробити в Supabase Studio

1. **Auth → Add user** → `info@bakspeed.pl` (magic link).
2. **SQL editor:**
   ```sql
   update managers set user_id = (select id from auth.users where email='info@bakspeed.pl') where code='SK';

   alter database postgres set app.project_url = 'https://fzhfbunluqsqtgbhmlia.supabase.co';
   alter database postgres set app.service_role = '<service_role_key_з_Settings_API>';
   ```
3. **Edge Functions → Secrets:**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   TELEGRAM_BOT_TOKEN=...
   RESEND_API_KEY=re_...
   APP_URL=https://BaksKryma.github.io/bakspeed-crm/
   ```
4. **Storage → static** → завантажити `warunki.pdf`.

## Структура

```
.
├── index.html          # shell + importmap
├── app.js              # весь UI + логіка (React через esm.sh)
├── styles.css          # невеликі стилі поверх Tailwind CDN
├── supabase/
│   ├── migrations/     # 19 SQL (вже застосовано в проєкт)
│   └── functions/      # Deno функції (вже задеплоєні)
└── README.md
```

## Routes (hash-based для GitHub Pages)

- `#/` — Пульт з KPI
- `#/orders` — Список замовлень + `#/orders/<id>` detail drawer
- `#/clients`, `#/carriers` — CRUD
- `#/fleet` — Карти вантажівок з KPI
- `#/payments` — Receivables + Payables
- `#/reports` — Оборот/маржа, топ клієнтів, менеджери
- `#/ai` — Chat з AI-асистентом
- `#/settings` — Реквізити, users, trucks, drivers, templates, Warunki
- `#/d/<token>` — Driver webview (public, SMS-link)

## Warunki — автоматизовані пункти

| # | Правило | Реалізація |
|---|---|---|
| 9  | Auto-accept 30хв | `auto_accept_timer` cron |
| 11 | ЗІЗ водія | Блок у Driver Brief PDF |
| 12 | ADR сертифікат | Валідація перед carrier-PDF |
| 13 | Термограф 14д | `thermograph_missing_scan` |
| 30 | OCP ≥500k | Валідація в `generate_carrier_order_pdf` |
| 32 | Паліти 21д | `pallets_missing_scan` |
| 35 | Оригінали 14д | `documents_missing_scan` |
| 38 | Term 60 днів | `carriers.default_payment_term_days = 60` |
| 39 | Whitelist | `whitelist_check` |

---

*SPEED YOU CAN TRUST.*

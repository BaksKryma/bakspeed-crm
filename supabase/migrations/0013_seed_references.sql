-- 0013: Seed managers, carriers, trucks, notification templates

insert into managers (code, full_name, email, phone, role) values
('SK', 'Serhii Krymniak', 'info@bakspeed.pl', '+48508295996', 'owner'),
('AA', 'Менеджер AA',    null,                 null,             'manager'),
('BA', 'Менеджер BA',    null,                 null,             'manager');

-- Carriers (include BAKSPEED own + external from §2.6/Appendix Б)
insert into carriers (company_name, nip, country, is_own_fleet, default_payment_term_days, default_currency) values
('Bakspeed Sp. z o.o.',                    '7812023271', 'PL', true,  60, 'EUR'),
('Fastcar.Delivery Oleksandr Shust',       null,         'PL', false, 60, 'EUR'),
('Grzegorz Baran Transport Usługi',        null,         'PL', false, 30, 'EUR'),
('BK-TRANS Tomasz Barczak',                null,         'PL', false, 30, 'EUR'),
('FHU Maja Speed',                         null,         'PL', false, 45, 'EUR'),
('SMART HOLDING',                          null,         'PL', false, 30, 'EUR'),
('Transobex GmbH',                         null,         'DE', false, 30, 'EUR');

-- Trucks (Appendix Б)
insert into trucks (name, carrier_id, tractor_plate, trailer_plate, body_type) values
('BAKS1', (select id from carriers where company_name = 'Bakspeed Sp. z o.o.'),            'PY0670M', 'PY378YA', 'Mega'),
('BAKS2', (select id from carriers where company_name = 'Bakspeed Sp. z o.o.'),            'PY0669M', 'PY379YA', 'Mega'),
('BKT',   (select id from carriers where company_name = 'BK-TRANS Tomasz Barczak'),        'PY05370', 'DX30701', 'Mega'),
('FCD',   (select id from carriers where company_name = 'Fastcar.Delivery Oleksandr Shust'), 'DW4HR60', null,     'Tautliner'),
('FCDL',  (select id from carriers where company_name = 'Fastcar.Delivery Oleksandr Shust'), 'BK0943IP','BK6395X','Tautliner'),
('LKW4',  (select id from carriers where company_name = 'Grzegorz Baran Transport Usługi'), 'PNT93682','PZ1X270','Tautliner'),
('LKW6',  (select id from carriers where company_name = 'Grzegorz Baran Transport Usługi'), 'PNT86709','PO3YU61','Tautliner'),
('LKW9',  (select id from carriers where company_name = 'Grzegorz Baran Transport Usługi'), 'PO1SW83', 'PZ988XF','Tautliner'),
('MAJA',  (select id from carriers where company_name = 'FHU Maja Speed'),                  'KNS0808P','KNS555RH','Tautliner'),
('SMART', (select id from carriers where company_name = 'SMART HOLDING'),                   'CT917CF', 'MR703',   'Tautliner'),
('TRAN',  (select id from carriers where company_name = 'Transobex GmbH'),                  'WU5048M', 'HD-ST5020','Tautliner');

-- Notification templates (UA + PL + EN baseline)
insert into notification_templates (code, channel, language, subject, body) values
('order_dispatched_owner',    'telegram', 'uk', null,
  'Замовлення {{our_order_number}} відправлено перевізнику {{carrier_name}}.'),
('auto_accept_reminder',       'telegram', 'uk', null,
  '⏰ 30 хв без відповіді по {{our_order_number}}. Статус auto_accepted.'),
('carrier_order_email',        'email',   'pl', 'Zlecenie transportowe {{our_order_number}} — Bakspeed',
  'W załączeniu zlecenie {{our_order_number}} oraz Warunki realizacji zlecenia transportowego. Prosimy o potwierdzenie.'),
('driver_brief_sms',           'sms',      'uk', null,
  'Завдання {{our_order_number}}: {{loading_place}} → {{unloading_place}} {{unloading_date}}. Деталі: {{link}}'),
('payment_reminder_client_m7', 'email',    'pl', 'Przypomnienie o płatności {{invoice_number}}',
  'Uprzejmie przypominamy, że termin płatności faktury {{invoice_number}} mija {{due_date}}.'),
('payment_reminder_client_0',  'email',    'pl', 'Termin płatności {{invoice_number}} upływa dziś',
  'Termin płatności faktury {{invoice_number}} upływa dziś. Prosimy o pilną realizację.'),
('payment_overdue_7',          'email',    'pl', 'Faktura {{invoice_number}} — przeterminowana 7 dni',
  'Faktura {{invoice_number}} jest przeterminowana o 7 dni.'),
('ocp_expiry_warning',         'email',    'pl', 'OC/OCP wygasa za {{days}} dni',
  'OC/OCP dla {{carrier_name}} wygasa {{expiry}}.');

-- 0001: Extensions and enums
-- Bakspeed CRM base types

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pg_cron;

-- Order lifecycle
create type order_status as enum (
  'draft',
  'planned',
  'dispatched',
  'auto_accepted',
  'loading',
  'loading_missed',
  'in_transit',
  'unloading',
  'delivered',
  'documents_received',
  'invoiced',
  'paid',
  'cancelled'
);

-- Document types
create type document_kind as enum (
  'client_order_pdf',
  'carrier_order_pdf',
  'driver_brief_pdf',
  'warunki_realizacji_pdf',
  'cmr',
  'wz',
  'invoice_out_pdf',
  'invoice_in_pdf',
  'thermograph_printout',
  'pallet_receipt',
  'photo_loading',
  'photo_unloading',
  'map_screenshot',
  'other'
);

-- Notifications
create type notification_channel as enum ('telegram','email','sms','whatsapp','in_app');
create type notification_status as enum ('pending','sent','failed','read');

-- VAT modes
create type vat_mode as enum ('standard','reverse_charge','export','zero');

-- Currency
create type iso_currency as enum ('EUR','PLN');

-- Pallet types (Warunki п.32)
create type pallet_type as enum ('EPAL','H1','DUSSELDORFER','GITTERBOX','OTHER');

-- Originals/Scans
create type doc_form as enum ('originals','scans','mixed','none');

-- User roles
create type user_role as enum ('owner','manager','accountant','viewer');

-- Carrier penalty choice (Warunki п.35)
create type carrier_penalty_kind as enum ('none','term_extended','pct_reduction');

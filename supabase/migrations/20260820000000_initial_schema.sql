create extension if not exists pgcrypto;

create type public.user_tier as enum ('standard', 'gold');
create type public.device_type as enum ('android_app', 'ios_app', 'mweb', 'desktop');
create type public.order_status as enum ('placed', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.cashback_status as enum ('untracked', 'pending', 'confirmed', 'cancelled');
create type public.claim_status as enum ('submitted', 'needs_input', 'resolved', 'escalated', 'closed');
create type public.diagnosis_code as enum (
  'WITHIN_TRACKING_SLA',
  'PENDING_CONFIRMATION_WINDOW',
  'ORDER_CANCELLED_OR_RETURNED',
  'EXCLUDED_CATEGORY',
  'NO_CLICK_RECORDED',
  'REFERRER_STRIPPED',
  'NATIVE_APP_HANDOFF',
  'COUPON_ATTRIBUTION_LOSS',
  'SESSION_EXPIRED',
  'CART_PRELOADED',
  'ACCOUNT_MISMATCH',
  'GENUINE_TRACKING_FAILURE',
  'INSUFFICIENT_EVIDENCE'
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  signup_date timestamptz not null,
  lifetime_cashback numeric(12, 2) not null default 0 check (lifetime_cashback >= 0),
  tier public.user_tier not null default 'standard'
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tracking_sla_hours integer not null check (tracking_sla_hours > 0),
  confirmation_window_days integer not null check (confirmation_window_days > 0),
  excluded_categories text[] not null default '{}',
  allows_coupon_stacking boolean not null default false,
  allows_cart_preloading boolean not null default false,
  known_deeplink_issue boolean not null default false,
  terms_url text not null
);

create table public.clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  retailer_id uuid not null references public.retailers(id),
  clicked_at timestamptz not null,
  click_id text not null unique,
  device public.device_type not null,
  handoff_to_native_app boolean not null default false,
  referrer_intact boolean not null default true,
  cart_preloaded boolean not null default false
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  retailer_id uuid not null references public.retailers(id),
  ordered_at timestamptz not null,
  order_value numeric(12, 2) not null check (order_value > 0),
  category text not null,
  status public.order_status not null,
  coupon_code_used text,
  email_used text not null
);

create table public.cashback_records (
  id uuid primary key default gen_random_uuid(),
  click_id uuid references public.clicks(id),
  order_id uuid references public.orders(id),
  status public.cashback_status not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  reported_at timestamptz,
  constraint cashback_has_evidence check (click_id is not null or order_id is not null)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  raw_text text not null check (length(trim(raw_text)) > 0),
  submitted_at timestamptz not null default now(),
  claimed_order_value numeric(12, 2) check (claimed_order_value > 0),
  claimed_retailer_id uuid references public.retailers(id),
  claimed_order_date timestamptz,
  status public.claim_status not null default 'submitted',
  diagnosis_code public.diagnosis_code,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  resolution_text text,
  clarifying_question text,
  clarifying_answer text,
  escalation_packet jsonb,
  resolved_at timestamptz
);

create table public.platform_coupons (
  code text not null,
  retailer_id uuid not null references public.retailers(id),
  active boolean not null default true,
  primary key (code, retailer_id)
);

create table public.goodwill_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  claim_id uuid references public.claims(id),
  amount numeric(12, 2) not null check (amount > 0),
  awarded_at timestamptz not null default now(),
  reason_code public.diagnosis_code not null,
  constraint goodwill_platform_cause check (
    reason_code in ('NATIVE_APP_HANDOFF', 'REFERRER_STRIPPED')
  )
);

create index clicks_claim_match_idx on public.clicks (user_id, retailer_id, clicked_at desc);
create index orders_claim_match_idx on public.orders (user_id, retailer_id, ordered_at desc);
create index cashback_click_idx on public.cashback_records (click_id);
create index cashback_order_idx on public.cashback_records (order_id);
create index claims_queue_idx on public.claims (status, submitted_at desc);
create index goodwill_policy_idx on public.goodwill_credits (user_id, awarded_at desc);

alter table public.users enable row level security;
alter table public.retailers enable row level security;
alter table public.clicks enable row level security;
alter table public.orders enable row level security;
alter table public.cashback_records enable row level security;
alter table public.claims enable row level security;
alter table public.platform_coupons enable row level security;
alter table public.goodwill_credits enable row level security;

create policy "synthetic users are readable" on public.users for select to anon using (true);
create policy "retailers are readable" on public.retailers for select to anon using (true);
create policy "synthetic clicks are readable" on public.clicks for select to anon using (true);
create policy "synthetic orders are readable" on public.orders for select to anon using (true);
create policy "synthetic cashback is readable" on public.cashback_records for select to anon using (true);
create policy "claims are readable" on public.claims for select to anon using (true);
create policy "claims can be submitted" on public.claims for insert to anon with check (true);
create policy "claims can be triaged" on public.claims for update to anon using (true) with check (true);
create policy "coupon set is readable" on public.platform_coupons for select to anon using (true);
create policy "goodwill history is readable" on public.goodwill_credits for select to anon using (true);

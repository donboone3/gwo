-- ============================================================================
-- GWO (goodwithonline.com) — V1 Production Schema & Row-Level Security
-- Shared Store Catalog + Girls' Friend Closets + $100/mo Try-On Budget Ledger
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. User Profiles & Body Measurements (Powers Body-Twin Fit Matching)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  bio text default '',
  avatar_photo_url text,
  skin_tone text default '#DFA98F',
  hair_style text default 'waves-espresso',
  height_inches numeric(4,1) not null default 65.0,
  bust_inches numeric(4,1) not null default 34.0,
  waist_inches numeric(4,1) not null default 27.0,
  hips_inches numeric(4,1) not null default 37.0,
  shoe_size text not null default '7.5',
  pinterest_vibe text not null default 'Clean Girl Athleisure',
  is_closet_public boolean not null default true,
  referral_code text unique not null,
  daily_tryons_used int not null default 0,
  bonus_tryons int not null default 0,
  quota_reset_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 2. Friendships (Girls' Social Closet Graph)
create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- 3. Shared Global Product Catalog ("Scrape/Import Once, Available to Everyone")
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_url text unique not null,
  brand text not null,
  store_domain text not null,
  title text not null,
  category text not null check (category in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  silhouette text not null default 'tee',
  color_name text not null default 'Espresso',
  color_hex text not null default '#2C2623',
  accent_hex text not null default '#FAF8F5',
  price numeric(10,2) not null,
  currency text not null default 'USD',
  image_url text,
  occasions text[] not null default '{}',
  vibes text[] not null default '{}',
  available_sizes text[] not null default array['XS','S','M','L','XL'],
  size_chart_inches jsonb not null default '{}'::jsonb,
  est_delivery_days int not null default 4,
  in_stock boolean not null default true,
  source_type text not null default 'affiliate_feed' check (source_type in ('affiliate_feed', 'scraped_url')),
  added_by_username text,
  last_scraped_at timestamptz not null default now(),
  stale_after timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now()
);

-- 4. Closet Items (Tracks Bought Outfits, Fit Ratings & Public/Private Sharing)
create table if not exists public.closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  purchased_size text not null,
  fit_rating text not null check (fit_rating in ('runs_small', 'true_to_size', 'runs_large')),
  review_note text not null default '',
  is_public boolean not null default true,
  times_worn int not null default 1,
  created_at timestamptz not null default now()
);

-- 5. Cached Virtual Try-On Renders ($0.00 Repeat Views)
create table if not exists public.tryon_renders (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_ids uuid[] not null,
  rendered_image_url text not null,
  provider text not null default 'studio_composite',
  cost_usd numeric(8,4) not null default 0,
  created_at timestamptz not null default now()
);

-- 6. Monthly Compute Budget Ledger ($100.00 Hard Cap Guardrail)
create table if not exists public.compute_budget_ledger (
  month_key text primary key, -- e.g. '2026-11'
  cap_usd numeric(10,2) not null default 100.00,
  spent_usd numeric(10,4) not null default 0.0000,
  paid_renders int not null default 0,
  cache_hits int not null default 0,
  updated_at timestamptz not null default now()
);

-- 7. Outbound Affiliate & Friend Referral Attribution Log
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  referrer_code text,
  clicked_by_user_id uuid references public.profiles(id) on delete set null,
  destination_url text not null,
  created_at timestamptz not null default now()
);

-- Atomic Budget Circuit-Breaker RPC
create or replace function public.reserve_tryon_budget(
  p_month_key text,
  p_cost_usd numeric,
  p_default_cap numeric default 100.00
) returns boolean
language plpgsql
security definer
as $$
declare
  v_ledger public.compute_budget_ledger%rowtype;
begin
  insert into public.compute_budget_ledger (month_key, cap_usd, spent_usd, paid_renders, cache_hits)
  values (p_month_key, p_default_cap, 0, 0, 0)
  on conflict (month_key) do nothing;

  select * into v_ledger
  from public.compute_budget_ledger
  where month_key = p_month_key
  for update;

  if (v_ledger.spent_usd + p_cost_usd) > v_ledger.cap_usd then
    return false;
  end if;

  update public.compute_budget_ledger
  set spent_usd = spent_usd + p_cost_usd,
      paid_renders = paid_renders + 1,
      updated_at = now()
  where month_key = p_month_key;

  return true;
end;
$$;

-- Row-Level Security
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.closet_items enable row level security;
alter table public.tryon_renders enable row level security;

create policy "Shared catalog is readable by everyone"
  on public.products for select using (true);

create policy "Public profiles are readable by everyone"
  on public.profiles for select using (true);

create policy "Public closet items are readable by everyone"
  on public.closet_items for select using (is_public = true or auth.uid() = user_id);

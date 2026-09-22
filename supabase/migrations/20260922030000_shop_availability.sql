-- Whether the maker can make and ship each product variant to each
-- country, as it answered when asked. Filled in by the shop function a few
-- countries at a time; it drives the page's "Ship to" list. Server only.
create table if not exists public.shop_availability (
  variant_id  bigint not null,
  country     text not null,
  ok          boolean not null,
  checked_at  timestamptz not null default now(),
  primary key (variant_id, country)
);

alter table public.shop_availability enable row level security;
revoke all on public.shop_availability from anon, authenticated;

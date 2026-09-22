-- One row per PayPal payment for the MINT SUIT shop, written only by the
-- mintsuit-shop function (service role). Row level security is on with no
-- policies, so the public keys can neither read nor write it.
create table if not exists public.shop_orders (
  paypal_order_id   text primary key,
  created_at        timestamptz not null default now(),
  status            text not null,
  email             text,
  amount            numeric(10, 2),
  currency          text,
  variant_id        bigint,
  quantity          int,
  country           text,
  printful_order_id bigint,
  error             text,
  paypal            jsonb
);

alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;

-- What the mintsuit-shop function had to say when something went wrong,
-- for tracing a checkout that did not finish. Server only, like shop_orders.
create table if not exists public.shop_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  route      text,
  order_id   text,
  message    text
);

alter table public.shop_log enable row level security;
revoke all on public.shop_log from anon, authenticated;

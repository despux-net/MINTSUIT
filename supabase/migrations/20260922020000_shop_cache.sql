-- The product list as last read from Printful, so the shop answers at once
-- and refreshes in the background. Server only, like the other shop tables.
create table if not exists public.shop_cache (
  key   text primary key,
  data  jsonb not null,
  at    timestamptz not null default now()
);

alter table public.shop_cache enable row level security;
revoke all on public.shop_cache from anon, authenticated;

-- Light copies of the product photos for the cards, made once by the shop
-- function and served straight from storage. Readable by anyone (they are
-- the same pictures the page shows); only the function writes.
insert into storage.buckets (id, name, public)
values ('shop-thumbs', 'shop-thumbs', true)
on conflict (id) do update set public = true;

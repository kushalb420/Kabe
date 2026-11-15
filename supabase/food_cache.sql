-- The community cache for foods and vitamins (see src/lib/sharedCache.ts).
-- Run this once in Supabase -> SQL Editor. It only stores a food's name and its nutrition per 100 g: never who looked it up.
-- The tables have no policies, so nobody can read or write them directly; only the four functions below can.

create table if not exists public.kabe_food_cache (
  key text primary key,
  name text not null,
  unit text not null,
  unit_grams numeric not null,
  per100 jsonb not null,
  uses int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.kabe_food_cache enable row level security;

create table if not exists public.kabe_micro_cache (
  key text primary key,
  data jsonb not null,
  uses int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.kabe_micro_cache enable row level security;

create or replace function public.kabe_cache_get(p_keys text[])
returns table (key text, name text, unit text, unit_grams numeric, per100 jsonb, uses int)
language sql security definer set search_path = public as $$
  select c.key, c.name, c.unit, c.unit_grams, c.per100, c.uses
  from public.kabe_food_cache c
  where c.key = any (p_keys[1:20]);
$$;

-- A report counts again when it agrees (within a factor of two on calories) with what is stored; a very different one is ignored.
create or replace function public.kabe_cache_put(p_key text, p_name text, p_unit text, p_unit_grams numeric, p_per100 jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_key is null or length(p_key) < 2 or length(p_key) > 60 or length(p_name) > 80 or length(p_unit) > 30 then return; end if;
  if p_unit_grams is null or p_unit_grams <= 0 or p_unit_grams > 5000 then return; end if;
  if (p_per100 ->> 'kcal') is null or (p_per100 ->> 'kcal')::numeric > 910 or (p_per100 ->> 'kcal')::numeric < 0 then return; end if;
  insert into public.kabe_food_cache as c (key, name, unit, unit_grams, per100)
  values (p_key, p_name, p_unit, p_unit_grams, p_per100)
  on conflict (key) do update
    set uses = c.uses + 1, updated_at = now()
    where (c.per100 ->> 'kcal')::numeric between 0.5 * (excluded.per100 ->> 'kcal')::numeric and 2 * (excluded.per100 ->> 'kcal')::numeric + 1;
end $$;

create or replace function public.kabe_micro_get(p_keys text[])
returns table (key text, data jsonb, uses int)
language sql security definer set search_path = public as $$
  select c.key, c.data, c.uses from public.kabe_micro_cache c where c.key = any (p_keys[1:20]);
$$;

create or replace function public.kabe_micro_put(p_key text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_key is null or length(p_key) < 2 or length(p_key) > 60 or p_data is null or jsonb_typeof(p_data) <> 'object' then return; end if;
  insert into public.kabe_micro_cache as c (key, data) values (p_key, p_data)
  on conflict (key) do update set uses = c.uses + 1, updated_at = now();
end $$;

grant execute on function public.kabe_cache_get(text[]) to anon, authenticated;
grant execute on function public.kabe_cache_put(text, text, text, numeric, jsonb) to authenticated;
grant execute on function public.kabe_micro_get(text[]) to anon, authenticated;
grant execute on function public.kabe_micro_put(text, jsonb) to authenticated;

-- Repair projects where an earlier partial setup created profiles but not its
-- application columns, and where sales tables were never created.
-- Additive and safe to rerun; existing member and sales data is preserved.

alter table public.profiles
    add column if not exists email text,
    add column if not exists username text,
    add column if not exists full_name text not null default '',
    add column if not exists role text not null default 'member',
    add column if not exists created_at timestamptz not null default now();

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

-- Normalize the legacy customer role before enforcing the current app values.
do $$
declare
    role_check record;
begin
    for role_check in
        select conname
        from pg_catalog.pg_constraint
        where conrelid = 'public.profiles'::regclass
          and contype = 'c'
          and pg_catalog.pg_get_constraintdef(oid) ilike '%role%'
    loop
        execute format('alter table public.profiles drop constraint %I', role_check.conname);
    end loop;

    update public.profiles
    set role = case when lower(role) = 'admin' then 'admin' else 'member' end
    where role is null or role not in ('admin', 'member');

    alter table public.profiles
        alter column role set default 'member',
        alter column role set not null;
    alter table public.profiles
        add constraint profiles_role_check check (role in ('admin', 'member'));
end;
$$;

create unique index if not exists profiles_email_unique_idx
    on public.profiles (email) where email is not null;
create unique index if not exists profiles_username_unique_idx
    on public.profiles (username) where username is not null;

create table if not exists public.sales (
    id uuid primary key default gen_random_uuid(),
    receipt_number text not null unique,
    customer_type text not null check (customer_type in ('member', 'walk_in')),
    customer_name text not null,
    member_id uuid references public.members (id) on delete set null,
    total numeric(12, 2) not null check (total >= 0),
    status text not null default 'paid' check (status in ('paid', 'voided')),
    sold_at timestamptz not null default now(),
    processed_by uuid references auth.users (id) on delete set null
);

create table if not exists public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null references public.sales (id) on delete cascade,
    product_id uuid references public.products (id) on delete set null,
    item_name text not null,
    category text not null check (category in ('supplement', 'merchandise', 'membership')),
    quantity numeric(12, 3) not null check (quantity > 0),
    unit text not null check (unit in ('gram', 'item', 'membership')),
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    line_total numeric(12, 2) not null check (line_total >= 0)
);

create index if not exists sales_sold_at_idx on public.sales (sold_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);

create schema if not exists private;
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'admin'
    );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

revoke all on public.profiles, public.sales, public.sale_items from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.sales, public.sale_items to authenticated;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
    for select to authenticated
    using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
    for update to authenticated
    using (id = (select auth.uid()) or (select private.is_admin()))
    with check (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists sales_read_member_or_admin on public.sales;
create policy sales_read_member_or_admin on public.sales
    for select to authenticated
    using (
        (select private.is_admin())
        or exists (
            select 1 from public.members m
            where m.id = member_id and m.auth_user_id = (select auth.uid())
        )
    );

drop policy if exists sales_admin_manage on public.sales;
create policy sales_admin_manage on public.sales
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists sale_items_read_member_or_admin on public.sale_items;
create policy sale_items_read_member_or_admin on public.sale_items
    for select to authenticated
    using (
        (select private.is_admin())
        or exists (
            select 1
            from public.sales s
            join public.members m on m.id = s.member_id
            where s.id = sale_id and m.auth_user_id = (select auth.uid())
        )
    );

drop policy if exists sale_items_admin_manage on public.sale_items;
create policy sale_items_admin_manage on public.sale_items
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

notify pgrst, 'reload schema';

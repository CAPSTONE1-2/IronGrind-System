-- Add the receipt identifier expected by the sales and renewal approval flows.
-- Existing sales are preserved and receive unique legacy receipt labels.

alter table public.sales
    add column if not exists receipt_number text,
    add column if not exists customer_type text not null default 'member',
    add column if not exists customer_name text not null default 'Member',
    add column if not exists member_id uuid references public.members (id) on delete set null,
    add column if not exists total numeric(12, 2) not null default 0,
    add column if not exists status text not null default 'paid',
    add column if not exists sold_at timestamptz not null default now(),
    add column if not exists processed_by uuid references auth.users (id) on delete set null;

-- Older projects may constrain status to title-case labels (for example
-- "Paid"), while the current app writes lowercase "paid". Normalize existing
-- labels and replace the legacy constraint with a case-normalization check.
alter table public.sales drop constraint if exists sales_status_check;
update public.sales
set status = lower(btrim(status))
where status is distinct from lower(btrim(status));
alter table public.sales
    add constraint sales_status_check
    check (status <> '' and status = lower(btrim(status)));

-- A prior sales table may use older field names. Copy those values into the
-- columns used by the current dashboard without replacing populated values.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'customer'
    ) then
        execute 'update public.sales set customer_name = customer::text '
            || 'where customer_name = ''Member'' and customer is not null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'amount'
    ) then
        execute 'update public.sales set total = amount::numeric '
            || 'where total = 0 and amount is not null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'sale_date'
    ) then
        execute 'update public.sales set sold_at = sale_date::timestamptz '
            || 'where sold_at::date = current_date and sale_date is not null';
    elsif exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'created_at'
    ) then
        execute 'update public.sales set sold_at = created_at::timestamptz '
            || 'where sold_at::date = current_date and created_at is not null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'type'
    ) then
        execute 'update public.sales set customer_type = case '
            || 'when lower(type::text) in (''walk-in'', ''walk_in'', ''walkin'') then ''walk_in'' '
            || 'else ''member'' end where customer_type = ''member'' and type is not null';
    end if;
end;
$$;

create table if not exists public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null references public.sales (id) on delete cascade,
    product_id uuid references public.products (id) on delete set null,
    item_name text not null,
    category text not null,
    quantity numeric(12, 3) not null default 1,
    unit text not null default 'membership',
    unit_price numeric(12, 2) not null default 0,
    line_total numeric(12, 2) not null default 0
);

alter table public.sale_items
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists sale_id uuid references public.sales (id) on delete cascade,
    add column if not exists product_id uuid references public.products (id) on delete set null,
    add column if not exists item_name text not null default 'Sale item',
    add column if not exists category text not null default 'membership',
    add column if not exists quantity numeric(12, 3) not null default 1,
    add column if not exists unit text not null default 'membership',
    add column if not exists unit_price numeric(12, 2) not null default 0,
    add column if not exists line_total numeric(12, 2) not null default 0;

do $$
begin
    if not exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = 'public.sale_items'::regclass
          and c.conname = 'sale_items_sale_id_compat_fkey'
    ) then
        alter table public.sale_items
            add constraint sale_items_sale_id_compat_fkey
            foreign key (sale_id) references public.sales (id)
            on delete cascade not valid;
    end if;
end;
$$;

-- Protect sales data even when these tables existed before the base schema ran.
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

revoke all on public.sales, public.sale_items from anon, authenticated;
grant select, insert, update, delete on public.sales, public.sale_items to authenticated;

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'sales'
          and policyname = 'sales_read_member_or_admin'
    ) then
        create policy "sales_read_member_or_admin" on public.sales
            for select to authenticated
            using (
                (select private.is_admin())
                or exists (
                    select 1 from public.members m
                    where m.id = member_id and m.auth_user_id = (select auth.uid())
                )
            );
    end if;

    if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'sales'
          and policyname = 'sales_admin_manage'
    ) then
        create policy "sales_admin_manage" on public.sales
            for all to authenticated
            using ((select private.is_admin()))
            with check ((select private.is_admin()));
    end if;

    if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'sale_items'
          and policyname = 'sale_items_read_member_or_admin'
    ) then
        create policy "sale_items_read_member_or_admin" on public.sale_items
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
    end if;

    if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'sale_items'
          and policyname = 'sale_items_admin_manage'
    ) then
        create policy "sale_items_admin_manage" on public.sale_items
            for all to authenticated
            using ((select private.is_admin()))
            with check ((select private.is_admin()));
    end if;
end;
$$;

do $$
begin
    -- Preserve a legacy receipt value if the earlier table used a different name.
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'receipt_no'
    ) then
        execute 'update public.sales set receipt_number = receipt_no::text '
            || 'where receipt_number is null and receipt_no is not null';
    elsif exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'sales' and column_name = 'receipt_id'
    ) then
        execute 'update public.sales set receipt_number = receipt_id::text '
            || 'where receipt_number is null and receipt_id is not null';
    end if;
end;
$$;

with missing_receipts as (
    select ctid, row_number() over (order by ctid) as row_num
    from public.sales
    where receipt_number is null or btrim(receipt_number) = ''
)
update public.sales as sale
set receipt_number = 'IG-LEGACY-' || lpad(missing_receipts.row_num::text, 6, '0')
from missing_receipts
where sale.ctid = missing_receipts.ctid;

with duplicate_receipts as (
    select ctid,
           row_number() over (partition by receipt_number order by ctid) as duplicate_num
    from public.sales
)
update public.sales as sale
set receipt_number = 'IG-LEGACY-' || replace(gen_random_uuid()::text, '-', '')
from duplicate_receipts
where sale.ctid = duplicate_receipts.ctid
  and duplicate_receipts.duplicate_num > 1;

alter table public.sales
    alter column receipt_number set not null;

create unique index if not exists sales_receipt_number_unique_idx
    on public.sales (receipt_number);

notify pgrst, 'reload schema';

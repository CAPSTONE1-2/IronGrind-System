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

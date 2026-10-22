-- Add the receipt identifier expected by the sales and renewal approval flows.
-- Existing sales are preserved and receive unique legacy receipt labels.

alter table public.sales
    add column if not exists receipt_number text;

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

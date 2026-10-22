-- Transaction-safe walk-in POS writes.
-- Run after schema.sql and the online-registration compatibility migration.

-- Keep an explicit timestamp for product archives so Reports can show when
-- each item left the active store catalog.
alter table public.products
    add column if not exists archived_at timestamptz,
    add column if not exists image_path text,
    add column if not exists price_per_unit numeric(12, 2) not null default 0,
    add column if not exists unit text not null default 'item';

-- The existing catalog used title-case labels. Normalize them to the
-- canonical values used by the app and POS before enforcing the current rule.
alter table public.products drop constraint if exists products_category_check;
update public.products
set category = case
    when lower(category) = 'supplement' then 'supplement'
    when lower(category) in ('merch', 'merchandise') then 'merchandise'
    else lower(category)
end;
alter table public.products
    add constraint products_category_check
    check (category in ('supplement', 'merchandise'));

-- Supplements are sold by gram and do not use stock counts; merchandise does.
alter table public.products alter column stock drop not null;
update public.products
set stock = null
where lower(category) = 'supplement';

-- Match the unit expected by the current product catalog and POS.
update public.products
set unit = case when lower(category) = 'supplement' then 'gram' else 'item' end
where unit is null
   or (lower(category) = 'supplement' and unit <> 'gram')
   or (lower(category) = 'merchandise' and unit <> 'item');

notify pgrst, 'reload schema';

-- Older product tables may have stored the amount in a column named `price`.
-- Copy it forward when present so existing catalog prices are retained.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'price'
    ) then
        execute 'update public.products set price_per_unit = price::numeric '
            || 'where price_per_unit = 0 and price is not null';
    elsif exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'price_per_gram'
    ) then
        execute 'update public.products set price_per_unit = price_per_gram::numeric '
            || 'where category = ''supplement'' and price_per_unit = 0 and price_per_gram is not null';
    end if;
end;
$$;

-- Keep a legacy NOT NULL `price` column populated while the app writes the
-- current canonical `price_per_unit` column. The JSON record check also lets
-- this function work on databases where the old column is absent.
create or replace function public.sync_legacy_product_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    product_record jsonb;
begin
    product_record := to_jsonb(new);
    if product_record ? 'price' then
        product_record := jsonb_set(product_record, '{price}', to_jsonb(new.price_per_unit), true);
        new := jsonb_populate_record(new, product_record);
    end if;
    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'products_sync_legacy_price'
          and tgrelid = 'public.products'::regclass
          and not tgisinternal
    ) then
        execute 'create trigger products_sync_legacy_price '
            || 'before insert or update of price_per_unit on public.products '
            || 'for each row execute function public.sync_legacy_product_price()';
    end if;
end;
$$;

create or replace function public.record_walk_in_sale(
    p_receipt_number text,
    p_customer_name text,
    p_product_id uuid,
    p_quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    product_row public.products%rowtype;
    new_sale_id uuid;
    sale_total numeric(12, 2);
    resulting_stock integer;
    unit_name text;
begin
    if not private.is_admin() then
        raise exception 'Admin access required';
    end if;
    if nullif(btrim(p_customer_name), '') is null then
        raise exception 'Customer name is required';
    end if;
    if nullif(btrim(p_receipt_number), '') is null then
        raise exception 'Receipt number is required';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'Quantity must be greater than zero';
    end if;

    select * into product_row
    from public.products
    where id = p_product_id and is_active = true
    for update;

    if not found then
        raise exception 'Product is unavailable';
    end if;
    if product_row.category = 'merchandise' then
        if product_row.stock is null or p_quantity <> trunc(p_quantity) then
            raise exception 'Merchandise quantity must be a whole number';
        end if;
        if product_row.stock < p_quantity then
            raise exception 'Not enough merchandise stock';
        end if;
        unit_name := 'item';
    elsif product_row.category = 'supplement' then
        unit_name := 'gram';
    else
        raise exception 'Unsupported product category';
    end if;

    sale_total := round(product_row.price_per_unit * p_quantity, 2);
    insert into public.sales (
        receipt_number, customer_type, customer_name, total, status, processed_by
    ) values (
        btrim(p_receipt_number), 'walk_in', btrim(p_customer_name), sale_total,
        'paid', (select auth.uid())
    ) returning id into new_sale_id;

    insert into public.sale_items (
        sale_id, product_id, item_name, category, quantity, unit, unit_price, line_total
    ) values (
        new_sale_id, product_row.id, product_row.name, product_row.category,
        p_quantity, unit_name, product_row.price_per_unit, sale_total
    );

    resulting_stock := product_row.stock;
    if product_row.category = 'merchandise' then
        update public.products
        set stock = stock - p_quantity, updated_at = now()
        where id = product_row.id
        returning stock into resulting_stock;
    end if;

    return jsonb_build_object(
        'id', new_sale_id,
        'receipt_number', btrim(p_receipt_number),
        'customer_name', btrim(p_customer_name),
        'total', sale_total,
        'sold_at', now(),
        'product_id', product_row.id,
        'item_name', product_row.name,
        'category', product_row.category,
        'quantity', p_quantity,
        'unit', unit_name,
        'unit_price', product_row.price_per_unit,
        'line_total', sale_total,
        'stock', resulting_stock
    );
end;
$$;

revoke all on function public.record_walk_in_sale(text, text, uuid, numeric) from public, anon;
grant execute on function public.record_walk_in_sale(text, text, uuid, numeric) to authenticated;

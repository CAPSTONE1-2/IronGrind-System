-- Transaction-safe walk-in POS writes.
-- Run after schema.sql and the online-registration compatibility migration.

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

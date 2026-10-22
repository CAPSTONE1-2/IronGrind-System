-- Record counter renewals, plan changes, and expired membership archives in
-- Supabase so the admin reports use the database as their source of truth.

-- The earlier project schema calls this column end_date. Keep it available
-- alongside expiry_date for both the existing site and a fresh installation.
alter table public.members add column if not exists end_date date;

create or replace function public.admin_record_membership_change(
    p_member_id uuid,
    p_event_type text,
    p_new_plan text,
    p_new_price numeric,
    p_new_start_date date,
    p_new_expiry_date date,
    p_customer_name text,
    p_mobile text,
    p_receipt_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    member_row public.members%rowtype;
    new_sale_id uuid;
    item_label text;
    paid_type text;
begin
    if not (select private.is_admin()) then
        raise exception 'Admin access required';
    end if;
    if p_event_type not in ('renewal', 'plan_change') then
        raise exception 'Unsupported membership event';
    end if;
    if p_new_price is null or p_new_price <= 0 then
        raise exception 'Membership price must be greater than zero';
    end if;
    if nullif(btrim(p_new_plan), '') is null
        or nullif(btrim(p_customer_name), '') is null
        or nullif(btrim(p_receipt_number), '') is null then
        raise exception 'Plan, customer name, and receipt number are required';
    end if;

    select * into member_row
    from public.members
    where id = p_member_id
    for update;
    if not found then
        raise exception 'Member not found';
    end if;

    -- Makes a retry safe if the client loses the response after the commit.
    select id into new_sale_id
    from public.sales
    where receipt_number = btrim(p_receipt_number);
    if found then
        return jsonb_build_object('receipt_number', btrim(p_receipt_number), 'sale_id', new_sale_id,
            'start_date', p_new_start_date, 'expiry_date', p_new_expiry_date);
    end if;

    if coalesce(member_row.expiry_date, member_row.end_date) < current_date
        and not exists (
            select 1 from public.membership_history h
            where h.member_id = member_row.id and h.event_type = 'expired'
              and h.previous_expiry_date = coalesce(member_row.expiry_date, member_row.end_date)
              and h.previous_plan is not distinct from member_row.plan
        ) then
        insert into public.membership_history (
            member_id, event_type, previous_plan, previous_price,
            previous_start_date, previous_expiry_date, notes, recorded_by
        ) values (
            member_row.id, 'expired', member_row.plan, coalesce(member_row.plan_price, 0),
            member_row.start_date, coalesce(member_row.expiry_date, member_row.end_date),
            'Archived when renewed; receipt ' || btrim(p_receipt_number), (select auth.uid())
        );
    end if;

    insert into public.membership_history (
        member_id, event_type, previous_plan, new_plan, previous_price, new_price,
        previous_start_date, previous_expiry_date, new_start_date, new_expiry_date,
        notes, recorded_by
    ) values (
        member_row.id, p_event_type, member_row.plan, p_new_plan,
        coalesce(member_row.plan_price, 0), p_new_price,
        member_row.start_date, coalesce(member_row.expiry_date, member_row.end_date),
        p_new_start_date, p_new_expiry_date,
        'Receipt ' || btrim(p_receipt_number), (select auth.uid())
    );

    if p_event_type = 'renewal' and member_row.plan is distinct from p_new_plan then
        insert into public.membership_history (
            member_id, event_type, previous_plan, new_plan, previous_price, new_price,
            previous_start_date, previous_expiry_date, new_start_date, new_expiry_date,
            notes, recorded_by
        ) values (
            member_row.id, 'plan_change', member_row.plan, p_new_plan,
            coalesce(member_row.plan_price, 0), p_new_price,
            member_row.start_date, coalesce(member_row.expiry_date, member_row.end_date),
            p_new_start_date, p_new_expiry_date,
            'Plan changed during counter renewal; receipt ' || btrim(p_receipt_number), (select auth.uid())
        );
    end if;

    update public.members
    set plan = p_new_plan,
        plan_price = p_new_price,
        start_date = p_new_start_date,
        end_date = p_new_expiry_date,
        expiry_date = p_new_expiry_date,
        status = 'active',
        mobile = coalesce(nullif(btrim(p_mobile), ''), mobile),
        updated_at = now()
    where id = member_row.id;

    select data_type into paid_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'members' and column_name = 'paid';
    if paid_type in ('numeric', 'integer', 'bigint', 'real', 'double precision') then
        execute 'update public.members set paid = $1 where id = $2' using p_new_price, member_row.id;
    elsif paid_type = 'boolean' then
        update public.members set paid = true where id = member_row.id;
    end if;

    item_label := p_new_plan || case when p_event_type = 'renewal'
        then ' Membership Renewal' else ' Membership Plan Change' end;

    insert into public.sales (
        receipt_number, customer_type, customer_name, member_id, total, status, sold_at, processed_by
    ) values (
        btrim(p_receipt_number), 'member', btrim(p_customer_name), member_row.id,
        p_new_price, 'paid', now(), (select auth.uid())
    ) returning id into new_sale_id;

    insert into public.sale_items (
        sale_id, item_name, category, quantity, unit, unit_price, line_total
    ) values (
        new_sale_id, item_label, 'membership', 1, 'membership', p_new_price, p_new_price
    );

    return jsonb_build_object('receipt_number', btrim(p_receipt_number), 'sale_id', new_sale_id,
        'start_date', p_new_start_date, 'expiry_date', p_new_expiry_date);
end;
$$;

revoke all on function public.admin_record_membership_change(uuid, text, text, numeric, date, date, text, text, text)
    from public, anon;
grant execute on function public.admin_record_membership_change(uuid, text, text, numeric, date, date, text, text, text)
    to authenticated;

create or replace function public.admin_capture_expired_memberships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    inserted_count integer;
begin
    if not (select private.is_admin()) then
        raise exception 'Admin access required';
    end if;

    insert into public.membership_history (
        member_id, event_type, previous_plan, previous_price,
        previous_start_date, previous_expiry_date, notes
    )
    select m.id, 'expired', m.plan, coalesce(m.plan_price, 0), m.start_date,
        coalesce(m.expiry_date, m.end_date), 'Archived after 10-day expiry grace period'
    from public.members m
    where coalesce(m.expiry_date, m.end_date) <= current_date - 10
      and not exists (
          select 1 from public.membership_history h
          where h.member_id = m.id
            and h.event_type = 'expired'
            and h.previous_expiry_date = coalesce(m.expiry_date, m.end_date)
            and h.previous_plan is not distinct from m.plan
      );

    get diagnostics inserted_count = row_count;
    return inserted_count;
end;
$$;

revoke all on function public.admin_capture_expired_memberships() from public, anon;
grant execute on function public.admin_capture_expired_memberships() to authenticated;

create or replace function public.admin_record_registration_sale(
    p_member_id uuid,
    p_receipt_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    member_row public.members%rowtype;
    sale_id uuid;
begin
    if not (select private.is_admin()) then
        raise exception 'Admin access required';
    end if;
    select * into member_row from public.members where id = p_member_id for update;
    if not found then
        raise exception 'Member not found';
    end if;
    select id into sale_id from public.sales where receipt_number = btrim(p_receipt_number);
    if found then return sale_id; end if;

    insert into public.sales (
        receipt_number, customer_type, customer_name, member_id, total, status, sold_at, processed_by
    ) values (
        btrim(p_receipt_number), 'member', member_row.full_name, member_row.id,
        coalesce(member_row.plan_price, 0), 'paid', now(), (select auth.uid())
    ) returning id into sale_id;

    insert into public.sale_items (
        sale_id, item_name, category, quantity, unit, unit_price, line_total
    ) values (
        sale_id, coalesce(member_row.plan, 'Membership') || ' Membership Registration',
        'membership', 1, 'membership', coalesce(member_row.plan_price, 0),
        coalesce(member_row.plan_price, 0)
    );
    return sale_id;
end;
$$;

revoke all on function public.admin_record_registration_sale(uuid, text) from public, anon;
grant execute on function public.admin_record_registration_sale(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- The admin-create-member Edge Function uses its service key to create the
-- Auth user, then calls this transaction to save the member and first payment.
create or replace function public.admin_create_member_and_sale(
    p_admin_id uuid,
    p_member jsonb,
    p_receipt_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    member_data jsonb := p_member;
    member_row public.members%rowtype;
    sale_id uuid;
    paid_type text;
begin
    if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
        raise exception 'Admin access required';
    end if;
    if jsonb_typeof(member_data) is distinct from 'object'
        or nullif(member_data ->> 'auth_user_id', '') is null then
        raise exception 'Member details and Auth user link are required';
    end if;
    if nullif(btrim(p_receipt_number), '') is null then
        raise exception 'Receipt number is required';
    end if;

    select data_type into paid_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'members' and column_name = 'paid';
    member_data := jsonb_set(member_data, '{id}', to_jsonb(gen_random_uuid()), true);
    member_data := jsonb_set(member_data, '{user_id}', member_data -> 'auth_user_id', true);
    if paid_type in ('numeric', 'integer', 'bigint', 'real', 'double precision') then
        member_data := jsonb_set(member_data, '{paid}', member_data -> 'plan_price', true);
    else
        member_data := jsonb_set(member_data, '{paid}', 'true'::jsonb, true);
    end if;

    insert into public.members
    select (jsonb_populate_record(null::public.members, member_data)).*
    returning * into member_row;

    insert into public.sales (
        receipt_number, customer_type, customer_name, member_id, total, status,
        sold_at, processed_by
    ) values (
        btrim(p_receipt_number), 'member', member_row.full_name, member_row.id,
        coalesce(member_row.plan_price, 0), 'paid', now(), p_admin_id
    ) returning id into sale_id;

    insert into public.sale_items (
        sale_id, item_name, category, quantity, unit, unit_price, line_total
    ) values (
        sale_id, coalesce(member_row.plan, 'Membership') || ' Membership',
        'membership', 1, 'membership', coalesce(member_row.plan_price, 0),
        coalesce(member_row.plan_price, 0)
    );

    return jsonb_build_object('member_id', member_row.id, 'sale_id', sale_id,
        'receipt_number', btrim(p_receipt_number));
end;
$$;

revoke all on function public.admin_create_member_and_sale(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_create_member_and_sale(uuid, jsonb, text) to service_role;

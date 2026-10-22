-- Iron Grind Fitness Gym: initial Supabase schema
-- Run only after reviewing this file. It creates empty tables and RLS policies;
-- it does not migrate data from browser localStorage or connect the website.

create schema if not exists private;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    username text unique,
    full_name text not null default '',
    role text not null default 'member' check (role in ('admin', 'member')),
    created_at timestamptz not null default now()
);

-- Existing profiles tables may predate the email field used by the Auth trigger.
alter table public.profiles
    add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

create table if not exists public.members (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid references auth.users (id) on delete set null,
    full_name text not null,
    email text,
    username text,
    mobile text,
    date_of_birth date,
    age smallint check (age is null or age >= 0),
    sex text,
    height numeric(7, 2),
    height_unit text check (height_unit is null or height_unit in ('cm', 'in', 'ft')),
    weight_kg numeric(7, 2),
    emergency_contact jsonb not null default '{}'::jsonb,
    plan text,
    plan_price numeric(12, 2) not null default 0 check (plan_price >= 0),
    start_date date,
    expiry_date date,
    status text not null default 'active' check (status in ('active', 'expired', 'inactive')),
    registration_source text not null default 'Online application',
    paid boolean not null default false,
    fitness_goals text[] not null default '{}',
    health_conditions text[] not null default '{}',
    other_medical_conditions text not null default '',
    signature_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS does not add columns to a table that already exists.
-- This makes the schema safe to apply when an earlier attempt created members first.
alter table public.members
    add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

-- Older setup used `user_id`; preserve its links when adopting the current name.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'members' and column_name = 'user_id'
    ) then
        execute 'update public.members set auth_user_id = user_id '
            || 'where auth_user_id is null and user_id is not null';
    end if;
end;
$$;

create table if not exists public.membership_applications (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null references auth.users (id) on delete cascade,
    member_id uuid references public.members (id) on delete set null,
    application_type text not null check (application_type in ('registration', 'renewal')),
    full_name text not null,
    email text not null,
    username text,
    mobile text,
    date_of_birth date,
    age smallint check (age is null or age >= 0),
    sex text,
    height numeric(7, 2),
    height_unit text check (height_unit is null or height_unit in ('cm', 'in', 'ft')),
    weight_kg numeric(7, 2),
    emergency_contact jsonb not null default '{}'::jsonb,
    emergency_contact_data jsonb not null default '{}'::jsonb,
    plan text not null,
    plan_price numeric(12, 2) not null default 0 check (plan_price >= 0),
    start_date date,
    end_date date,
    fitness_goals text[] not null default '{}',
    health_conditions text[] not null default '{}',
    other_medical_conditions text not null default '',
    signature_path text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users (id) on delete set null
);

-- The existing Supabase project may already have the earlier table shape.
-- Add columns referenced by the current policies and indexes, preserving rows.
alter table public.membership_applications
    add column if not exists auth_user_id uuid references auth.users (id) on delete cascade,
    add column if not exists member_id uuid references public.members (id) on delete set null,
    add column if not exists application_type text not null default 'registration'
        check (application_type in ('registration', 'renewal')),
    add column if not exists submitted_at timestamptz not null default now(),
    add column if not exists email text,
    add column if not exists username text,
    add column if not exists weight_kg numeric(7, 2),
    add column if not exists emergency_contact_data jsonb not null default '{}'::jsonb,
    add column if not exists signature_path text;

alter table public.members
    add column if not exists application_id uuid references public.membership_applications (id) on delete set null;

-- Earlier tables called the auth link `user_id` and the submission time `created_at`.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'membership_applications'
          and column_name = 'user_id'
    ) then
        execute 'update public.membership_applications set auth_user_id = user_id '
            || 'where auth_user_id is null and user_id is not null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'membership_applications'
          and column_name = 'created_at'
    ) then
        execute 'update public.membership_applications set submitted_at = created_at '
            || 'where created_at is not null and submitted_at is distinct from created_at';
    end if;
end;
$$;

create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members (id) on delete restrict,
    time_in timestamptz not null default now(),
    time_out timestamptz,
    recorded_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    check (time_out is null or time_out >= time_in)
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text not null check (category in ('supplement', 'merchandise')),
    price_per_unit numeric(12, 2) not null check (price_per_unit >= 0),
    unit text not null check (unit in ('gram', 'item')),
    size text,
    stock integer check (stock is null or stock >= 0),
    image_path text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((category = 'supplement' and unit = 'gram' and stock is null)
        or (category = 'merchandise' and unit = 'item'))
);

-- Existing product tables may predate the active/inactive inventory flag.
alter table public.products
    add column if not exists is_active boolean not null default true;

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

create table if not exists public.membership_history (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members (id) on delete restrict,
    event_type text not null check (event_type in ('expired', 'renewal', 'plan_change')),
    previous_plan text,
    new_plan text,
    previous_price numeric(12, 2) check (previous_price is null or previous_price >= 0),
    new_price numeric(12, 2) check (new_price is null or new_price >= 0),
    previous_start_date date,
    previous_expiry_date date,
    new_start_date date,
    new_expiry_date date,
    notes text not null default '',
    recorded_at timestamptz not null default now(),
    recorded_by uuid references auth.users (id) on delete set null
);

create unique index if not exists members_auth_user_id_unique_idx on public.members (auth_user_id);
create index if not exists applications_auth_user_id_idx on public.membership_applications (auth_user_id);
create index if not exists applications_status_submitted_idx on public.membership_applications (status, submitted_at desc);
create index if not exists attendance_member_time_idx on public.attendance (member_id, time_in desc);
create index if not exists sales_sold_at_idx on public.sales (sold_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists membership_history_member_date_idx on public.membership_history (member_id, recorded_at desc);

-- The signup trigger creates member-role profiles. Role is never copied from
-- user-provided metadata, so a signup cannot grant itself admin privileges.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, username, full_name)
    values (
        new.id,
        new.email,
        nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), '')
    );
    return new;
end;
$$;

do $$
begin
    -- Older project setup created a second profile trigger. Remove that known
    -- duplicate so one Auth signup creates exactly one profile row.
    execute 'drop trigger if exists on_auth_user_created_profile on auth.users';
    if not exists (
        select 1
        from pg_catalog.pg_trigger
        where tgname = 'on_auth_user_created'
          and tgrelid = 'auth.users'::regclass
          and not tgisinternal
    ) then
        execute 'create trigger on_auth_user_created after insert on auth.users '
            || 'for each row execute function public.handle_new_auth_user()';
    end if;
end;
$$;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.email is distinct from old.email then
        update public.profiles set email = new.email where id = new.id;
        update public.members set email = new.email where auth_user_id = new.id;
    end if;
    return new;
end;
$$;

revoke all on function public.sync_auth_user_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.sync_auth_user_email();

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
alter table public.members enable row level security;
alter table public.membership_applications enable row level security;
alter table public.attendance enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.membership_history enable row level security;

revoke all on table public.profiles, public.members, public.membership_applications,
    public.attendance, public.products, public.sales, public.sale_items,
    public.membership_history from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (username, full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.members, public.membership_applications,
    public.attendance, public.products, public.sales, public.sale_items,
    public.membership_history to authenticated;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
    for select to authenticated
    using (id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
    for update to authenticated
    using (id = (select auth.uid()) or (select private.is_admin()))
    with check (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "members_read_self_or_admin" on public.members;
create policy "members_read_self_or_admin" on public.members
    for select to authenticated
    using (auth_user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "members_admin_manage" on public.members;
create policy "members_admin_manage" on public.members
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop function if exists public.update_own_member_profile(text, text);

create or replace function public.update_own_member_personal_info(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_member_id uuid;
    v_full_name text;
    v_mobile text;
    v_dob date;
    v_sex text;
    v_height numeric;
    v_height_unit text;
    v_weight numeric;
    v_emergency_contact jsonb;
    v_fitness_goals text[];
    v_health_conditions text[];
    v_other_medical_conditions text;
begin
    if (select auth.uid()) is null then
        raise exception 'Authentication required';
    end if;
    if jsonb_typeof(p_profile) is distinct from 'object' then
        raise exception 'Profile information must be an object';
    end if;

    v_full_name := nullif(btrim(p_profile ->> 'full_name'), '');
    v_mobile := nullif(btrim(p_profile ->> 'mobile'), '');
    v_dob := nullif(p_profile ->> 'date_of_birth', '')::date;
    v_sex := nullif(btrim(p_profile ->> 'sex'), '');
    v_height := nullif(p_profile ->> 'height', '')::numeric;
    v_height_unit := nullif(p_profile ->> 'height_unit', '');
    v_weight := nullif(p_profile ->> 'weight_kg', '')::numeric;
    v_emergency_contact := case
        when jsonb_typeof(p_profile -> 'emergency_contact') = 'object' then p_profile -> 'emergency_contact'
        else '{}'::jsonb
    end;
    v_other_medical_conditions := coalesce(p_profile ->> 'other_medical_conditions', '');

    if v_full_name is null then
        raise exception 'Full name is required';
    end if;
    if v_dob is null or v_dob > current_date then
        raise exception 'Enter a valid date of birth';
    end if;
    if v_mobile is not null and v_mobile !~ '^09[0-9]{9}$' then
        raise exception 'Enter a valid PH mobile number';
    end if;
    if nullif(btrim(v_emergency_contact ->> 'contact'), '') is not null
        and btrim(v_emergency_contact ->> 'contact') !~ '^09[0-9]{9}$' then
        raise exception 'Enter a valid emergency contact number';
    end if;
    if v_height is not null and v_height <= 0 then
        raise exception 'Height must be greater than zero';
    end if;
    if v_weight is not null and v_weight <= 0 then
        raise exception 'Weight must be greater than zero';
    end if;
    if v_height is not null and (v_height_unit is null or v_height_unit not in ('cm', 'in', 'ft')) then
        raise exception 'Choose a valid height unit';
    end if;

    select coalesce(array_agg(value), '{}'::text[])
    into v_fitness_goals
    from jsonb_array_elements_text(
        case when jsonb_typeof(p_profile -> 'fitness_goals') = 'array'
            then p_profile -> 'fitness_goals' else '[]'::jsonb end
    ) as goals(value);

    select coalesce(array_agg(value), '{}'::text[])
    into v_health_conditions
    from jsonb_array_elements_text(
        case when jsonb_typeof(p_profile -> 'health_conditions') = 'array'
            then p_profile -> 'health_conditions' else '[]'::jsonb end
    ) as conditions(value);

    update public.members
    set full_name = v_full_name,
        mobile = v_mobile,
        date_of_birth = v_dob,
        age = extract(year from age(current_date, v_dob))::smallint,
        sex = v_sex,
        height = v_height,
        height_unit = case when v_height is null then null else v_height_unit end,
        weight_kg = v_weight,
        emergency_contact = v_emergency_contact,
        fitness_goals = v_fitness_goals,
        health_conditions = v_health_conditions,
        other_medical_conditions = v_other_medical_conditions,
        updated_at = now()
    where auth_user_id = (select auth.uid())
    returning id into v_member_id;

    if v_member_id is null then
        raise exception 'No member record is linked to this account';
    end if;

    update public.profiles
    set full_name = v_full_name
    where id = (select auth.uid());
end;
$$;

revoke all on function public.update_own_member_personal_info(jsonb) from public, anon, authenticated;
grant execute on function public.update_own_member_personal_info(jsonb) to authenticated;

drop policy if exists "applications_read_self_or_admin" on public.membership_applications;
create policy "applications_read_self_or_admin" on public.membership_applications
    for select to authenticated
    using (auth_user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "applications_submit_own_pending" on public.membership_applications;
create policy "applications_submit_own_pending" on public.membership_applications
    for insert to authenticated
    with check (
        auth_user_id = (select auth.uid())
        and status = 'pending'
        and reviewed_at is null
        and reviewed_by is null
        and (
            (application_type = 'registration' and member_id is null)
            or (
                application_type = 'renewal'
                and exists (
                    select 1 from public.members m
                    where m.id = member_id and m.auth_user_id = (select auth.uid())
                )
            )
        )
    );
drop policy if exists "applications_admin_manage" on public.membership_applications;
create policy "applications_admin_manage" on public.membership_applications
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists "attendance_read_member_or_admin" on public.attendance;
create policy "attendance_read_member_or_admin" on public.attendance
    for select to authenticated
    using (
        (select private.is_admin())
        or exists (
            select 1 from public.members m
            where m.id = member_id and m.auth_user_id = (select auth.uid())
        )
    );
drop policy if exists "attendance_admin_manage" on public.attendance;
create policy "attendance_admin_manage" on public.attendance
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists "products_read_active_or_admin" on public.products;
create policy "products_read_active_or_admin" on public.products
    for select to authenticated
    using (is_active or (select private.is_admin()));
drop policy if exists "products_admin_manage" on public.products;
create policy "products_admin_manage" on public.products
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists "sales_read_member_or_admin" on public.sales;
create policy "sales_read_member_or_admin" on public.sales
    for select to authenticated
    using (
        (select private.is_admin())
        or exists (
            select 1 from public.members m
            where m.id = member_id and m.auth_user_id = (select auth.uid())
        )
    );
drop policy if exists "sales_admin_manage" on public.sales;
create policy "sales_admin_manage" on public.sales
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists "sale_items_read_member_or_admin" on public.sale_items;
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
drop policy if exists "sale_items_admin_manage" on public.sale_items;
create policy "sale_items_admin_manage" on public.sale_items
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

drop policy if exists "membership_history_read_member_or_admin" on public.membership_history;
create policy "membership_history_read_member_or_admin" on public.membership_history
    for select to authenticated
    using (
        (select private.is_admin())
        or exists (
            select 1 from public.members m
            where m.id = member_id and m.auth_user_id = (select auth.uid())
        )
    );
drop policy if exists "membership_history_admin_manage" on public.membership_history;
create policy "membership_history_admin_manage" on public.membership_history
    for all to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

-- Bootstrap the first admin only after that person has signed up in Supabase Auth:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
-- Run that statement separately in SQL Editor, replacing the email with the real admin email.

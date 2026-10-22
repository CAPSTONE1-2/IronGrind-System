-- Align existing legacy registration tables with the canonical app fields.
-- Keeps legacy columns and values; removes NOT NULL only from old fields that
-- new clients no longer write.

alter table public.members
    add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
    add column if not exists email text,
    add column if not exists username text,
    add column if not exists date_of_birth date,
    add column if not exists age smallint,
    add column if not exists sex text,
    add column if not exists application_id uuid references public.membership_applications (id) on delete set null,
    add column if not exists emergency_contact jsonb not null default '{}'::jsonb,
    add column if not exists plan_price numeric(12, 2) not null default 0,
    add column if not exists expiry_date date,
    add column if not exists weight_kg numeric(7, 2),
    add column if not exists signature_path text,
    add column if not exists registration_source text not null default 'Online application',
    add column if not exists updated_at timestamptz not null default now();

alter table public.membership_applications
    add column if not exists auth_user_id uuid references auth.users (id) on delete cascade,
    add column if not exists member_id uuid references public.members (id) on delete set null,
    add column if not exists application_type text not null default 'registration'
        check (application_type in ('registration', 'renewal')),
    add column if not exists email text,
    add column if not exists username text,
    add column if not exists weight_kg numeric(7, 2),
    add column if not exists emergency_contact_data jsonb not null default '{}'::jsonb,
    add column if not exists signature_path text,
    add column if not exists submitted_at timestamptz not null default now();

do $$
begin
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='user_id') then
        execute 'update public.members set auth_user_id = user_id where auth_user_id is null and user_id is not null';
        execute 'alter table public.members alter column user_id drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='weight') then
        execute 'update public.members set weight_kg = weight where weight_kg is null and weight is not null';
        execute 'alter table public.members alter column weight drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='signature_data') then
        execute 'update public.members set signature_path = signature_data where signature_path is null and signature_data is not null';
        execute 'alter table public.members alter column signature_data drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='application_id') then
        execute 'alter table public.members alter column application_id drop not null';
    end if;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='user_id') then
        execute 'update public.membership_applications set auth_user_id = user_id where auth_user_id is null and user_id is not null';
        execute 'alter table public.membership_applications alter column user_id drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='created_at') then
        execute 'update public.membership_applications set submitted_at = created_at where created_at is not null and (submitted_at is null or submitted_at::date = current_date)';
        execute 'alter table public.membership_applications alter column created_at drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='weight') then
        execute 'update public.membership_applications set weight_kg = weight where weight_kg is null and weight is not null';
        execute 'alter table public.membership_applications alter column weight drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='signature_data') then
        execute 'update public.membership_applications set signature_path = signature_data where signature_path is null and signature_data is not null';
        execute 'alter table public.membership_applications alter column signature_data drop not null';
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='emergency_name')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='emergency_relationship')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='membership_applications' and column_name='emergency_contact') then
        execute $sql$
            update public.membership_applications
            set emergency_contact_data = jsonb_strip_nulls(jsonb_build_object(
                'name', nullif(emergency_name, ''),
                'relationship', nullif(emergency_relationship, ''),
                'contact', nullif(emergency_contact, '')
            ))
            where emergency_contact_data = '{}'::jsonb
        $sql$;
        execute 'alter table public.membership_applications alter column emergency_name drop not null';
        execute 'alter table public.membership_applications alter column emergency_relationship drop not null';
        execute 'alter table public.membership_applications alter column emergency_contact drop not null';
    end if;
end;
$$;

create index if not exists members_application_id_idx on public.members (application_id);
create unique index if not exists members_auth_user_id_unique_idx on public.members (auth_user_id);
create index if not exists applications_auth_user_id_idx on public.membership_applications (auth_user_id);
create index if not exists applications_status_submitted_idx on public.membership_applications (status, submitted_at desc);

-- Remove the known duplicate profile trigger left by the earlier setup.
drop trigger if exists on_auth_user_created_profile on auth.users;

notify pgrst, 'reload schema';

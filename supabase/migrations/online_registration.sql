-- Compatibility columns for connecting the current online registration flow.
-- This migration preserves existing rows and leaves legacy columns in place.

alter table public.members
    add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
    add column if not exists email text,
    add column if not exists username text,
    add column if not exists date_of_birth date,
    add column if not exists age smallint,
    add column if not exists sex text,
    add column if not exists weight_kg numeric(7, 2),
    add column if not exists emergency_contact jsonb not null default '{}'::jsonb,
    add column if not exists plan_price numeric(12, 2) not null default 0,
    add column if not exists expiry_date date,
    add column if not exists registration_source text not null default 'Online application',
    add column if not exists signature_path text,
    add column if not exists updated_at timestamptz not null default now();

alter table public.membership_applications
    add column if not exists auth_user_id uuid references auth.users (id) on delete cascade,
    add column if not exists member_id uuid references public.members (id) on delete set null,
    add column if not exists application_type text not null default 'registration'
        check (application_type in ('registration', 'renewal')),
    add column if not exists submitted_at timestamptz not null default now(),
    add column if not exists email text,
    add column if not exists username text;

-- Keep the older auth link populated for the legacy NOT NULL column and copy
-- legacy values into the canonical columns used by the app and RLS policies.
update public.members
set auth_user_id = user_id
where auth_user_id is null and user_id is not null;

update public.members
set expiry_date = end_date
where expiry_date is null and end_date is not null;

update public.members
set plan_price = paid
where plan_price = 0 and paid > 0;

update public.members
set weight_kg = weight
where weight_kg is null and weight is not null;

update public.members m
set email = u.email
from auth.users u
where u.id = coalesce(m.auth_user_id, m.user_id)
  and m.email is null;

update public.members m
set username = p.username
from public.profiles p
where p.id = coalesce(m.auth_user_id, m.user_id)
  and m.username is null;

update public.membership_applications
set auth_user_id = user_id
where auth_user_id is null and user_id is not null;

update public.membership_applications
set submitted_at = created_at
where created_at is not null
  and submitted_at is distinct from created_at;

create unique index if not exists members_auth_user_id_unique_idx
    on public.members (auth_user_id);
create index if not exists applications_auth_user_id_idx
    on public.membership_applications (auth_user_id);
create index if not exists applications_status_submitted_idx
    on public.membership_applications (status, submitted_at desc);

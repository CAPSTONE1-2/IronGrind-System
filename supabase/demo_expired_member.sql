-- One-time test fixture for the Supabase membership archive flow.
-- Run after registration_schema_compatibility.sql and
-- admin_membership_operations.sql have been applied.
-- This inserts a clearly labeled test member; it does not create a sale or Auth user.

with test_values as (
    select
        gen_random_uuid() as test_id,
        (now() at time zone 'Asia/Manila')::date as manila_today
), inserted_member as (
    insert into public.members (
        id,
        auth_user_id,
        user_id,
        application_id,
        full_name,
        email,
        username,
        mobile,
        plan,
        plan_price,
        start_date,
        end_date,
        expiry_date,
        status,
        paid,
        registration_source,
        fitness_goals,
        health_conditions,
        other_medical_conditions,
        emergency_contact,
        signature_path,
        created_at,
        updated_at
    )
    select
        test_id,
        null,
        null,
        null,
        'ARCHIVE TEST ' || upper(left(test_id::text, 8)),
        'archive-test-' || test_id::text || '@example.invalid',
        'archive_test_' || replace(left(test_id::text, 8), '-', ''),
        null,
        'Archive Test Membership',
        0,
        manila_today - 41,
        manila_today - 11,
        manila_today - 11,
        'expired',
        0,
        'Archive test fixture',
        '{}'::text[],
        '{}'::text[],
        '',
        '{}'::jsonb,
        null,
        now(),
        now()
    from test_values
    where not exists (
        select 1 from public.members
        where registration_source = 'Archive test fixture'
          and full_name like 'ARCHIVE TEST %'
    )
    returning id, full_name, expiry_date, status
)
select id, full_name, expiry_date, status
from inserted_member;

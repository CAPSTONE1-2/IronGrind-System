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
    v_mobile number;
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

notify pgrst, 'reload schema';

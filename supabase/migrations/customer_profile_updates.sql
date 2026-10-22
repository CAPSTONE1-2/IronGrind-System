create or replace function public.update_own_member_profile(p_full_name text, p_mobile text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_member_id uuid;
begin
    if (select auth.uid()) is null then
        raise exception 'Authentication required';
    end if;
    if nullif(btrim(p_full_name), '') is null then
        raise exception 'Full name is required';
    end if;
    if nullif(btrim(p_mobile), '') is not null and btrim(p_mobile) !~ '^09[0-9]{9}$' then
        raise exception 'Enter a valid PH mobile number';
    end if;

    update public.members
    set full_name = btrim(p_full_name),
        mobile = nullif(btrim(p_mobile), ''),
        updated_at = now()
    where auth_user_id = (select auth.uid())
    returning id into v_member_id;

    if v_member_id is null then
        raise exception 'No member record is linked to this account';
    end if;

    update public.profiles
    set full_name = btrim(p_full_name)
    where id = (select auth.uid());
end;
$$;

revoke all on function public.update_own_member_profile(text, text) from public, anon, authenticated;
grant execute on function public.update_own_member_profile(text, text) to authenticated;
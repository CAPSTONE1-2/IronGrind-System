-- Allow members to submit renewal applications only during the five calendar
-- days leading up to their current expiry date (including expiry day).

create or replace function public.enforce_member_renewal_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    membership_expiry date;
begin
    if new.application_type <> 'renewal' then
        return new;
    end if;

    select coalesce(m.expiry_date, m.end_date)
    into membership_expiry
    from public.members m
    where m.id = new.member_id
      and coalesce(m.auth_user_id, m.user_id) = new.auth_user_id;

    if not found or membership_expiry is null then
        raise exception 'A linked membership with an expiry date is required for renewal.';
    end if;

    if membership_expiry < current_date or membership_expiry > current_date + 5 then
        raise exception 'Renewal requests can be submitted only during the five days before expiry.';
    end if;

    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_trigger
        where tgname = 'membership_application_renewal_window'
          and tgrelid = 'public.membership_applications'::regclass
          and not tgisinternal
    ) then
        create trigger membership_application_renewal_window
            before insert on public.membership_applications
            for each row execute function public.enforce_member_renewal_window();
    end if;
end;
$$;

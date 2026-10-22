-- Admin-created members do not have an online application to reference.
-- Keep the legacy link column for applicants, but allow it to be empty for
-- members created directly by an administrator.
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'members'
          and column_name = 'application_id'
          and is_nullable = 'NO'
    ) then
        alter table public.members alter column application_id drop not null;
    end if;
end;
$$;

notify pgrst, 'reload schema';

-- Enable Realtime events used by the staff dashboard and member attendance view.
-- Safe to rerun: tables already in the publication are skipped.

do $$
declare
    target_table text;
begin
    if not exists (
        select 1 from pg_catalog.pg_publication
        where pubname = 'supabase_realtime'
    ) then
        raise exception 'The supabase_realtime publication does not exist in this project.';
    end if;

    foreach target_table in array array['membership_applications', 'attendance'] loop
        if to_regclass(format('public.%I', target_table)) is null then
            raise exception 'Required Realtime table public.% does not exist.', target_table;
        end if;
        if not exists (
            select 1 from pg_catalog.pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = target_table
        ) then
            execute format('alter publication supabase_realtime add table public.%I', target_table);
        end if;
    end loop;
end;
$$;

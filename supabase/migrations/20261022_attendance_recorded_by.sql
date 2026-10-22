-- Add the staff Auth user link used by the current attendance check-in flow.
-- Existing attendance rows remain valid and keep a null recorded_by value.
alter table public.attendance
    add column if not exists recorded_by uuid references auth.users (id) on delete set null;

notify pgrst, 'reload schema';

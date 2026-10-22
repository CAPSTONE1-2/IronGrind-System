alter table public.members
    drop constraint if exists members_height_unit_check;

alter table public.members
    add constraint members_height_unit_check
    check (height_unit is null or height_unit in ('cm', 'in', 'ft'));

alter table public.membership_applications
    drop constraint if exists membership_applications_height_unit_check;

alter table public.membership_applications
    add constraint membership_applications_height_unit_check
    check (height_unit is null or height_unit in ('cm', 'in', 'ft'));
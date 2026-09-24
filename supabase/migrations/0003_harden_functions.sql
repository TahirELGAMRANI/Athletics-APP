-- Security advisor fixes: pin search_path and restrict who can call helper functions.
alter function public.campus_now() set search_path = '';
alter function public.open_hours(date) set search_path = '';

-- Trigger functions are never called directly.
revoke execute on function public.inventory_touch() from public, anon, authenticated;
revoke execute on function public.protect_role() from public, anon, authenticated;
revoke execute on function public.validate_booking() from public, anon, authenticated;

-- Policy helpers and booked_slots are for signed-in users only.
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_super() from public, anon;
revoke execute on function public.is_staff_admin() from public, anon;
revoke execute on function public.coaches_team(uuid) from public, anon;
revoke execute on function public.coaches_player(uuid) from public, anon;
revoke execute on function public.is_my_player(uuid) from public, anon;
revoke execute on function public.plays_for(uuid) from public, anon;
revoke execute on function public.can_read_player_folder(text) from public, anon;
revoke execute on function public.can_write_player_folder(text) from public, anon;
revoke execute on function public.booked_slots(date) from public, anon;

-- Test accounts (one per role). Password for all: Lions2026!
-- Uses the @demo.aui.ma sub-domain so they can never collide with real AUI inboxes.
do $$
declare
  acc record;
  uid uuid;
begin
  for acc in select * from (values
    ('director@demo.aui.ma',  'Athletic Director (Test)',    'super_admin', 'Athletic Director'),
    ('assistant@demo.aui.ma', 'Assistant Director (Test)',   'super_admin', 'Assistant Athletic Director'),
    ('inventory@demo.aui.ma', 'Inventory Staff (Test)',      'admin',       'Inventory & Equipment Officer'),
    ('coach@demo.aui.ma',     'Volleyball Coach (Test)',     'coach',       'Head Coach — Women''s Volleyball'),
    ('player@demo.aui.ma',    'Oumnia Rida',                 'player',      null),
    ('student@demo.aui.ma',   'Student (Test)',              'student',     null)
  ) v(email, full_name, role, title)
  loop
    if exists (select 1 from auth.users where email = acc.email) then continue; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acc.email,
      extensions.crypt('Lions2026!', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', acc.role),
      jsonb_build_object('full_name', acc.full_name, 'title', acc.title), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', acc.email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;
end $$;

-- Coach -> Women's Volleyball
insert into public.team_coaches (team_id, profile_id)
select t.id, p.id from public.teams t, public.profiles p
where t.name = 'Women''s Volleyball' and p.email = 'coach@demo.aui.ma'
on conflict do nothing;

-- Player account -> Oumnia Rida's roster entry
update public.players set profile_id = (select id from public.profiles where email = 'player@demo.aui.ma'),
  email = 'player@demo.aui.ma'
where full_name = 'Oumnia Rida';

-- Staff records for the staff accounts
insert into public.staff (profile_id, full_name, role_title, employment_type, status, email, team_id)
select p.id, p.full_name, p.title, 'employee', 'active', p.email,
       case when p.role = 'coach' then (select id from public.teams where name = 'Women''s Volleyball') end
from public.profiles p
where p.role in ('super_admin', 'admin', 'coach')
  and not exists (select 1 from public.staff s where s.profile_id = p.id);

-- AUI Athletics — core schema, row level security and storage
-- Day of week convention everywhere: 1 = Monday … 7 = Sunday (ISO).
-- Campus time zone: Africa/Casablanca.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'admin', 'coach', 'player', 'student');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.doc_category as enum ('medical', 'psychology', 'physical', 'contract', 'other');
create type public.game_type as enum ('friendly', 'official');
create type public.game_status as enum ('scheduled', 'completed', 'cancelled');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.txn_type as enum ('income', 'expense');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'student',
  title text,                      -- e.g. "Athletic Director", "Head Coach"
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('super_admin', 'admin') from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- Teams, coaches, players
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sport text not null,
  gender text not null default 'mixed' check (gender in ('women', 'men', 'mixed')),
  description text,
  created_at timestamptz not null default now()
);

create table public.team_coaches (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_head boolean not null default true,
  primary key (team_id, profile_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  position text,
  jersey_number int,
  team_role text,                  -- Captain / Vice Captain
  status text not null default 'active' check (status in ('active', 'injured', 'inactive')),
  email text,
  phone text,
  date_of_birth date,
  height_cm numeric,
  weight_kg numeric,
  major text,
  bio text,
  created_at timestamptz not null default now()
);
create index on public.players (team_id);
create index on public.players (profile_id);

create or replace function public.coaches_team(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_coaches where team_id = t and profile_id = auth.uid())
$$;

create or replace function public.coaches_player(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    join public.team_coaches tc on tc.team_id = pl.team_id
    where pl.id = p and tc.profile_id = auth.uid())
$$;

create or replace function public.is_my_player(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players where id = p and profile_id = auth.uid())
$$;

create or replace function public.plays_for(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players where team_id = t and profile_id = auth.uid())
$$;

-- Player private data (portfolio) -------------------------------------------
create table public.player_documents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  category public.doc_category not null,
  title text not null,
  file_path text,                  -- storage path in bucket "player-docs"
  notes text,
  doc_date date default current_date,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.player_documents (player_id);

create table public.physical_tests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid references public.players (id) on delete set null,
  athlete_name text not null,
  session_label text not null,     -- e.g. "1st Physical Testing"
  test_date date,
  beep_stage numeric,
  agility_t1 numeric, agility_t2 numeric,
  illinois_t1 numeric, illinois_t2 numeric,
  sprint_t1 numeric, sprint_t2 numeric,
  laps numeric,
  best_agility numeric, best_illinois numeric, best_sprint numeric, distance_m numeric,
  score_beep numeric, score_agility numeric, score_illinois numeric, score_sprint numeric, score_distance numeric,
  composite numeric,
  rank int,
  passed boolean,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.physical_tests (team_id);
create index on public.physical_tests (player_id);

create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  visible_to_player boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.player_notes (player_id);

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  unit text,
  target numeric,
  higher_is_better boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.kpi_entries (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  value numeric not null,
  recorded_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index on public.kpi_entries (player_id);

-- Attendance -------------------------------------------------------------------
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  session_date date not null default current_date,
  title text not null default 'Practice',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.attendance (
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status public.attendance_status not null,
  note text,
  primary key (session_id, player_id)
);
create index on public.attendance (player_id);

create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  month date not null,             -- first day of the month rated
  rating int not null check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now(),
  unique (player_id, month)
);

-- Games ----------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent text not null,
  game_date date not null,
  game_time time,
  location text,
  home boolean not null default true,
  game_type public.game_type not null default 'official',
  competition text,
  status public.game_status not null default 'scheduled',
  our_score int,
  their_score int,
  game_plan text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.games (team_id, game_date);

-- Staff (HR) -----------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  role_title text not null,
  employment_type text not null default 'employee' check (employment_type in ('employee', 'volunteer', 'contractor', 'intern')),
  status text not null default 'active' check (status in ('active', 'on_leave', 'inactive')),
  salary numeric,
  salary_period text default 'monthly',
  email text, phone text, national_id text, address text,
  date_of_birth date, start_date date,
  team_id uuid references public.teams (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Facilities & schedules -----------------------------------------------------
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort int not null default 0
);

create table public.facility_schedule (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  activity text not null,
  team_id uuid references public.teams (id) on delete set null,
  note text,
  check (end_time > start_time)
);
create index on public.facility_schedule (facility_id, day_of_week);

-- Bookable resources & bookings ---------------------------------------------
create table public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('bike', 'padel', 'tennis', 'ice_bath', 'sauna')),
  facility_id uuid references public.facilities (id) on delete set null,
  capacity int not null default 1,
  slot_minutes int not null default 60,
  same_day_only boolean not null default false,
  min_notice_hours int not null default 0,
  allowed_roles public.app_role[] not null default '{super_admin,admin,coach,player,student}',
  active boolean not null default true,
  sort int not null default 0
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.booking_resources (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status public.booking_status not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on public.bookings (resource_id, booking_date);

-- Inventory ------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  quantity int not null default 0 check (quantity >= 0),
  min_quantity int not null default 0,
  location text,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  change int not null,
  reason text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Clubs ----------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  description text,
  president text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  full_name text not null,
  email text,
  role text not null default 'Member',
  joined_on date default current_date
);

create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null,
  description text,
  event_date date,
  location text,
  planning text,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  budget numeric
);

-- Finance --------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  txn_date date not null default current_date,
  txn_type public.txn_type not null,
  category text not null,
  amount numeric not null check (amount >= 0),
  description text,
  team_id uuid references public.teams (id) on delete set null,
  club_id uuid references public.clubs (id) on delete set null,
  method text,
  reference text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth trigger: create the profile. Self sign-ups must use an @aui.ma email.
-- Accounts created by a super admin carry app_metadata.role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r text := new.raw_app_meta_data ->> 'role';
begin
  if r is null and lower(new.email) not like '%@aui.ma' then
    raise exception 'Please sign up with your AUI email (@aui.ma)';
  end if;
  insert into public.profiles (id, email, full_name, role, title)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          coalesce(r, 'student')::public.app_role,
          new.raw_user_meta_data ->> 'title');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Only super admins may change roles.
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_super() and auth.uid() is not null then
    raise exception 'Only a super admin can change roles';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
for each row execute function public.protect_role();

-- Inventory: keep updated_at fresh and log quantity changes.
create or replace function public.inventory_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.quantity <> old.quantity then
    insert into public.inventory_movements (item_id, change, reason, user_id)
    values (new.id, new.quantity - old.quantity, 'Quantity updated', auth.uid());
  end if;
  return new;
end $$;
create trigger inventory_touch before update on public.inventory_items
for each row execute function public.inventory_touch();

-- ---------------------------------------------------------------------------
-- Booking rules
-- ---------------------------------------------------------------------------
create or replace function public.campus_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Africa/Casablanca') $$;

create or replace function public.open_hours(d date, out opens time, out closes time)
language sql immutable as $$
  select case when extract(isodow from d) >= 6 then time '11:00' else time '08:00' end,
         case when extract(isodow from d) >= 6 then time '21:00' else time '23:00' end
$$;

create or replace function public.validate_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  res public.booking_resources;
  hrs record;
  used int;
  privileged boolean := public.is_staff_admin();
begin
  if new.status = 'cancelled' then return new; end if;
  select * into res from public.booking_resources where id = new.resource_id;
  if not res.active then raise exception 'This resource is not available for booking'; end if;
  if not privileged and not (public.my_role() = any (res.allowed_roles)) then
    raise exception 'Your role cannot book %', res.name;
  end if;

  select * into hrs from public.open_hours(new.booking_date);
  if new.start_time < hrs.opens or new.end_time > hrs.closes then
    raise exception 'Facilities are open % – % on that day', to_char(hrs.opens, 'HH24:MI'), to_char(hrs.closes, 'HH24:MI');
  end if;

  if not privileged then
    if (new.booking_date + new.end_time) <= public.campus_now() then
      raise exception 'That time has already passed';
    end if;
    if res.same_day_only and new.booking_date <> public.campus_now()::date then
      raise exception '% can only be booked for today', res.name;
    end if;
    if res.min_notice_hours > 0 and (new.booking_date + new.start_time) < public.campus_now() + make_interval(hours => res.min_notice_hours) then
      raise exception '% must be booked at least % hours in advance', res.name, res.min_notice_hours;
    end if;
  end if;

  if res.facility_id is not null and exists (
    select 1 from public.facility_schedule s
    where s.facility_id = res.facility_id
      and s.day_of_week = extract(isodow from new.booking_date)
      and s.start_time < new.end_time and s.end_time > new.start_time) then
    raise exception 'The court is reserved for a team program at that time';
  end if;

  select count(*) into used from public.bookings b
  where b.resource_id = new.resource_id and b.booking_date = new.booking_date
    and b.status in ('pending', 'confirmed') and b.id <> new.id
    and b.start_time < new.end_time and b.end_time > new.start_time;
  if used >= res.capacity then
    raise exception '% is fully booked at that time', res.name;
  end if;
  return new;
end $$;

create trigger bookings_validate before insert or update on public.bookings
for each row execute function public.validate_booking();

-- Anonymous occupancy (no names) so everyone can see free slots.
create or replace function public.booked_slots(d date)
returns table (resource_id uuid, start_time time, end_time time, taken int)
language sql stable security definer set search_path = '' as $$
  select resource_id, start_time, end_time, count(*)::int
  from public.bookings
  where booking_date = d and status in ('pending', 'confirmed')
  group by resource_id, start_time, end_time
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_coaches enable row level security;
alter table public.players enable row level security;
alter table public.player_documents enable row level security;
alter table public.physical_tests enable row level security;
alter table public.player_notes enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_entries enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.session_feedback enable row level security;
alter table public.games enable row level security;
alter table public.staff enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_schedule enable row level security;
alter table public.booking_resources enable row level security;
alter table public.bookings enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_events enable row level security;
alter table public.transactions enable row level security;

-- profiles
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('super_admin', 'admin', 'coach')
         or role in ('super_admin', 'admin', 'coach'));  -- staff directory is visible to everyone
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_super()) with check (id = auth.uid() or public.is_super());
create policy "profiles super delete" on public.profiles for delete to authenticated using (public.is_super());

-- public reference data: everyone signed in can read
create policy "teams read" on public.teams for select to authenticated using (true);
create policy "teams write" on public.teams for all to authenticated using (public.is_super()) with check (public.is_super());

create policy "team_coaches read" on public.team_coaches for select to authenticated using (true);
create policy "team_coaches write" on public.team_coaches for all to authenticated using (public.is_super()) with check (public.is_super());

create policy "players read" on public.players for select to authenticated using (true);
create policy "players write" on public.players for all to authenticated
  using (public.is_super() or public.coaches_team(team_id))
  with check (public.is_super() or public.coaches_team(team_id));

create policy "games read" on public.games for select to authenticated using (true);
create policy "games write" on public.games for all to authenticated
  using (public.is_super() or public.coaches_team(team_id))
  with check (public.is_super() or public.coaches_team(team_id));

create policy "facilities read" on public.facilities for select to authenticated using (true);
create policy "facilities write" on public.facilities for all to authenticated using (public.is_super()) with check (public.is_super());
create policy "schedule read" on public.facility_schedule for select to authenticated using (true);
create policy "schedule write" on public.facility_schedule for all to authenticated using (public.is_super()) with check (public.is_super());

create policy "clubs read" on public.clubs for select to authenticated using (true);
create policy "clubs write" on public.clubs for all to authenticated using (public.is_super()) with check (public.is_super());
create policy "club_members read" on public.club_members for select to authenticated using (true);
create policy "club_members write" on public.club_members for all to authenticated using (public.is_super()) with check (public.is_super());
create policy "club_events read" on public.club_events for select to authenticated using (true);
create policy "club_events write" on public.club_events for all to authenticated using (public.is_super()) with check (public.is_super());

-- player portfolio: super admin, the team's coaches, and the player themself
create policy "docs read" on public.player_documents for select to authenticated
  using (public.is_super() or public.coaches_player(player_id) or public.is_my_player(player_id));
create policy "docs write" on public.player_documents for all to authenticated
  using (public.is_super() or public.coaches_player(player_id))
  with check (public.is_super() or public.coaches_player(player_id));

create policy "tests read" on public.physical_tests for select to authenticated
  using (public.is_super() or public.coaches_team(team_id) or public.is_my_player(player_id));
create policy "tests write" on public.physical_tests for all to authenticated
  using (public.is_super() or public.coaches_team(team_id))
  with check (public.is_super() or public.coaches_team(team_id));

create policy "notes read" on public.player_notes for select to authenticated
  using (public.is_super() or public.coaches_player(player_id) or (visible_to_player and public.is_my_player(player_id)));
create policy "notes write" on public.player_notes for all to authenticated
  using (public.is_super() or public.coaches_player(player_id))
  with check (public.is_super() or public.coaches_player(player_id));

create policy "kpis read" on public.kpis for select to authenticated
  using (public.is_super() or public.coaches_team(team_id) or public.plays_for(team_id));
create policy "kpis write" on public.kpis for all to authenticated
  using (public.is_super() or public.coaches_team(team_id))
  with check (public.is_super() or public.coaches_team(team_id));
create policy "kpi entries read" on public.kpi_entries for select to authenticated
  using (public.is_super() or public.coaches_player(player_id) or public.is_my_player(player_id));
create policy "kpi entries write" on public.kpi_entries for all to authenticated
  using (public.is_super() or public.coaches_player(player_id))
  with check (public.is_super() or public.coaches_player(player_id));

create policy "sessions read" on public.practice_sessions for select to authenticated
  using (public.is_super() or public.coaches_team(team_id) or public.plays_for(team_id));
create policy "sessions write" on public.practice_sessions for all to authenticated
  using (public.is_super() or public.coaches_team(team_id))
  with check (public.is_super() or public.coaches_team(team_id));
create policy "attendance read" on public.attendance for select to authenticated
  using (public.is_super() or public.coaches_player(player_id) or public.is_my_player(player_id));
create policy "attendance write" on public.attendance for all to authenticated
  using (public.is_super() or public.coaches_player(player_id))
  with check (public.is_super() or public.coaches_player(player_id));

create policy "feedback read" on public.session_feedback for select to authenticated
  using (public.is_super() or public.coaches_team(team_id) or public.is_my_player(player_id));
create policy "feedback insert" on public.session_feedback for insert to authenticated
  with check (public.is_my_player(player_id));
create policy "feedback update" on public.session_feedback for update to authenticated
  using (public.is_my_player(player_id)) with check (public.is_my_player(player_id));
create policy "feedback delete" on public.session_feedback for delete to authenticated using (public.is_super());

-- HR & finance: super admins only (coaches can see their own staff record)
create policy "staff read" on public.staff for select to authenticated using (public.is_super() or profile_id = auth.uid());
create policy "staff write" on public.staff for all to authenticated using (public.is_super()) with check (public.is_super());
create policy "txn all" on public.transactions for all to authenticated using (public.is_super()) with check (public.is_super());

-- Inventory: inventory staff (admin) can view, super admin manages
create policy "inventory read" on public.inventory_items for select to authenticated using (public.is_staff_admin());
create policy "inventory write" on public.inventory_items for all to authenticated using (public.is_super()) with check (public.is_super());
create policy "movements read" on public.inventory_movements for select to authenticated using (public.is_staff_admin());
create policy "movements write" on public.inventory_movements for insert to authenticated with check (public.is_super());
create policy "movements update" on public.inventory_movements for update to authenticated using (public.is_super()) with check (public.is_super());

-- Bookings
create policy "resources read" on public.booking_resources for select to authenticated using (true);
create policy "resources write" on public.booking_resources for all to authenticated using (public.is_staff_admin()) with check (public.is_staff_admin());
create policy "bookings read" on public.bookings for select to authenticated using (user_id = auth.uid() or public.is_staff_admin());
create policy "bookings insert" on public.bookings for insert to authenticated with check (user_id = auth.uid() or public.is_staff_admin());
create policy "bookings update" on public.bookings for update to authenticated
  using (user_id = auth.uid() or public.is_staff_admin()) with check (user_id = auth.uid() or public.is_staff_admin());
create policy "bookings delete" on public.bookings for delete to authenticated using (public.is_staff_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for portfolio pictures, path = <player_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('player-docs', 'player-docs', false)
on conflict (id) do nothing;

create or replace function public.can_read_player_folder(obj_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare pid uuid;
begin
  begin pid := (storage.foldername(obj_name))[1]::uuid; exception when others then return false; end;
  return public.is_super() or public.coaches_player(pid) or public.is_my_player(pid);
end $$;

create or replace function public.can_write_player_folder(obj_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare pid uuid;
begin
  begin pid := (storage.foldername(obj_name))[1]::uuid; exception when others then return false; end;
  return public.is_super() or public.coaches_player(pid);
end $$;

create policy "player docs read" on storage.objects for select to authenticated
  using (bucket_id = 'player-docs' and public.can_read_player_folder(name));
create policy "player docs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-docs' and public.can_write_player_folder(name));
create policy "player docs update" on storage.objects for update to authenticated
  using (bucket_id = 'player-docs' and public.can_write_player_folder(name));
create policy "player docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'player-docs' and public.can_write_player_folder(name));

-- Lock down helper functions that should not be callable anonymously
revoke execute on function public.handle_new_user() from public, anon, authenticated;

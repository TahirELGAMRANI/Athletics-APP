export type Role = 'super_admin' | 'admin' | 'coach' | 'player' | 'student';

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Inventory Staff',
  coach: 'Coach',
  player: 'Player',
  student: 'Student',
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  title: string | null;
  phone: string | null;
};

export type Team = { id: string; name: string; sport: string; gender: string; description: string | null };

export type Player = {
  id: string;
  team_id: string;
  profile_id: string | null;
  full_name: string;
  position: string | null;
  jersey_number: number | null;
  team_role: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  major: string | null;
  bio: string | null;
};

export type Game = {
  id: string;
  team_id: string;
  opponent: string;
  game_date: string;
  game_time: string | null;
  location: string | null;
  home: boolean;
  game_type: 'friendly' | 'official';
  competition: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  our_score: number | null;
  their_score: number | null;
  game_plan: string | null;
  notes: string | null;
};

export type Facility = { id: string; slug: string; name: string; description: string | null; sort: number };

export type ScheduleItem = {
  id: string;
  facility_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  activity: string;
  team_id: string | null;
  note: string | null;
};

export type Resource = {
  id: string;
  slug: string;
  name: string;
  kind: 'bike' | 'padel' | 'tennis' | 'ice_bath' | 'sauna';
  facility_id: string | null;
  capacity: number;
  slot_minutes: number;
  same_day_only: boolean;
  min_notice_hours: number;
  allowed_roles: Role[];
  active: boolean;
};

export type Booking = {
  id: string;
  resource_id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  created_at: string;
};

export type TestResult = { test: string; unit: string | null; trials: (number | null)[]; best: number | null };
export type TestScore = { label: string; score: number | null; weight: number | null };

/** One athlete's results for one testing session (any battery of tests). */
export type PhysicalTest = {
  id: string;
  team_id: string;
  player_id: string | null;
  athlete_name: string;
  session_label: string;
  session_order: number;
  test_date: string | null;
  results: TestResult[];
  scores: TestScore[];
  method: string | null;
  composite: number | null;
  rank: number | null;
  passed: boolean | null;
  absent: boolean;
  notes: string | null;
};

export type AttendanceStatus = 'present' | 'absent' | 'excused';

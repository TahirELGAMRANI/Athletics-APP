import { must, supabase } from './supabase';
import { campusNow } from './time';
import type { Facility, Game, Player, Resource, ScheduleItem, Team } from './types';

export async function fetchTeams() {
  return must(await supabase.from('teams').select('*').order('name')) as Team[];
}

export async function fetchFacilitiesWithSchedule() {
  const [f, s] = await Promise.all([
    supabase.from('facilities').select('*').order('sort'),
    supabase.from('facility_schedule').select('*').order('day_of_week').order('start_time'),
  ]);
  const facilities = must(f) as Facility[];
  const schedule = must(s) as ScheduleItem[];
  return { facilities, schedule };
}

export async function fetchGames(opts: { teamId?: string; upcoming?: boolean; limit?: number } = {}) {
  let q = supabase.from('games').select('*');
  if (opts.teamId) q = q.eq('team_id', opts.teamId);
  const today = campusNow().date;
  if (opts.upcoming === true) q = q.gte('game_date', today).eq('status', 'scheduled').order('game_date', { ascending: true });
  else if (opts.upcoming === false) q = q.eq('status', 'completed').order('game_date', { ascending: false });
  else q = q.order('game_date', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  return must(await q) as Game[];
}

export async function fetchPlayers(teamId: string) {
  return must(
    await supabase.from('players').select('*').eq('team_id', teamId).order('jersey_number', { ascending: true, nullsFirst: false }).order('full_name'),
  ) as Player[];
}

export async function fetchResources() {
  return must(await supabase.from('booking_resources').select('*').eq('active', true).order('sort')) as Resource[];
}

export function gameResult(g: Game): { label: string; tone: 'success' | 'danger' | 'neutral' } | null {
  if (g.status !== 'completed' || g.our_score == null || g.their_score == null) return null;
  if (g.our_score > g.their_score) return { label: 'W', tone: 'success' };
  if (g.our_score < g.their_score) return { label: 'L', tone: 'danger' };
  return { label: 'D', tone: 'neutral' };
}

export const money = (n: number) =>
  `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MAD`;

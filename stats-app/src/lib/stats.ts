import type { Action, Match, Player, Side, StatEvent } from './types';

// ---------------------------------------------------------------------------
// Scoring rules
// ---------------------------------------------------------------------------
const US_POINT: Action[] = ['ACE', 'K', 'BS', 'BA', 'OPP_ERR'];
const THEM_POINT: Action[] = ['SE', 'AE', 'BHE', 'BE', 'R0', 'DE', 'OPP_PT', 'TEAM_ERR'];

/** Who wins the rally for this action (a second/third block assist on the same block scores nothing). */
export function pointFor(action: Action, previous: StatEvent | undefined): Side | null {
  if (action === 'BA' && previous?.action === 'BA' && previous.point === 'us') return null;
  if (US_POINT.includes(action)) return 'us';
  if (THEM_POINT.includes(action)) return 'them';
  return null;
}

export function setTarget(match: Match, set: number) {
  return set === match.bestOf ? 15 : 25;
}

export function setsToWin(match: Match) {
  return Math.ceil(match.bestOf / 2);
}

export function isSetOver(match: Match, us: number, them: number, set = match.currentSet) {
  const target = setTarget(match, set);
  return (us >= target || them >= target) && Math.abs(us - them) >= 2;
}

export function setsWon(match: Match) {
  return {
    us: match.sets.filter((s) => s.us > s.them).length,
    them: match.sets.filter((s) => s.them > s.us).length,
  };
}

/** Current score and server for the set in progress. */
export function liveState(match: Match) {
  const events = match.events.filter((e) => e.set === match.currentSet);
  const last = events[events.length - 1];
  const firstServe = match.firstServe[match.currentSet - 1] ?? 'us';
  let serving: Side = firstServe;
  let us = 0;
  let them = 0;
  for (const e of events) {
    if (e.point) {
      serving = e.point;
      us = e.us;
      them = e.them;
    }
  }
  return { us, them, serving, last, events };
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------
export type Line = {
  sp: number; // sets played
  k: number;
  ae: number;
  ta: number;
  ast: number;
  bhe: number;
  sa: number; // service aces
  se: number;
  srvTa: number; // total serve attempts
  r3: number;
  r2: number;
  r1: number;
  r0: number;
  dig: number;
  de: number;
  bs: number;
  ba: number;
  be: number;
  pts: number;
};

export const emptyLine = (): Line => ({
  sp: 0, k: 0, ae: 0, ta: 0, ast: 0, bhe: 0, sa: 0, se: 0, srvTa: 0,
  r3: 0, r2: 0, r1: 0, r0: 0, dig: 0, de: 0, bs: 0, ba: 0, be: 0, pts: 0,
});

function apply(line: Line, a: Action) {
  switch (a) {
    case 'K': line.k++; line.ta++; break;
    case 'AE': line.ae++; line.ta++; break;
    case 'ATT': line.ta++; break;
    case 'AST': line.ast++; break;
    case 'BHE': line.bhe++; break;
    case 'ACE': line.sa++; line.srvTa++; break;
    case 'SE': line.se++; line.srvTa++; break;
    case 'SRV': line.srvTa++; break;
    case 'R3': line.r3++; break;
    case 'R2': line.r2++; break;
    case 'R1': line.r1++; break;
    case 'R0': line.r0++; break;
    case 'DIG': line.dig++; break;
    case 'DE': line.de++; break;
    case 'BS': line.bs++; break;
    case 'BA': line.ba++; break;
    case 'BE': line.be++; break;
  }
}

function finish(line: Line) {
  line.pts = line.k + line.sa + line.bs + line.ba / 2;
  return line;
}

export const hitPct = (l: Line) => (l.ta ? (l.k - l.ae) / l.ta : null);
export const recAtt = (l: Line) => l.r3 + l.r2 + l.r1 + l.r0;
export const passAvg = (l: Line) => {
  const n = recAtt(l);
  return n ? (3 * l.r3 + 2 * l.r2 + l.r1) / n : null;
};
export const totalBlocks = (l: Line) => l.bs + l.ba / 2;

/** ".312", "-.050", "1.000" — the NCAA hitting percentage format. */
export function fmtPct(v: number | null) {
  if (v === null) return '.000';
  const s = Math.abs(v).toFixed(3).replace(/^0/, '');
  return v < 0 ? `-${s}` : s;
}
export const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
export const fmtAvg = (v: number | null) => (v === null ? '-' : v.toFixed(2));
export const fmtPercent = (num: number, den: number) => (den ? `${Math.round((num / den) * 100)}%` : '-');

export type BoxScore = {
  players: { player: Player; line: Line }[];
  team: Line;
  /** Team attacking/serving/points by set. */
  bySet: { set: number; line: Line; us: number; them: number; oppErr: number; teamErr: number }[];
  oppErrors: number;
  teamErrors: number;
  sideOut: { won: number; of: number };
  pointScoring: { won: number; of: number };
  longestRun: number;
};

export function boxScore(match: Match, set?: number): BoxScore {
  const events = set ? match.events.filter((e) => e.set === set) : match.events;
  const lines = new Map<string, Line>(match.players.map((p) => [p.id, emptyLine()]));
  const played = new Map<string, Set<number>>();
  const team = emptyLine();
  let oppErrors = 0;
  let teamErrors = 0;

  for (const e of events) {
    if (e.action === 'OPP_ERR') oppErrors++;
    if (e.action === 'TEAM_ERR') teamErrors++;
    if (!e.playerId) continue;
    const line = lines.get(e.playerId);
    if (!line) continue;
    apply(line, e.action);
    apply(team, e.action);
    if (!played.has(e.playerId)) played.set(e.playerId, new Set());
    played.get(e.playerId)!.add(e.set);
  }

  for (const [id, line] of lines) {
    line.sp = played.get(id)?.size ?? 0;
    finish(line);
  }
  const setsPlayed = new Set(events.map((e) => e.set)).size;
  team.sp = setsPlayed;
  finish(team);

  // Rally efficiency: side-out % (opponent serving) and point-scoring % (we serve).
  const rallies = events.filter((e) => e.point);
  const sideOut = { won: 0, of: 0 };
  const pointScoring = { won: 0, of: 0 };
  let run = 0;
  let longestRun = 0;
  let prevSet = 0;
  for (const e of rallies) {
    const bucket = e.serving === 'them' ? sideOut : pointScoring;
    bucket.of++;
    if (e.point === 'us') bucket.won++;
    if (e.set !== prevSet) run = 0;
    prevSet = e.set;
    run = e.point === 'us' ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }

  const setNumbers = [...new Set(match.events.map((e) => e.set))].sort((a, b) => a - b);
  const bySet = set
    ? []
    : setNumbers.map((n) => {
        const sub = boxScore(match, n);
        const final = match.sets[n - 1] ?? scoreAt(match, n);
        return { set: n, line: sub.team, us: final.us, them: final.them, oppErr: sub.oppErrors, teamErr: sub.teamErrors };
      });

  return {
    players: match.players.map((player) => ({ player, line: lines.get(player.id)! })),
    team,
    bySet,
    oppErrors,
    teamErrors,
    sideOut,
    pointScoring,
    longestRun,
  };
}

function scoreAt(match: Match, set: number) {
  const last = [...match.events].reverse().find((e) => e.set === set && e.point);
  return { us: last?.us ?? 0, them: last?.them ?? 0 };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
export const ACTION_LABEL: Record<Action, string> = {
  SRV: 'Serve in',
  ACE: 'Ace',
  SE: 'Service error',
  ATT: 'Attack attempt',
  K: 'Kill',
  AE: 'Attack error',
  AST: 'Assist',
  BHE: 'Ball handling error',
  BS: 'Block solo',
  BA: 'Block assist',
  BE: 'Block error',
  R3: 'Pass 3',
  R2: 'Pass 2',
  R1: 'Pass 1',
  R0: 'Reception error',
  DIG: 'Dig',
  DE: 'Dig error',
  OPP_ERR: 'Opponent error',
  OPP_PT: 'Opponent point',
  TEAM_ERR: 'Team error',
};

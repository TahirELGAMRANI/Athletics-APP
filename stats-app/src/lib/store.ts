import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { liveState, pointFor, setsToWin, setsWon } from './stats';
import type { Action, Match, Player, Position, Side, StatEvent } from './types';

const KEY = 'vbstats:v1';

type State = {
  loaded: boolean;
  teamName: string;
  roster: Player[];
  matches: Match[];
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Default roster: AUI Women's Volleyball.
const seed: [string, string, Position][] = [
  ['9', 'Oumnia Rida', 'OH'],
  ['2', 'Rim Namiri', 'S'],
  ['', 'Zineb Andaloussi', 'S'],
  ['', 'Meryem Ahmedechrif', 'OH'],
  ['', 'Rim Maouni', 'OH'],
  ['13', 'Hajar Ouardighi', 'OH'],
  ['15', 'Weam Rochdi', 'OH'],
  ['3', 'Nourane Benmansour', 'MB'],
  ['5', 'Amal Kabbaj', 'MB'],
  ['', 'Riham', 'MB'],
  ['', 'Hiba', 'OPP'],
  ['10', 'Iman El Isamy', 'OPP'],
  ['1', 'Aya Kamili', 'L'],
  ['', 'Alaa', 'L'],
];

let state: State = {
  loaded: false,
  teamName: "AUI Women's Volleyball",
  roster: seed.map(([number, name, position]) => ({ id: uid(), number, name, position })),
  matches: [],
};

const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { loaded: _loaded, ...data } = state;
    AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, 150);
}

export async function loadStore() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {}
  state = { ...state, loaded: true };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export const useMatch = (id: string | undefined) => useStore((s) => s.matches.find((m) => m.id === id));

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
export const setTeamName = (teamName: string) => set({ teamName });

export function savePlayer(player: Player) {
  const exists = state.roster.some((p) => p.id === player.id);
  set({ roster: exists ? state.roster.map((p) => (p.id === player.id ? player : p)) : [...state.roster, player] });
}

export const removePlayer = (id: string) => set({ roster: state.roster.filter((p) => p.id !== id) });

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
function updateMatch(id: string, fn: (m: Match) => Match) {
  set({ matches: state.matches.map((m) => (m.id === id ? fn(m) : m)) });
}

export function createMatch(input: { opponent: string; location: string; date: string; bestOf: 3 | 5; playerIds: string[]; firstServe: Side }) {
  const match: Match = {
    id: uid(),
    createdAt: Date.now(),
    date: input.date,
    teamName: state.teamName,
    opponent: input.opponent,
    location: input.location,
    bestOf: input.bestOf,
    players: sortPlayers(state.roster.filter((p) => input.playerIds.includes(p.id))),
    events: [],
    currentSet: 1,
    sets: [],
    firstServe: [input.firstServe],
    finished: false,
  };
  set({ matches: [match, ...state.matches] });
  return match.id;
}

export const deleteMatch = (id: string) => set({ matches: state.matches.filter((m) => m.id !== id) });

export function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name));
}

/** Recompute points, serving team and running score for every event (after edits or deletes). */
function rebuild(match: Match): Match {
  const out: StatEvent[] = [];
  let setNo = 0;
  let us = 0;
  let them = 0;
  let serving: Side = 'us';
  for (const e of match.events) {
    if (e.set !== setNo) {
      setNo = e.set;
      us = 0;
      them = 0;
      serving = match.firstServe[e.set - 1] ?? 'us';
    }
    const prev = out[out.length - 1];
    const point = pointFor(e.action, prev?.set === e.set ? prev : undefined);
    const ev = { ...e, point, serving, us: us + (point === 'us' ? 1 : 0), them: them + (point === 'them' ? 1 : 0) };
    us = ev.us;
    them = ev.them;
    if (point) serving = point;
    out.push(ev);
  }
  return { ...match, events: out };
}

export function record(matchId: string, playerId: string | null, action: Action) {
  updateMatch(matchId, (m) => {
    const live = liveState(m);
    const prev = live.last;
    const point = pointFor(action, prev);
    const ev: StatEvent = {
      id: uid(),
      set: m.currentSet,
      playerId,
      action,
      point,
      serving: live.serving,
      us: live.us + (point === 'us' ? 1 : 0),
      them: live.them + (point === 'them' ? 1 : 0),
      at: Date.now(),
    };
    return { ...m, events: [...m.events, ev] };
  });
}

export function deleteEvent(matchId: string, eventId: string) {
  updateMatch(matchId, (m) => rebuild({ ...m, events: m.events.filter((e) => e.id !== eventId) }));
}

/** Undo the last event; if the current set is empty, reopen the previous set. */
export function undo(matchId: string) {
  updateMatch(matchId, (m) => {
    const inSet = m.events.filter((e) => e.set === m.currentSet);
    if (inSet.length) {
      const last = inSet[inSet.length - 1];
      return { ...m, events: m.events.filter((e) => e.id !== last.id) };
    }
    if (m.currentSet > 1) {
      return { ...m, currentSet: m.currentSet - 1, sets: m.sets.slice(0, -1), firstServe: m.firstServe.slice(0, m.currentSet - 1), finished: false };
    }
    return m;
  });
}

export function setFirstServe(matchId: string, side: Side) {
  updateMatch(matchId, (m) => {
    const firstServe = [...m.firstServe];
    firstServe[m.currentSet - 1] = side;
    return rebuild({ ...m, firstServe });
  });
}

export function endSet(matchId: string) {
  updateMatch(matchId, (m) => {
    const live = liveState(m);
    const sets = [...m.sets, { us: live.us, them: live.them }];
    const won = setsWon({ ...m, sets });
    const finished = won.us >= setsToWin(m) || won.them >= setsToWin(m) || sets.length >= m.bestOf;
    if (finished) return { ...m, sets, finished: true };
    // Serve alternates each set.
    const prevFirst = m.firstServe[m.currentSet - 1] ?? 'us';
    return {
      ...m,
      sets,
      currentSet: m.currentSet + 1,
      firstServe: [...m.firstServe, prevFirst === 'us' ? 'them' : 'us'],
    };
  });
}

export function reopenMatch(matchId: string) {
  updateMatch(matchId, (m) => ({ ...m, finished: false, sets: m.sets.slice(0, -1) }));
}

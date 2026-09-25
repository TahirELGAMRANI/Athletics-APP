export type Position = 'OH' | 'MB' | 'OPP' | 'S' | 'L' | 'DS';

export type Player = {
  id: string;
  number: string;
  name: string;
  position: Position;
};

/** Stat codes, following the NCAA volleyball box score. */
export type Action =
  // Serving
  | 'SRV' // serve in play (attempt)
  | 'ACE' // service ace
  | 'SE' // service error
  // Attacking
  | 'ATT' // attack attempt kept in play
  | 'K' // kill
  | 'AE' // attack error
  // Setting
  | 'AST' // assist
  | 'BHE' // ball handling error
  // Blocking
  | 'BS' // block solo
  | 'BA' // block assist
  | 'BE' // block error
  // Serve reception (0-3 pass scale; 0 = reception error / opponent ace)
  | 'R3'
  | 'R2'
  | 'R1'
  | 'R0'
  // Defense
  | 'DIG'
  | 'DE' // dig error
  // Team / opponent (no player)
  | 'OPP_ERR' // opponent error: point to us
  | 'OPP_PT' // opponent point we did not attribute to one of our errors
  | 'TEAM_ERR'; // our fault (net, rotation, foot fault...)

export type Side = 'us' | 'them';

export type StatEvent = {
  id: string;
  set: number; // 1-based
  playerId: string | null;
  action: Action;
  /** Who scored on this event, if it ended the rally. */
  point: Side | null;
  /** Serving team when the rally was played. */
  serving: Side;
  us: number; // score after the event
  them: number;
  at: number; // timestamp
};

export type SetResult = { us: number; them: number };

export type Match = {
  id: string;
  createdAt: number;
  date: string; // YYYY-MM-DD
  teamName: string;
  opponent: string;
  location: string;
  bestOf: 3 | 5;
  players: Player[]; // roster snapshot for this match
  events: StatEvent[];
  currentSet: number;
  /** Final scores of completed sets. */
  sets: SetResult[];
  /** Serving team at the start of each set (index = set - 1). */
  firstServe: Side[];
  finished: boolean;
};

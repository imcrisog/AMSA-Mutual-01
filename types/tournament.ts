export type Player = {
  name: string;
  number: string;
};

export type Team = {
  name: string;
  /** data URL (base64) */
  photo: string | null;
  players: Player[];
};

export type TournamentFormat = "liga" | "copa" | "liga_grupos_playoffs";

export type TournamentStage = "league" | "groups" | "playoffs" | "finished";

export type Match = {
  id: string;
  home: string;
  away: string;
  /** 1-based */
  round: number;
  /** For playoffs: dynamically resolve home team as winner of another match */
  homeFromMatchId?: string;
  /** For playoffs: dynamically resolve away team as winner of another match */
  awayFromMatchId?: string;
  /** null/undefined => not played yet */
  homeScore?: number | null;
  /** null/undefined => not played yet */
  awayScore?: number | null;

  /**
   * Vóley: puntos por set (best-of-5).
   *
   * - `homeScore/awayScore` se usan como **sets ganados** cuando el partido está finalizado.
   * - Si `sets` está presente, el marcador de sets se deriva automáticamente desde acá.
   */
  sets?: VoleySetScore[];

  /** Optional match events (goals/cards/subs) for richer match detail. */
  events?: MatchEvent[];
};

export type VoleySetScore = {
  /** Puntos del local en ese set. `null` => set no cargado. */
  home: number | null;
  /** Puntos del visitante en ese set. `null` => set no cargado. */
  away: number | null;
};

export type MatchEventTeamSide = "home" | "away";

export type MatchEventBase = {
  id: string;
  /** 0-120 (extra time allowed). */
  minute: number;
  teamSide: MatchEventTeamSide;
};

export type GoalEvent = MatchEventBase & {
  type: "goal";
  playerId: string;
  playerName: string;
};

export type CardEvent = MatchEventBase & {
  type: "yellow" | "red" | "blue";
  playerId: string;
  playerName: string;
};

export type SubstitutionEvent = MatchEventBase & {
  type: "sub";
  playerOutId: string;
  playerOutName: string;
  playerInId: string;
  playerInName: string;
};

export type MatchEvent = GoalEvent | CardEvent | SubstitutionEvent;

export type CupRound = {
  round: number;
  name: string;
  matches: Match[];
};

export type GroupKey = "A" | "B";

export type GroupPhase = {
  key: GroupKey;
  teams: string[];
  matches: Match[];
};

export type StandingsRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

export type VoleyStandingsRow = {
  team: string;
  played: number;
  won: number;
  lost: number;
  /** sets a favor */
  setsFor: number;
  /** sets en contra */
  setsAgainst: number;
  setsDiff: number;
  /** puntos a favor (suma de todos los sets) */
  pointsFor: number;
  /** puntos en contra (suma de todos los sets) */
  pointsAgainst: number;
  pointsDiff: number;
  /** puntos de partido (3/2/1/0) */
  pts: number;
};

export type TournamentDraft = {
  sport: "futbol" | "voley";
  teams: Team[];
  format?: TournamentFormat;

  /**
   * Verifiable randomness proof for the draw.
   * The UI can display this so users can verify the draw wasn't manipulated.
   */
  randomnessProof?: {
    source: "nist-beacon" | "local";
    fetchedAt: string;
    nistPulse?: {
      uri?: string;
      timeStamp?: string;
      pulseIndex?: number;
      outputValue?: string;
      signatureValue?: string;
      localRandomValue?: string;
    };
  };

  /** Bonus points for attendance confirmation (+5). Keyed by team name. */
  attendanceConfirmed?: Record<string, boolean>;

  /** running stage for multi-phase formats */
  stage?: TournamentStage;

  /** Liga simple OR fase 1 del formato liga->grupos->playoffs */
  leagueMatches?: Match[];

  /** Copa (eliminación directa) */
  cupRounds?: CupRound[];

  /** Formato: liga -> grupos (A/B) */
  groups?: Record<GroupKey, GroupPhase>;

  /** Formato: fase final por cruces (QF/SF/F) */
  playoffsRounds?: CupRound[];
};

export type TournamentSport = "futbol" | "voley";

export type TournamentMeta = {
  id: string;
  name: string;
  sport: TournamentSport;
  createdAt: string;
  updatedAt: string;
};

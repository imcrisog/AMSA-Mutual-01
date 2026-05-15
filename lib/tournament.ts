import type {
  CupRound,
  GroupPhase,
  GroupKey,
  Match,
  StandingsRow,
  Team,
  VoleySetScore,
  VoleyStandingsRow,
} from "@/types/tournament";

function makeId(prefix: string) {
  // good enough for UI keys
  return `${prefix}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Round-robin (single round) fixture.
 * Uses the circle method. If teams are odd, adds a BYE.
 */
export function generateLeagueMatches(teams: Team[]): Match[] {
  const names = teams.map((t) => t.name);
  const list = [...names];

  const BYE = "BYE";
  if (list.length % 2 === 1) list.push(BYE);

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;

  // We'll rotate all but the first element.
  const fixed = list[0];
  let rot = list.slice(1);

  const matches: Match[] = [];

  for (let round = 1; round <= rounds; round++) {
    const left = [fixed, ...rot.slice(0, half - 1)];
    const right = rot.slice(half - 1).reverse();

    for (let i = 0; i < half; i++) {
      const home = left[i];
      const away = right[i];
      if (home === BYE || away === BYE) continue;

      matches.push({
        id: makeId(`liga_r${round}_${i}`),
        home,
        away,
        round,
      });
    }

    // rotate: take last and put first
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }

  return matches;
}

/** Same fixture as league, but initializing Vóley match sets (best-of-5). */
export function generateVoleyLeagueMatches(teams: Team[], rules: VoleyRules = DEFAULT_VOLEY_RULES): Match[] {
  return generateLeagueMatches(teams).map((m) => ({
    ...m,
    sets: makeEmptyVoleySets(rules.maxSets),
    homeScore: null,
    awayScore: null,
  }));
}

export function computeStandings(teams: string[], matches: Match[]): StandingsRow[] {
  const table = new Map<string, StandingsRow>();

  for (const team of teams) {
    table.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    });
  }

  for (const m of matches) {
    if (m.homeScore == null || m.awayScore == null) continue;
    if (!table.has(m.home) || !table.has(m.away)) continue;

    const home = table.get(m.home)!;
    const away = table.get(m.away)!;

    home.played++;
    away.played++;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++;
      away.lost++;
      home.pts += 3;
    } else if (m.homeScore < m.awayScore) {
      away.won++;
      home.lost++;
      away.pts += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.pts += 1;
      away.pts += 1;
    }
  }

  const rows = Array.from(table.values()).map((r) => ({ ...r, gd: r.gf - r.ga }));
  rows.sort((a, b) => {
    // points, goal diff, goals for, name
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
  return rows;
}

/** ----------------------------- VÓLEY ----------------------------- */

export type VoleyRules = {
  /** Puntos objetivo para sets 1-4 (normalmente 25). */
  pointsToWinSet: number;
  /** Puntos objetivo para el 5to set (normalmente 15). */
  pointsToWinTiebreak: number;
  /** Diferencia mínima para ganar un set (siempre 2). */
  winBy: number;
  /** Cantidad máxima de sets (best-of-5 => 5). */
  maxSets: number;
  /** Sets necesarios para ganar el partido (best-of-5 => 3). */
  setsToWin: number;
};

export const DEFAULT_VOLEY_RULES: VoleyRules = {
  pointsToWinSet: 25,
  pointsToWinTiebreak: 15,
  winBy: 2,
  maxSets: 5,
  setsToWin: 3,
};

export function makeEmptyVoleySets(maxSets = DEFAULT_VOLEY_RULES.maxSets): VoleySetScore[] {
  return Array.from({ length: maxSets }, () => ({ home: null, away: null }));
}

function setTargetPoints(setIndex0: number, rules: VoleyRules) {
  // 5to set (índice 4) a 15.
  return setIndex0 === 4 ? rules.pointsToWinTiebreak : rules.pointsToWinSet;
}

export function isSetComplete(set: VoleySetScore, setIndex0: number, rules: VoleyRules = DEFAULT_VOLEY_RULES): boolean {
  if (set.home == null || set.away == null) return false;
  const h = set.home;
  const a = set.away;
  if (h < 0 || a < 0) return false;
  const target = setTargetPoints(setIndex0, rules);

  // must reach target and win by 2
  if (h >= target || a >= target) {
    return Math.abs(h - a) >= rules.winBy;
  }
  return false;
}

export function computeVoleyMatchSummary(match: Match, rules: VoleyRules = DEFAULT_VOLEY_RULES): {
  homeSetsWon: number;
  awaySetsWon: number;
  homePoints: number;
  awayPoints: number;
  winner: "home" | "away" | null;
  /** true si se llegó a setsToWin en alguno de los lados */
  finished: boolean;
  /** mensajes de validación soft (para mostrar en UI) */
  warnings: string[];
} {
  const sets = match.sets ?? [];
  let hs = 0;
  let as = 0;
  let hp = 0;
  let ap = 0;
  const warnings: string[] = [];

  for (let i = 0; i < Math.min(sets.length, rules.maxSets); i++) {
    const s = sets[i]!;
    if (s.home != null) hp += s.home;
    if (s.away != null) ap += s.away;

    if (s.home == null && s.away == null) continue;
    if (!isSetComplete(s, i, rules)) {
      warnings.push(`Set ${i + 1}: incompleto o inválido (debe ganarse por ${rules.winBy} y llegar a ${setTargetPoints(i, rules)})`);
      continue;
    }
    if ((s.home ?? 0) > (s.away ?? 0)) hs++;
    else as++;

    if (hs === rules.setsToWin || as === rules.setsToWin) {
      // match finished; ignore any remaining sets but warn if filled
      for (let j = i + 1; j < sets.length; j++) {
        const extra = sets[j];
        if (!extra) continue;
        if (extra.home != null || extra.away != null) {
          warnings.push(`Sets extra cargados luego de finalizar el partido (desde set ${j + 1}).`);
          break;
        }
      }
      break;
    }
  }

  const winner = hs > as ? "home" : as > hs ? "away" : null;
  const finished = hs === rules.setsToWin || as === rules.setsToWin;
  return { homeSetsWon: hs, awaySetsWon: as, homePoints: hp, awayPoints: ap, winner, finished, warnings };
}

export function patchMatchWithDerivedVoleyScore(match: Match, rules: VoleyRules = DEFAULT_VOLEY_RULES): Match {
  if (!match.sets) return match;
  const sum = computeVoleyMatchSummary(match, rules);
  // store sets won in homeScore/awayScore for consistency across the app
  return {
    ...match,
    // If sets are being used, the derived score is the source of truth.
    // When the match is not finished, keep scores null to avoid stale standings.
    homeScore: sum.finished ? sum.homeSetsWon : null,
    awayScore: sum.finished ? sum.awaySetsWon : null,
  };
}

/**
 * Tabla de vóley (estilo FIVB simplificado):
 * - 3 pts: 3-0 o 3-1
 * - 2 pts: 3-2
 * - 1 pt: 2-3
 * - 0 pts: 0-3 o 1-3
 */
export function computeVoleyStandings(teams: string[], matches: Match[], rules: VoleyRules = DEFAULT_VOLEY_RULES): VoleyStandingsRow[] {
  const table = new Map<string, VoleyStandingsRow>();
  for (const team of teams) {
    table.set(team, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      setsDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      pts: 0,
    });
  }

  for (const m0 of matches) {
    if (!table.has(m0.home) || !table.has(m0.away)) continue;

    // Only count matches that have a finished voley result.
    const m = patchMatchWithDerivedVoleyScore(m0, rules);
    if (m.homeScore == null || m.awayScore == null) continue;

    const home = table.get(m.home)!;
    const away = table.get(m.away)!;

    // must be a valid voley finish (3 sets to win)
    const hs = m.homeScore;
    const as = m.awayScore;
    if (hs !== rules.setsToWin && as !== rules.setsToWin) continue;
    if (hs === as) continue;

    const sum = computeVoleyMatchSummary(m, rules);

    home.played++;
    away.played++;

    home.setsFor += sum.homeSetsWon;
    home.setsAgainst += sum.awaySetsWon;
    away.setsFor += sum.awaySetsWon;
    away.setsAgainst += sum.homeSetsWon;

    home.pointsFor += sum.homePoints;
    home.pointsAgainst += sum.awayPoints;
    away.pointsFor += sum.awayPoints;
    away.pointsAgainst += sum.homePoints;

    if (hs > as) {
      home.won++;
      away.lost++;
    } else {
      away.won++;
      home.lost++;
    }

    const max = Math.max(hs, as);
    const min = Math.min(hs, as);
    if (max === 3 && min <= 1) {
      // 3-0 or 3-1
      if (hs > as) home.pts += 3;
      else away.pts += 3;
    } else if (max === 3 && min === 2) {
      // 3-2
      if (hs > as) {
        home.pts += 2;
        away.pts += 1;
      } else {
        away.pts += 2;
        home.pts += 1;
      }
    }
  }

  const rows = Array.from(table.values()).map((r) => ({
    ...r,
    setsDiff: r.setsFor - r.setsAgainst,
    pointsDiff: r.pointsFor - r.pointsAgainst,
  }));

  rows.sort((a, b) => {
    // points, setsDiff, pointsDiff, pointsFor, name
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.setsDiff !== a.setsDiff) return b.setsDiff - a.setsDiff;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.team.localeCompare(b.team);
  });
  return rows;
}

export function applyAttendanceBonus(rows: StandingsRow[], attendanceConfirmed?: Record<string, boolean>) {
  if (!attendanceConfirmed) return rows;
  const next = rows.map((r) => ({
    ...r,
    pts: r.pts + (attendanceConfirmed[r.team] ? 5 : 0),
  }));

  // Re-sort because bonus can change positions.
  next.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });

  return next;
}

export function allMatchesPlayed(matches: Match[]) {
  return matches.every((m) => m.homeScore != null && m.awayScore != null);
}

export function allVoleyMatchesPlayed(matches: Match[], rules: VoleyRules = DEFAULT_VOLEY_RULES) {
  return matches.every((m) => {
    if (!m.sets) return false;
    const p = patchMatchWithDerivedVoleyScore(m, rules);
    return p.homeScore != null && p.awayScore != null;
  });
}

/**
 * Splits league standings into Group A (top 8) and Group B (rest).
 * If there are fewer than 8 teams, Group A will contain all teams and Group B empty.
 */
export function splitIntoGroupsFromStandings(standings: Array<{ team: string }>): Record<GroupKey, string[]> {
  const ordered = standings.map((s) => s.team);
  const groupA = ordered.slice(0, 8);
  const groupB = ordered.slice(8);
  return { A: groupA, B: groupB };
}

export function generateGroupPhase(groups: Record<GroupKey, string[]>) {
  const result: Record<GroupKey, GroupPhase> = {
    A: {
      key: "A",
      teams: groups.A,
      matches: generateLeagueMatches(groups.A.map((name) => ({ name, photo: null, players: [] }))),
    },
    B: {
      key: "B",
      teams: groups.B,
      matches: generateLeagueMatches(groups.B.map((name) => ({ name, photo: null, players: [] }))),
    },
  };
  return result;
}

export function generateVoleyGroupPhase(groups: Record<GroupKey, string[]>, rules: VoleyRules = DEFAULT_VOLEY_RULES) {
  const result: Record<GroupKey, GroupPhase> = {
    A: {
      key: "A",
      teams: groups.A,
      matches: generateVoleyLeagueMatches(groups.A.map((name) => ({ name, photo: null, players: [] })), rules),
    },
    B: {
      key: "B",
      teams: groups.B,
      matches: generateVoleyLeagueMatches(groups.B.map((name) => ({ name, photo: null, players: [] })), rules),
    },
  };
  return result;
}

function winnerOf(match: Match): string | null {
  if (match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore > match.awayScore) return match.home;
  if (match.awayScore > match.homeScore) return match.away;
  // No ties in playoffs (for now). Return null to force user to resolve.
  return null;
}

export function resolveMatchTeams(match: Match, allMatchesById: Map<string, Match>): { home: string; away: string } {
  const home = match.homeFromMatchId
    ? winnerOf(allMatchesById.get(match.homeFromMatchId) ?? ({} as Match)) ?? `Ganador ${match.homeFromMatchId}`
    : match.home;
  const away = match.awayFromMatchId
    ? winnerOf(allMatchesById.get(match.awayFromMatchId) ?? ({} as Match)) ?? `Ganador ${match.awayFromMatchId}`
    : match.away;
  return { home, away };
}

export function generatePlayoffsFromGroups(params: {
  groupAStandings: Array<{ team: string }>;
  groupBStandings: Array<{ team: string }>;
}): CupRound[] {
  const topA = params.groupAStandings.slice(0, 4).map((s) => s.team);
  const topB = params.groupBStandings.slice(0, 4).map((s) => s.team);

  // If some group doesn't have enough teams, we still proceed with what we have.
  // We'll fill missing with BYE and later user can handle.
  const BYE = "BYE";
  const A = [...topA, ...Array.from({ length: Math.max(0, 4 - topA.length) }, () => BYE)];
  const B = [...topB, ...Array.from({ length: Math.max(0, 4 - topB.length) }, () => BYE)];

  // Quarterfinals pairings: A1 vs B4, A2 vs B3, B1 vs A4, B2 vs A3
  const qf: Match[] = [
    { id: makeId("po_qf_1"), home: A[0], away: B[3], round: 1 },
    { id: makeId("po_qf_2"), home: A[1], away: B[2], round: 1 },
    { id: makeId("po_qf_3"), home: B[0], away: A[3], round: 1 },
    { id: makeId("po_qf_4"), home: B[1], away: A[2], round: 1 },
  ].filter((m) => !(m.home === BYE && m.away === BYE));

  // Semis: winner qf1 vs winner qf2, winner qf3 vs winner qf4
  const sf: Match[] = [
    {
      id: makeId("po_sf_1"),
      home: "",
      away: "",
      round: 2,
      homeFromMatchId: qf[0]?.id,
      awayFromMatchId: qf[1]?.id,
    },
    {
      id: makeId("po_sf_2"),
      home: "",
      away: "",
      round: 2,
      homeFromMatchId: qf[2]?.id,
      awayFromMatchId: qf[3]?.id,
    },
  ].filter((m) => m.homeFromMatchId && m.awayFromMatchId) as Match[];

  const final: Match[] = [
    {
      id: makeId("po_f_1"),
      home: "",
      away: "",
      round: 3,
      homeFromMatchId: sf[0]?.id,
      awayFromMatchId: sf[1]?.id,
    },
  ].filter((m) => m.homeFromMatchId && m.awayFromMatchId) as Match[];

  const rounds: CupRound[] = [];
  rounds.push({ round: 1, name: "Cuartos", matches: qf });
  rounds.push({ round: 2, name: "Semifinal", matches: sf });
  rounds.push({ round: 3, name: "Final", matches: final });
  return rounds;
}

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function roundName(size: number) {
  if (size === 2) return "Final";
  if (size === 4) return "Semifinal";
  if (size === 8) return "Cuartos";
  if (size === 16) return "Octavos";
  return `Ronda de ${size}`;
}

/**
 * Generates an empty cup bracket (pairings) based on team list order.
 * Adds BYEs up to next power of two.
 */
export function generateCupRounds(teams: Team[]): CupRound[] {
  const names = teams.map((t) => t.name);
  const target = nextPowerOfTwo(names.length);
  const BYE = "BYE";
  const slots = [...names, ...Array.from({ length: target - names.length }, () => BYE)];

  const rounds: CupRound[] = [];

  let size = target;
  let currentTeams = slots;
  let round = 1;

  while (size >= 2) {
    const matches: Match[] = [];

    for (let i = 0; i < currentTeams.length; i += 2) {
      const home = currentTeams[i];
      const away = currentTeams[i + 1];
      if (home === BYE && away === BYE) continue;

      matches.push({
        id: makeId(`copa_r${round}_${i / 2}`),
        home,
        away,
        round,
      });
    }

    rounds.push({
      round,
      name: roundName(size),
      matches,
    });

    // Next round placeholders (winners). We don't compute winners here.
    size = size / 2;
    round++;
    currentTeams = Array.from(
      { length: size },
      (_, idx) => `Ganador ${round - 1}.${idx + 1}`
    );
  }

  return rounds;
}

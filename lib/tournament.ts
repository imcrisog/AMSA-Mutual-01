import type { CupRound, GroupPhase, GroupKey, Match, StandingsRow, Team } from "@/types/tournament";

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

/**
 * Splits league standings into Group A (top 8) and Group B (rest).
 * If there are fewer than 8 teams, Group A will contain all teams and Group B empty.
 */
export function splitIntoGroupsFromStandings(standings: StandingsRow[]): Record<GroupKey, string[]> {
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
  groupAStandings: StandingsRow[];
  groupBStandings: StandingsRow[];
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

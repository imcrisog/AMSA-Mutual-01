"use client";

import type {
  CardEvent,
  GoalEvent,
  Match,
  MatchEvent,
  MatchEventTeamSide,
  SubstitutionEvent,
  Team,
} from "@/types/tournament";

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function clampMinute(minute: number) {
  if (!Number.isFinite(minute)) return 0;
  return Math.max(0, Math.min(120, Math.floor(minute)));
}

export function addGoalEvent(params: {
  match: Match;
  minute: number;
  teamSide: MatchEventTeamSide;
  player: { id: string; name: string };
}): Match {
  const ev: GoalEvent = {
    id: newId("goal"),
    type: "goal",
    minute: clampMinute(params.minute),
    teamSide: params.teamSide,
    playerId: params.player.id,
    playerName: params.player.name,
  };
  const events = [...(params.match.events ?? []), ev];
  return {
    ...params.match,
    events,
    homeScore: countGoals(events, "home"),
    awayScore: countGoals(events, "away"),
  };
}

export function addCardEvent(params: {
  match: Match;
  minute: number;
  teamSide: MatchEventTeamSide;
  card: "yellow" | "red" | "blue";
  player: { id: string; name: string };
}): Match {
  const ev: CardEvent = {
    id: newId(params.card),
    type: params.card,
    minute: clampMinute(params.minute),
    teamSide: params.teamSide,
    playerId: params.player.id,
    playerName: params.player.name,
  };
  const events = [...(params.match.events ?? []), ev];
  return { ...params.match, events };
}

export function addSubEvent(params: {
  match: Match;
  minute: number;
  teamSide: MatchEventTeamSide;
  playerOut: { id: string; name: string };
  playerIn: { id: string; name: string };
}): Match {
  const ev: SubstitutionEvent = {
    id: newId("sub"),
    type: "sub",
    minute: clampMinute(params.minute),
    teamSide: params.teamSide,
    playerOutId: params.playerOut.id,
    playerOutName: params.playerOut.name,
    playerInId: params.playerIn.id,
    playerInName: params.playerIn.name,
  };
  const events = [...(params.match.events ?? []), ev];
  return { ...params.match, events };
}

export function removeEvent(match: Match, eventId: string): Match {
  const events = (match.events ?? []).filter((e) => e.id !== eventId);
  return {
    ...match,
    events,
    homeScore: countGoals(events, "home"),
    awayScore: countGoals(events, "away"),
  };
}

export function sortEvents(events: MatchEvent[]) {
  return [...events].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.id.localeCompare(b.id);
  });
}

export function countGoals(events: MatchEvent[], side: MatchEventTeamSide) {
  return events.filter((e) => e.type === "goal" && e.teamSide === side).length;
}

export function teamPlayersByName(teams: Team[], teamName: string): { id: string; name: string }[] {
  const team = teams.find((t) => t.name === teamName);
  if (!team) return [];
  // Stable ids derived from name+index (enough for draft scope)
  return team.players.map((p, idx) => ({ id: `${team.name}:${idx}`, name: p.name }));
}

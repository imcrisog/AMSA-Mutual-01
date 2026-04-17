"use client";

/**
 * With MongoDB + auth, persistence is handled server-side via `/api/*`.
 * We keep only the currently selected tournament id client-side.
 */

const ACTIVE_TOURNAMENT_KEY = "activeTournamentId";

export function getActiveTournamentId(): string | null {
  return localStorage.getItem(ACTIVE_TOURNAMENT_KEY);
}

export function setActiveTournamentId(id: string) {
  localStorage.setItem(ACTIVE_TOURNAMENT_KEY, id);
}

export function clearActiveTournamentId() {
  localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
}

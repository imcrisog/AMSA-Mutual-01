"use client";

import type { Team, TournamentDraft, TournamentMeta, TournamentSport } from "@/types/tournament";
import { apiFetch } from "@/lib/apiClient";

export async function apiListTournaments(): Promise<TournamentMeta[]> {
  const res = await apiFetch<{ items: TournamentMeta[] }>("/api/tournaments");
  return res.items;
}

export async function apiCreateTournament(params: { name: string; sport: TournamentSport }): Promise<TournamentMeta> {
  const res = await apiFetch<{ item: TournamentMeta }>("/api/tournaments", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.item;
}

export async function apiDeleteTournament(id: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/tournaments/${id}` as const, { method: "DELETE" });
}

export async function apiGetTournament(id: string): Promise<{ item: TournamentMeta; teams: Team[]; draft: TournamentDraft | null }> {
  return apiFetch<{ item: TournamentMeta; teams: Team[]; draft: TournamentDraft | null }>(`/api/tournaments/${id}` as const);
}

export async function apiGetTeams(id: string): Promise<Team[]> {
  const res = await apiFetch<{ teams: Team[] }>(`/api/tournaments/${id}/teams` as const);
  return res.teams;
}

export async function apiSetTeams(id: string, teams: Team[]): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/tournaments/${id}/teams` as const, {
    method: "PUT",
    body: JSON.stringify({ teams }),
  });
}

export async function apiGetDraft(id: string): Promise<TournamentDraft | null> {
  const res = await apiFetch<{ draft: TournamentDraft | null }>(`/api/tournaments/${id}/draft` as const);
  return res.draft;
}

export async function apiSetDraft(id: string, draft: TournamentDraft | null): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/tournaments/${id}/draft` as const, {
    method: "PUT",
    body: JSON.stringify({ draft }),
  });
}

export type NistPulseResponse = {
  source: "nist-beacon";
  fetchedAt: string;
  nistPulse: null | {
    uri?: string;
    timeStamp?: string;
    pulseIndex?: number;
    outputValue?: string;
    signatureValue?: string;
  };
};

export async function apiGetNistPulse(): Promise<NistPulseResponse> {
  return apiFetch<NistPulseResponse>("/api/randomness/nist");
}

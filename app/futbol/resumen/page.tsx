"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { CupRound, GroupKey, Match, StandingsRow, Team, TournamentDraft } from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetTeams, apiGetDraft, apiSetDraft } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";
import FutbolShell from "../_components/FutbolShell";
import FutbolCard from "../_components/FutbolCard";
import MatchEventsEditor from "../_components/MatchEventsEditor";
import {
  allMatchesPlayed,
  applyAttendanceBonus,
  computeStandings,
  generateGroupPhase,
  generatePlayoffsFromGroups,
  resolveMatchTeams,
  splitIntoGroupsFromStandings,
} from "@/lib/tournament";

export default function FutbolResumenPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<TournamentDraft | null>(null);
  const { loading } = useRequireAuth();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [standingsModalOpen, setStandingsModalOpen] = useState(false);

  useEffect(() => {
    // ensure stable tournamentId across renders
    Promise.resolve().then(() => setTournamentId(getActiveTournamentId()));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!tournamentId) {
      router.replace("/tournaments");
      return;
    }

    let cancelled = false;

    Promise.all([apiGetDraft(tournamentId), apiGetTeams(tournamentId)])
      .then(([d, teams]) => {
        if (cancelled) return;
        Promise.resolve().then(() => {
          if (cancelled) return;
          if (d) setDraft({ ...d, teams });
          else setDraft(null);
        });
      })
      .catch((err) => {
        console.error("Failed to load draft", err);
        alert("No se pudo cargar el torneo.");
      });

    return () => {
      cancelled = true;
    };
  }, [loading, router, tournamentId]);

  useEffect(() => {
    if (!standingsModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setStandingsModalOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [standingsModalOpen]);

  function persist(next: TournamentDraft) {
    if (tournamentId) apiSetDraft(tournamentId, next).catch(() => {});
    setDraft(next);
  }

  function parseScore(raw: string): number | null {
    const v = raw.trim();
    if (v === "") return null;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return null;
    if (n < 0) return 0;
    return n;
  }

  function updateMatchScoreInMatches(matches: Match[], matchId: string, patch: Partial<Match>): Match[] {
    return matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m));
  }

  function replaceMatchInMatches(matches: Match[], matchId: string, next: Match): Match[] {
    return matches.map((m) => (m.id === matchId ? next : m));
  }

  function updateScoreInRounds(rounds: CupRound[], matchId: string, patch: Partial<Match>): CupRound[] {
    return rounds.map((r) => ({
      ...r,
      matches: updateMatchScoreInMatches(r.matches, matchId, patch),
    }));
  }

  function matchWinner(m: Match): string | null {
    if (m.homeScore == null || m.awayScore == null) return null;
    if (m.homeScore > m.awayScore) return m.home;
    if (m.awayScore > m.homeScore) return m.away;
    return null; // tie
  }

  function standingsForLeague(): StandingsRow[] {
    if (!draft?.leagueMatches) return [];
    const teamNames = draft.teams.map((t) => t.name);
    return applyAttendanceBonus(computeStandings(teamNames, draft.leagueMatches), draft.attendanceConfirmed);
  }

  function standingsForGroup(key: GroupKey): StandingsRow[] {
    if (!draft?.groups?.[key]) return [];
    const group = draft.groups[key];
    return applyAttendanceBonus(computeStandings(group.teams, group.matches), draft.attendanceConfirmed);
  }

  if (!draft) {
    return (
      <FutbolShell
        step="resumen"
        title="Resumen"
        subtitle="No hay un torneo en borrador. Volvé a crear equipos."
      >
        <FutbolCard title="Sin borrador" subtitle="No encontramos un torneo guardado en este navegador.">
          <button
            className="mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold tracking-wide text-black shadow-sm"
            onClick={() => router.push("/futbol")}
          >
            ← Ir a fútbol
          </button>
        </FutbolCard>
      </FutbolShell>
    );
  }

  const leagueStandings = draft.format !== "copa" ? standingsForLeague() : [];
  const groupsExist = !!draft.groups?.A || !!draft.groups?.B;
  const canGenerateGroups =
    draft.format === "liga_grupos_playoffs" &&
    !!draft.leagueMatches &&
    allMatchesPlayed(draft.leagueMatches) &&
    !groupsExist;

  const canGeneratePlayoffs =
    draft.format === "liga_grupos_playoffs" &&
    !!draft.groups?.A &&
    !!draft.groups?.B &&
    allMatchesPlayed(draft.groups.A.matches) &&
    allMatchesPlayed(draft.groups.B.matches) &&
    !draft.playoffsRounds;

  const playoffsAllMatches: Match[] = draft.playoffsRounds
    ? draft.playoffsRounds.flatMap((r) => r.matches)
    : [];
  const playoffsById = new Map(playoffsAllMatches.map((m) => [m.id, m] as const));
  const finalMatch = draft.playoffsRounds?.find((r) => r.name === "Final")?.matches?.[0];
  const champion = finalMatch ? matchWinner(finalMatch) : null;

  return (
    <FutbolShell
      step="resumen"
      title="Resumen del torneo"
      subtitle={`Deporte: Fútbol — Formato: ${draft.format ?? "-"}`}
    >
      {draft.format === "liga_grupos_playoffs" && champion && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          <div className="font-extrabold tracking-tight">🏆 Campeón: {champion}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <FutbolCard
          title="Equipos"
          subtitle="Planteles y escudos/fotos (si cargaste)."
          right={
            <div className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              Paso 4/4
            </div>
          }
        >
          <div className="space-y-4">
            {draft.teams.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  {t.photo ? (
                    <Image
                      src={t.photo}
                      alt={`Foto de ${t.name}`}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-200 text-sm dark:bg-white/10">
                      sin foto
                    </div>
                  )}

                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-sm text-zinc-600 dark:text-white/70">
                      Jugadores: {t.players.length}
                    </div>
                  </div>

                  {(draft.format === "liga" || draft.format === "liga_grupos_playoffs") && (
                    <div className="ml-auto flex flex-col items-end gap-2">
                      <div
                        className={
                          "rounded-full px-3 py-1 text-[11px] font-semibold " +
                          (draft.attendanceConfirmed?.[t.name]
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200"
                            : "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-white/70")
                        }
                      >
                        {draft.attendanceConfirmed?.[t.name] ? "+5 asistencia" : "sin bonus"}
                      </div>

                      <button
                        type="button"
                        className={
                          "rounded-lg px-3 py-2 text-xs font-semibold shadow-sm " +
                          (draft.attendanceConfirmed?.[t.name]
                            ? "bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:text-white/70"
                            : "bg-black text-white dark:bg-white dark:text-black")
                        }
                        onClick={() => {
                          const next = {
                            ...(draft.attendanceConfirmed ?? {}),
                            [t.name]: !draft.attendanceConfirmed?.[t.name],
                          };
                          persist({ ...draft, attendanceConfirmed: next });
                        }}
                      >
                        {draft.attendanceConfirmed?.[t.name]
                          ? "Quitar asistencia"
                          : "Confirmar asistencia (+5)"}
                      </button>
                    </div>
                  )}
                </div>

                <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-white/70">
                  {t.players.map((p, idx) => (
                    <li key={`${t.name}_${idx}`}>
                      👕 {p.number || "-"} — {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FutbolCard>

        <FutbolCard
          title="Estructura"
          subtitle="Fixture + resultados + tablas."
          right={
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Matchday
            </div>
          }
        >

          {/* Quick access: full standings in a modal */}
          {draft.format !== "copa" && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500 dark:text-white/60">
                Ver tabla completa (Liga / Grupos).
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => setStandingsModalOpen(true)}
              >
                Tabla completa
              </button>
            </div>
          )}

          {/* ---------------- LIGA SIMPLE ---------------- */}
          {draft.format === "liga" && draft.leagueMatches && (
            <div className="mt-4 space-y-8">
              <div>
                <div className="font-semibold">Partidos (cargá resultados)</div>
                <div className="mt-4 space-y-6">
                  {Array.from(new Set((draft.leagueMatches ?? []).map((m) => m.round))).map((round) => (
                    <div key={round}>
                      <div className="font-semibold">Fecha {round}</div>
                      <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                        {(draft.leagueMatches ?? [])
                          .filter((m) => m.round === round)
                          .map((m) => (
                            <li
                              key={m.id}
                              className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                            >
                              {(() => {
                                const hasGoalEvents = (m.events ?? []).some((e) => e.type === "goal");
                                return (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="min-w-[220px] font-medium">
                                        {m.home} vs {m.away}
                                      </span>
                                      <input
                                        className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                        inputMode="numeric"
                                        disabled={hasGoalEvents}
                                        value={m.homeScore ?? ""}
                                        onChange={(e) => {
                                          const next = parseScore(e.target.value);
                                          persist({
                                            ...draft,
                                            leagueMatches: updateMatchScoreInMatches(draft.leagueMatches ?? [], m.id, {
                                              homeScore: next,
                                            }),
                                          });
                                        }}
                                      />
                                      <span>-</span>
                                      <input
                                        className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                        inputMode="numeric"
                                        disabled={hasGoalEvents}
                                        value={m.awayScore ?? ""}
                                        onChange={(e) => {
                                          const next = parseScore(e.target.value);
                                          persist({
                                            ...draft,
                                            leagueMatches: updateMatchScoreInMatches(draft.leagueMatches ?? [], m.id, {
                                              awayScore: next,
                                            }),
                                          });
                                        }}
                                      />
                                      {hasGoalEvents && (
                                        <span className="text-xs text-zinc-500 dark:text-white/60">
                                          (Marcador desde goles)
                                        </span>
                                      )}
                                    </div>

                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-white/70">
                                        Eventos (goles, tarjetas, cambios)
                                      </summary>
                                      <MatchEventsEditor
                                        match={m}
                                        teams={draft.teams}
                                        onChange={(nextMatch) => {
                                          persist({
                                            ...draft,
                                            leagueMatches: replaceMatchInMatches(draft.leagueMatches ?? [], m.id, nextMatch),
                                          });
                                        }}
                                      />
                                    </details>
                                  </>
                                );
                              })()}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold">Tabla</div>
                <StandingsTable rows={leagueStandings} />
              </div>
            </div>
          )}


          {/* ---------------- COPA ---------------- */}
          {draft.format === "copa" && draft.cupRounds && (
            <div className="mt-4 space-y-6">
              {draft.cupRounds.map((r) => (
                <div key={r.round}>
                  <div className="font-semibold">{r.name}</div>
                  <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {r.matches.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                      >
                        {(() => {
                          const hasGoalEvents = (m.events ?? []).some((e) => e.type === "goal");
                          return (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="min-w-[220px] font-medium">
                                  {m.home} vs {m.away}
                                </span>
                                <input
                                  className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                  inputMode="numeric"
                                  disabled={hasGoalEvents}
                                  value={m.homeScore ?? ""}
                                  onChange={(e) => {
                                    const next = parseScore(e.target.value);
                                    persist({
                                      ...draft,
                                      cupRounds: updateScoreInRounds(draft.cupRounds ?? [], m.id, { homeScore: next }),
                                    });
                                  }}
                                />
                                <span>-</span>
                                <input
                                  className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                  inputMode="numeric"
                                  disabled={hasGoalEvents}
                                  value={m.awayScore ?? ""}
                                  onChange={(e) => {
                                    const next = parseScore(e.target.value);
                                    persist({
                                      ...draft,
                                      cupRounds: updateScoreInRounds(draft.cupRounds ?? [], m.id, { awayScore: next }),
                                    });
                                  }}
                                />
                                {hasGoalEvents && (
                                  <span className="text-xs text-zinc-500 dark:text-white/60">(Marcador desde goles)</span>
                                )}
                              </div>

                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-white/70">
                                  Eventos (goles, tarjetas, cambios)
                                </summary>
                                <MatchEventsEditor
                                  match={m}
                                  teams={draft.teams}
                                  onChange={(nextMatch) => {
                                    const nextRounds = (draft.cupRounds ?? []).map((round) =>
                                      round.round !== r.round
                                        ? round
                                        : { ...round, matches: replaceMatchInMatches(round.matches, m.id, nextMatch) }
                                    );
                                    persist({ ...draft, cupRounds: nextRounds });
                                  }}
                                />
                              </details>
                            </>
                          );
                        })()}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* ---------------- LIGA -> GRUPOS -> PLAYOFFS ---------------- */}
          {draft.format === "liga_grupos_playoffs" && draft.leagueMatches && (
            <div className="mt-4 space-y-8">
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">Fase 1 — Liga</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Cuando estén todos los resultados, se arman grupos A (top 8) y B (resto).
                    </div>
                  </div>

                  <button
                    className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
                    disabled={!canGenerateGroups}
                    onClick={() => {
                      if (!draft.leagueMatches) return;
                      const standings = computeStandings(
                        draft.teams.map((t) => t.name),
                        draft.leagueMatches
                      );
                      const split = splitIntoGroupsFromStandings(standings);
                      const groups = generateGroupPhase(split);
                      persist({ ...draft, stage: "groups", groups });
                    }}
                  >
                    Generar grupos
                  </button>
                </div>

                <div className="mt-4 space-y-6">
                  {Array.from(new Set((draft.leagueMatches ?? []).map((m) => m.round))).map((round) => (
                    <div key={round}>
                      <div className="font-semibold">Fecha {round}</div>
                      <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                        {(draft.leagueMatches ?? [])
                          .filter((m) => m.round === round)
                          .map((m) => (
                            <li
                              key={m.id}
                              className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                            >
                              {(() => {
                                const hasGoalEvents = (m.events ?? []).some((e) => e.type === "goal");
                                return (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="min-w-[220px] font-medium">
                                        {m.home} vs {m.away}
                                      </span>
                                      <input
                                        className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                        inputMode="numeric"
                                        disabled={hasGoalEvents}
                                        value={m.homeScore ?? ""}
                                        onChange={(e) => {
                                          const next = parseScore(e.target.value);
                                          persist({
                                            ...draft,
                                            leagueMatches: updateMatchScoreInMatches(draft.leagueMatches ?? [], m.id, {
                                              homeScore: next,
                                            }),
                                          });
                                        }}
                                      />
                                      <span>-</span>
                                      <input
                                        className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                        inputMode="numeric"
                                        disabled={hasGoalEvents}
                                        value={m.awayScore ?? ""}
                                        onChange={(e) => {
                                          const next = parseScore(e.target.value);
                                          persist({
                                            ...draft,
                                            leagueMatches: updateMatchScoreInMatches(draft.leagueMatches ?? [], m.id, {
                                              awayScore: next,
                                            }),
                                          });
                                        }}
                                      />
                                      {hasGoalEvents && (
                                        <span className="text-xs text-zinc-500 dark:text-white/60">
                                          (Marcador desde goles)
                                        </span>
                                      )}
                                    </div>

                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-white/70">
                                        Eventos (goles, tarjetas, cambios)
                                      </summary>
                                      <MatchEventsEditor
                                        match={m}
                                        teams={draft.teams}
                                        onChange={(nextMatch) => {
                                          persist({
                                            ...draft,
                                            leagueMatches: replaceMatchInMatches(draft.leagueMatches ?? [], m.id, nextMatch),
                                          });
                                        }}
                                      />
                                    </details>
                                  </>
                                );
                              })()}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="font-semibold">Tabla general</div>
                  <StandingsTable rows={leagueStandings} />
                </div>
              </section>

              {draft.groups?.A && draft.groups?.B && (
                <section className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">Fase 2 — Grupos</div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Se juega liga dentro de cada grupo. Clasifican los 4 mejores de cada uno.
                      </div>
                    </div>

                    <button
                      className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
                      disabled={!canGeneratePlayoffs}
                      onClick={() => {
                        const sA = standingsForGroup("A");
                        const sB = standingsForGroup("B");
                        const playoffsRounds = generatePlayoffsFromGroups({
                          groupAStandings: sA,
                          groupBStandings: sB,
                        });
                        persist({ ...draft, stage: "playoffs", playoffsRounds });
                      }}
                    >
                      Generar playoffs
                    </button>
                  </div>

                  <GroupBlock
                    title="Grupo A (top 8)"
                    groupKey="A"
                    matches={draft.groups.A.matches}
                    standings={standingsForGroup("A")}
                    teams={draft.teams}
                    onChangeScore={(matchId, patch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          A: {
                            ...draft.groups.A,
                            matches: updateMatchScoreInMatches(draft.groups.A.matches, matchId, patch),
                          },
                        },
                      });
                    }}
                    onChangeMatch={(matchId, nextMatch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          A: {
                            ...draft.groups.A,
                            matches: replaceMatchInMatches(draft.groups.A.matches, matchId, nextMatch),
                          },
                        },
                      });
                    }}
                  />

                  <GroupBlock
                    title="Grupo B (resto)"
                    groupKey="B"
                    matches={draft.groups.B.matches}
                    standings={standingsForGroup("B")}
                    teams={draft.teams}
                    onChangeScore={(matchId, patch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          B: {
                            ...draft.groups.B,
                            matches: updateMatchScoreInMatches(draft.groups.B.matches, matchId, patch),
                          },
                        },
                      });
                    }}
                    onChangeMatch={(matchId, nextMatch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          B: {
                            ...draft.groups.B,
                            matches: replaceMatchInMatches(draft.groups.B.matches, matchId, nextMatch),
                          },
                        },
                      });
                    }}
                  />
                </section>
              )}

              {draft.playoffsRounds && (
                <section className="space-y-4">
                  <div>
                    <div className="font-semibold">Fase 3 — Playoffs</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      En playoffs no se permiten empates (cargá un resultado con ganador).
                    </div>
                  </div>

                  <div className="space-y-6">
                    {draft.playoffsRounds.map((r) => (
                      <div key={r.round}>
                        <div className="font-semibold">{r.name}</div>
                        <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                          {r.matches.map((m) => {
                            const resolved = resolveMatchTeams(m, playoffsById);
                            const playable =
                              resolved.home &&
                              resolved.away &&
                              !resolved.home.startsWith("Ganador") &&
                              !resolved.away.startsWith("Ganador") &&
                              resolved.home !== "BYE" &&
                              resolved.away !== "BYE";

                            const isTie =
                              m.homeScore != null &&
                              m.awayScore != null &&
                              m.homeScore === m.awayScore;

                            return (
                              <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">
                                    {resolved.home} vs {resolved.away}
                                  </span>
                                  {!playable && (
                                    <span className="text-xs text-zinc-500">
                                      (Esperando resultados previos)
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                    inputMode="numeric"
                                    disabled={!playable}
                                    value={m.homeScore ?? ""}
                                    onChange={(e) => {
                                      const next = parseScore(e.target.value);
                                      const nextRounds = updateScoreInRounds(draft.playoffsRounds ?? [], m.id, {
                                        homeScore: next,
                                        home: resolved.home,
                                        away: resolved.away,
                                      });

                                      // if final has a winner, mark finished
                                      const f = nextRounds.find((x) => x.name === "Final")?.matches?.[0];
                                      const done = f && matchWinner(f) ? "finished" : draft.stage;
                                      persist({ ...draft, stage: done, playoffsRounds: nextRounds });
                                    }}
                                  />
                                  <span>-</span>
                                  <input
                                    className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                                    inputMode="numeric"
                                    disabled={!playable}
                                    value={m.awayScore ?? ""}
                                    onChange={(e) => {
                                      const next = parseScore(e.target.value);
                                      const nextRounds = updateScoreInRounds(draft.playoffsRounds ?? [], m.id, {
                                        awayScore: next,
                                        home: resolved.home,
                                        away: resolved.away,
                                      });
                                      const f = nextRounds.find((x) => x.name === "Final")?.matches?.[0];
                                      const done = f && matchWinner(f) ? "finished" : draft.stage;
                                      persist({ ...draft, stage: done, playoffsRounds: nextRounds });
                                    }}
                                  />
                                  {isTie && (
                                    <span className="text-xs text-amber-700 dark:text-amber-300">
                                      Empate: definí un ganador
                                    </span>
                                  )}
                                </div>

                                <details>
                                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-white/70">
                                    Eventos (goles, tarjetas, cambios)
                                  </summary>
                                  <MatchEventsEditor
                                    match={m}
                                    teams={draft.teams}
                                    onChange={(nextMatch) => {
                                      // Rebuild the target match fully.
                                      const rebuilt = (draft.playoffsRounds ?? []).map((r0) => ({
                                        ...r0,
                                        matches: replaceMatchInMatches(r0.matches, m.id, nextMatch),
                                      }));

                                      const f = rebuilt.find((x) => x.name === "Final")?.matches?.[0];
                                      const done = f && matchWinner(f) ? "finished" : draft.stage;
                                      persist({ ...draft, stage: done, playoffsRounds: rebuilt });
                                    }}
                                  />
                                </details>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ---------------- LIGA -> GRUPOS -> PLAYOFFS (starting directly in groups via sorteo) ---------------- */}
          {draft.format === "liga_grupos_playoffs" && !draft.leagueMatches && draft.groups?.A && draft.groups?.B && (
            <div className="mt-4 space-y-8">
              <section className="space-y-6">
                <div>
                  <div className="font-semibold">Fase 2 — Grupos (sorteados)</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Se jugará liga dentro de cada grupo. Clasifican los 4 mejores de cada uno.
                  </div>
                </div>

                <GroupBlock
                  title="Grupo A"
                  groupKey="A"
                  matches={draft.groups.A.matches}
                  standings={standingsForGroup("A")}
                  teams={draft.teams}
                  onChangeScore={(matchId, patch) => {
                    if (!draft.groups) return;
                    persist({
                      ...draft,
                      stage: "groups",
                      groups: {
                        ...draft.groups,
                        A: {
                          ...draft.groups.A,
                          matches: updateMatchScoreInMatches(draft.groups.A.matches, matchId, patch),
                        },
                      },
                    });
                  }}
                  onChangeMatch={(matchId, nextMatch) => {
                    if (!draft.groups) return;
                    persist({
                      ...draft,
                      stage: "groups",
                      groups: {
                        ...draft.groups,
                        A: {
                          ...draft.groups.A,
                          matches: replaceMatchInMatches(draft.groups.A.matches, matchId, nextMatch),
                        },
                      },
                    });
                  }}
                />

                <GroupBlock
                  title="Grupo B"
                  groupKey="B"
                  matches={draft.groups.B.matches}
                  standings={standingsForGroup("B")}
                  teams={draft.teams}
                  onChangeScore={(matchId, patch) => {
                    if (!draft.groups) return;
                    persist({
                      ...draft,
                      stage: "groups",
                      groups: {
                        ...draft.groups,
                        B: {
                          ...draft.groups.B,
                          matches: updateMatchScoreInMatches(draft.groups.B.matches, matchId, patch),
                        },
                      },
                    });
                  }}
                  onChangeMatch={(matchId, nextMatch) => {
                    if (!draft.groups) return;
                    persist({
                      ...draft,
                      stage: "groups",
                      groups: {
                        ...draft.groups,
                        B: {
                          ...draft.groups.B,
                          matches: replaceMatchInMatches(draft.groups.B.matches, matchId, nextMatch),
                        },
                      },
                    });
                  }}
                />
              </section>
            </div>
          )}
        </FutbolCard>
      </div>

      {standingsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tabla completa"
        >
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setStandingsModalOpen(false)}
            aria-label="Cerrar"
          />

          <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold tracking-tight">Tabla completa</div>
                <div className="text-xs text-zinc-500 dark:text-white/60">
                  Orden: Pts → DG → GF.
                </div>
              </div>

              <button
                type="button"
                className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm dark:bg-white dark:text-black"
                onClick={() => setStandingsModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 max-h-[75vh] overflow-auto rounded-xl border border-zinc-200 p-3 dark:border-white/10">
              {draft.format === "copa" ? (
                <div className="text-sm text-zinc-600 dark:text-white/70">En Copa no hay tabla.</div>
              ) : draft.format === "liga" ? (
                <StandingsTable rows={leagueStandings} />
              ) : (
                <div className="space-y-6">
                  {draft.leagueMatches && (
                    <div>
                      <div className="text-sm font-extrabold">Tabla general</div>
                      <StandingsTable rows={leagueStandings} />
                    </div>
                  )}

                  {draft.groups?.A && (
                    <div>
                      <div className="text-sm font-extrabold">Grupo A</div>
                      <StandingsTable rows={standingsForGroup("A")} />
                    </div>
                  )}

                  {draft.groups?.B && (
                    <div>
                      <div className="text-sm font-extrabold">Grupo B</div>
                      <StandingsTable rows={standingsForGroup("B")} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          onClick={() => router.push("/futbol/formato")}
        >
          ← Cambiar formato
        </button>

        <button
          className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:from-white dark:to-white dark:text-black"
          onClick={() => router.push("/")}
        >
          Finalizar (volver al inicio)
        </button>
      </div>
    </FutbolShell>
  );
}

function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  if (rows.length === 0) {
    return <div className="mt-2 text-sm text-zinc-500">Sin datos todavía.</div>;
  }

  return (
    <div className="mt-2 overflow-auto">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50">
        Prioridad: Puntos (luego DG, GF)
      </div>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-600 dark:text-zinc-400">
            <th className="py-2">Pos</th>
            <th className="py-2">Equipo</th>
            <th className="py-2">PJ</th>
            <th className="py-2">PG</th>
            <th className="py-2">PE</th>
            <th className="py-2">PP</th>
            <th className="py-2">GF</th>
            <th className="py-2">GC</th>
            <th className="py-2">DG</th>
            <th className="py-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.team} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2 font-extrabold text-zinc-600 dark:text-white/70">{idx + 1}</td>
              <td className="py-2 font-medium">{r.team}</td>
              <td className="py-2">{r.played}</td>
              <td className="py-2">{r.won}</td>
              <td className="py-2">{r.drawn}</td>
              <td className="py-2">{r.lost}</td>
              <td className="py-2">{r.gf}</td>
              <td className="py-2">{r.ga}</td>
              <td className="py-2">{r.gd}</td>
              <td className="py-2 font-semibold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupBlock(props: {
  title: string;
  groupKey: GroupKey;
  matches: Match[];
  standings: StandingsRow[];
  teams: Team[];
  onChangeScore: (matchId: string, patch: Partial<Match>) => void;
  onChangeMatch: (matchId: string, next: Match) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="font-semibold">{props.title}</div>

      <div className="mt-3 space-y-4">
        {Array.from(new Set(props.matches.map((m) => m.round))).map((round) => (
          <div key={`${props.groupKey}_${round}`}>
            <div className="font-semibold text-sm">Fecha {round}</div>
            <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {props.matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    {(() => {
                      const hasGoalEvents = (m.events ?? []).some((e) => e.type === "goal");
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-[220px] font-medium">
                              {m.home} vs {m.away}
                            </span>
                            <input
                              className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                              inputMode="numeric"
                              disabled={hasGoalEvents}
                              value={m.homeScore ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const n = v === "" ? null : Number.parseInt(v, 10);
                                props.onChangeScore(m.id, { homeScore: Number.isNaN(n) ? null : n });
                              }}
                            />
                            <span>-</span>
                            <input
                              className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                              inputMode="numeric"
                              disabled={hasGoalEvents}
                              value={m.awayScore ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const n = v === "" ? null : Number.parseInt(v, 10);
                                props.onChangeScore(m.id, { awayScore: Number.isNaN(n) ? null : n });
                              }}
                            />
                            {hasGoalEvents && (
                              <span className="text-xs text-zinc-500 dark:text-white/60">(Marcador desde goles)</span>
                            )}
                          </div>

                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-white/70">
                              Eventos (goles, tarjetas, cambios)
                            </summary>
                            <MatchEventsEditor
                              match={m}
                              teams={props.teams}
                              onChange={(nextMatch) => props.onChangeMatch(m.id, nextMatch)}
                            />
                          </details>
                        </>
                      );
                    })()}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="font-semibold text-sm">Tabla</div>
        <StandingsTable rows={props.standings} />
      </div>
    </div>
  );
}

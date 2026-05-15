"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  CupRound,
  GroupKey,
  Match,
  Team,
  TournamentDraft,
  VoleySetScore,
  VoleyStandingsRow,
} from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetDraft, apiGetTeams, apiSetDraft } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";
import VoleyShell from "../_components/VoleyShell";
import VoleyCard from "../_components/VoleyCard";
import {
  allVoleyMatchesPlayed,
  computeVoleyMatchSummary,
  computeVoleyStandings,
  generatePlayoffsFromGroups,
  generateVoleyGroupPhase,
  makeEmptyVoleySets,
  patchMatchWithDerivedVoleyScore,
  resolveMatchTeams,
  splitIntoGroupsFromStandings,
} from "@/lib/tournament";

type DraftState = (TournamentDraft & { __voleySetsMigrated?: boolean }) | null;

export default function VoleyResumenPage() {
  const router = useRouter();
  const { loading } = useRequireAuth();

  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(null);
  const [standingsModalOpen, setStandingsModalOpen] = useState(false);

  useEffect(() => {
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
          // Soft-migration: older drafts might not have `sets` for volleyball matches.
          // We initialize empty sets so the UI works and standings are computed from sets.
          const migrated = d ? migrateDraftToVoleySets({ ...d, teams }) : null;
          setDraft(migrated);
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

  // Persist soft-migrations once per load.
  useEffect(() => {
    if (!draft) return;
    if (!tournamentId) return;
    if (!draft.__voleySetsMigrated) return;
    apiSetDraft(tournamentId, stripInternalFlags(draft)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.__voleySetsMigrated, tournamentId]);

  useEffect(() => {
    if (!standingsModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStandingsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [standingsModalOpen]);

  function persist(next: TournamentDraft & { __voleySetsMigrated?: boolean }) {
    if (tournamentId) apiSetDraft(tournamentId, stripInternalFlags(next)).catch(() => {});
    setDraft(next);
  }

  function parseScore(raw: string): number | null {
    const v = raw.trim();
    if (v === "") return null;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return null;
    return Math.max(0, n);
  }

  function ensureMatchHasSets(m: Match): Match {
    if (m.sets && m.sets.length > 0) return m;
    return { ...m, sets: makeEmptyVoleySets() };
  }

  function updateSetScoreInMatch(m: Match, setIndex0: number, patch: Partial<VoleySetScore>): Match {
    const base = ensureMatchHasSets(m);
    const sets = [...(base.sets ?? makeEmptyVoleySets())];
    while (sets.length < 5) sets.push({ home: null, away: null });
    sets[setIndex0] = { ...sets[setIndex0], ...patch };
    return patchMatchWithDerivedVoleyScore({ ...base, sets });
  }

  function replaceMatchInMatches(matches: Match[], matchId: string, next: Match): Match[] {
    return matches.map((m) => (m.id === matchId ? next : m));
  }

  function updateScoreInRounds(rounds: CupRound[], matchId: string, next: Match): CupRound[] {
    return rounds.map((r) => ({
      ...r,
      matches: replaceMatchInMatches(r.matches, matchId, next),
    }));
  }

  function matchWinner(m: Match): string | null {
    const p = patchMatchWithDerivedVoleyScore(ensureMatchHasSets(m));
    if (p.homeScore == null || p.awayScore == null) return null;
    if (p.homeScore > p.awayScore) return p.home;
    if (p.awayScore > p.homeScore) return p.away;
    return null;
  }

  const leagueStandings = useMemo(() => {
    if (!draft || draft.format === "copa" || !draft.leagueMatches) return [] as VoleyStandingsRow[];
    const teamNames = draft.teams.map((t) => t.name);
    const patched = draft.leagueMatches.map((m) => patchMatchWithDerivedVoleyScore(ensureMatchHasSets(m)));
    const base = computeVoleyStandings(teamNames, patched);
    if (!draft.attendanceConfirmed) return base;
    return base.map((r) => ({ ...r, pts: r.pts + (draft.attendanceConfirmed?.[r.team] ? 5 : 0) }));
  }, [draft]);

  function standingsForGroup(key: GroupKey): VoleyStandingsRow[] {
    if (!draft?.groups?.[key]) return [];
    const group = draft.groups[key];
    const patched = group.matches.map((m) => patchMatchWithDerivedVoleyScore(ensureMatchHasSets(m)));
    const base = computeVoleyStandings(group.teams, patched);
    if (!draft.attendanceConfirmed) return base;
    return base.map((r) => ({ ...r, pts: r.pts + (draft.attendanceConfirmed?.[r.team] ? 5 : 0) }));
  }

  if (!draft) {
    return (
      <VoleyShell step="resumen" title="Resumen" subtitle="No hay un torneo en borrador. Volvé a crear equipos.">
        <VoleyCard title="Sin borrador" subtitle="No encontramos un torneo guardado en este navegador.">
          <button
            className="mt-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-sm"
            onClick={() => router.push("/voley")}
          >
            ← Ir a vóley
          </button>
        </VoleyCard>
      </VoleyShell>
    );
  }

  const groupsExist = !!draft.groups?.A || !!draft.groups?.B;

  // Normalize stage for liga_grupos_playoffs.
  const ligaGPStage =
    draft.format !== "liga_grupos_playoffs"
      ? null
      : (draft.stage ??
          (draft.playoffsRounds ? "playoffs" : draft.groups?.A && draft.groups?.B ? "groups" : "league"));

  const canGenerateGroups =
    draft.format === "liga_grupos_playoffs" &&
    ligaGPStage === "league" &&
    !!draft.leagueMatches &&
    allVoleyMatchesPlayed(draft.leagueMatches.map(ensureMatchHasSets)) &&
    !groupsExist;

  const canGeneratePlayoffs =
    draft.format === "liga_grupos_playoffs" &&
    ligaGPStage === "groups" &&
    !!draft.groups?.A &&
    !!draft.groups?.B &&
    allVoleyMatchesPlayed(draft.groups.A.matches.map(ensureMatchHasSets)) &&
    allVoleyMatchesPlayed(draft.groups.B.matches.map(ensureMatchHasSets)) &&
    !draft.playoffsRounds;

  const playoffsAllMatches: Match[] = draft.playoffsRounds ? draft.playoffsRounds.flatMap((r) => r.matches) : [];
  const playoffsById = new Map(playoffsAllMatches.map((m) => [m.id, m] as const));
  const finalMatch = draft.playoffsRounds?.find((r) => r.name === "Final")?.matches?.[0];
  const champion = finalMatch ? matchWinner(finalMatch) : null;

  return (
    <VoleyShell step="resumen" title="Resumen del torneo" subtitle={`Deporte: Vóley — Formato: ${draft.format ?? "-"}`}>
      {draft.format === "liga_grupos_playoffs" && champion && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          <div className="font-extrabold tracking-tight">🏆 Campeón: {champion}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <VoleyCard
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
                    <div className="text-sm text-zinc-600 dark:text-white/70">Jugadores: {t.players.length}</div>
                  </div>

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
                      {draft.attendanceConfirmed?.[t.name] ? "Quitar asistencia" : "Confirmar asistencia (+5)"}
                    </button>
                  </div>
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
        </VoleyCard>

        <VoleyCard
          title="Estructura"
          subtitle="Fixture + resultados + tablas (por sets)."
          right={
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
              Sets
            </div>
          }
        >
          {draft.format !== "copa" && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500 dark:text-white/60">Ver tabla completa.</div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => setStandingsModalOpen(true)}
              >
                Tabla completa
              </button>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            <span className="font-extrabold">Aclaración:</span> en todos los partidos el <span className="font-semibold">primer equipo</span> es
            <span className="font-semibold"> Local</span> y el <span className="font-semibold">segundo</span> es <span className="font-semibold">Visitante</span>.
            En cada set, el <span className="font-semibold">primer casillero</span> es Local y el <span className="font-semibold">segundo</span> Visitante.
          </div>

          {/* ---------------- LIGA SIMPLE ---------------- */}
          {draft.format === "liga" && draft.leagueMatches && (
            <section className="mt-4 space-y-8">
              <div>
                <div className="font-semibold">Partidos (cargá puntos por set)</div>
                <div className="mt-4 space-y-6">
                  {Array.from(new Set(draft.leagueMatches.map((m) => m.round))).map((round) => (
                    <div key={round}>
                      <div className="font-semibold">Fecha {round}</div>
                      <div className="mt-2 space-y-2">
                        {(draft.leagueMatches ?? [])
                          .filter((m) => m.round === round)
                          .map((m) => (
                            <VoleyMatchCard
                              key={m.id}
                              match={ensureMatchHasSets(m)}
                              onChange={(nextMatch) => {
                                persist({
                                  ...draft,
                                  leagueMatches: replaceMatchInMatches(draft.leagueMatches ?? [], m.id, nextMatch),
                                });
                              }}
                              parseScore={parseScore}
                              updateSetScoreInMatch={updateSetScoreInMatch}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold">Tabla</div>
                <VoleyStandingsTable rows={leagueStandings} />
              </div>
            </section>
          )}

          {/* ---------------- COPA ---------------- */}
          {draft.format === "copa" && draft.cupRounds && (
            <section className="mt-4 space-y-6">
              {draft.cupRounds.map((r) => (
                <div key={r.round}>
                  <div className="font-semibold">{r.name}</div>
                  <div className="mt-2 space-y-2">
                    {r.matches.map((m) => (
                      <VoleyMatchCard
                        key={m.id}
                        match={ensureMatchHasSets(m)}
                        onChange={(nextMatch) => {
                          const nextRounds = updateScoreInRounds(draft.cupRounds ?? [], m.id, nextMatch);
                          persist({ ...draft, cupRounds: nextRounds });
                        }}
                        parseScore={parseScore}
                        updateSetScoreInMatch={updateSetScoreInMatch}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ---------------- LIGA -> GRUPOS -> PLAYOFFS ---------------- */}
          {draft.format === "liga_grupos_playoffs" && draft.leagueMatches && (
            <section className="mt-4 space-y-8">
              {ligaGPStage === "league" && (
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
                        const split = splitIntoGroupsFromStandings(leagueStandings);
                        const groups = generateVoleyGroupPhase(split);
                        persist({ ...draft, stage: "groups", groups });
                      }}
                    >
                      Generar grupos
                    </button>
                  </div>

                  <div className="mt-4 space-y-6">
                    {Array.from(new Set(draft.leagueMatches.map((m) => m.round))).map((round) => (
                      <div key={round}>
                        <div className="font-semibold">Fecha {round}</div>
                        <div className="mt-2 space-y-2">
                          {(draft.leagueMatches ?? [])
                            .filter((m) => m.round === round)
                            .map((m) => (
                              <VoleyMatchCard
                                key={m.id}
                                match={ensureMatchHasSets(m)}
                                onChange={(nextMatch) => {
                                  persist({
                                    ...draft,
                                    leagueMatches: replaceMatchInMatches(draft.leagueMatches ?? [], m.id, nextMatch),
                                  });
                                }}
                                parseScore={parseScore}
                                updateSetScoreInMatch={updateSetScoreInMatch}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <div className="font-semibold">Tabla general</div>
                    <VoleyStandingsTable rows={leagueStandings} />
                  </div>
                </section>
              )}

              {ligaGPStage === "groups" && draft.groups?.A && draft.groups?.B && (
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
                        const playoffsRounds = generatePlayoffsFromGroups({ groupAStandings: sA, groupBStandings: sB });
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
                    onChangeMatch={(matchId, nextMatch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          A: { ...draft.groups.A, matches: replaceMatchInMatches(draft.groups.A.matches, matchId, nextMatch) },
                        },
                      });
                    }}
                    parseScore={parseScore}
                    updateSetScoreInMatch={updateSetScoreInMatch}
                  />

                  <GroupBlock
                    title="Grupo B (resto)"
                    groupKey="B"
                    matches={draft.groups.B.matches}
                    standings={standingsForGroup("B")}
                    onChangeMatch={(matchId, nextMatch) => {
                      if (!draft.groups) return;
                      persist({
                        ...draft,
                        groups: {
                          ...draft.groups,
                          B: { ...draft.groups.B, matches: replaceMatchInMatches(draft.groups.B.matches, matchId, nextMatch) },
                        },
                      });
                    }}
                    parseScore={parseScore}
                    updateSetScoreInMatch={updateSetScoreInMatch}
                  />
                </section>
              )}

              {(ligaGPStage === "playoffs" || ligaGPStage === "finished") && draft.playoffsRounds && (
                <section className="space-y-4">
                  <div>
                    <div className="font-semibold">Fase 3 — Playoffs</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">En playoffs no hay empates: se define por sets.</div>
                  </div>

                  <div className="space-y-6">
                    {draft.playoffsRounds.map((r) => (
                      <div key={r.round}>
                        <div className="font-semibold">{r.name}</div>
                        <div className="mt-2 space-y-2">
                          {r.matches.map((m) => {
                            const resolved = resolveMatchTeams(m, playoffsById);
                            const playable =
                              resolved.home &&
                              resolved.away &&
                              !resolved.home.startsWith("Ganador") &&
                              !resolved.away.startsWith("Ganador") &&
                              resolved.home !== "BYE" &&
                              resolved.away !== "BYE";

                            const withTeams = { ...m, home: resolved.home, away: resolved.away };
                            return (
                              <div
                                key={m.id}
                                className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <div className="font-medium">
                                    {resolved.home} vs {resolved.away}
                                  </div>
                                  {!playable && <div className="text-xs text-zinc-500">(Esperando resultados previos)</div>}
                                </div>

                                <VoleySetsEditor
                                  match={ensureMatchHasSets(withTeams)}
                                  disabled={!playable}
                                  parseScore={parseScore}
                                  updateSetScoreInMatch={updateSetScoreInMatch}
                                  onChange={(nextMatch) => {
                                    const nextRounds = updateScoreInRounds(draft.playoffsRounds ?? [], m.id, nextMatch);
                                    const f = nextRounds.find((x) => x.name === "Final")?.matches?.[0];
                                    const done = f && matchWinner(f) ? "finished" : draft.stage;
                                    persist({ ...draft, stage: done, playoffsRounds: nextRounds });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </section>
          )}
        </VoleyCard>
      </div>

      {standingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Tabla completa">
          <button className="absolute inset-0 bg-black/50" onClick={() => setStandingsModalOpen(false)} aria-label="Cerrar" />

          <div className="relative w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold tracking-tight">Tabla completa</div>
                <div className="text-xs text-zinc-500 dark:text-white/60">Orden: Pts → Dif. sets → Dif. puntos.</div>
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
                <VoleyStandingsTable rows={leagueStandings} />
              ) : draft.format === "liga_grupos_playoffs" ? (
                <div className="space-y-6">
                  {ligaGPStage === "league" && draft.leagueMatches && (
                    <div>
                      <div className="text-sm font-extrabold">Fase 1 — Liga (tabla general)</div>
                      <VoleyStandingsTable rows={leagueStandings} />
                    </div>
                  )}

                  {ligaGPStage === "groups" && draft.groups?.A && draft.groups?.B && (
                    <>
                      <div>
                        <div className="text-sm font-extrabold">Fase 2 — Grupo A</div>
                        <VoleyStandingsTable rows={standingsForGroup("A")} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold">Fase 2 — Grupo B</div>
                        <VoleyStandingsTable rows={standingsForGroup("B")} />
                      </div>
                    </>
                  )}

                  {(ligaGPStage === "playoffs" || ligaGPStage === "finished") && (
                    <div className="text-sm text-zinc-600 dark:text-white/70">En Playoffs no hay tabla.</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-600 dark:text-white/70">Sin tabla para este formato.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          onClick={() => router.push("/voley/formato")}
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
    </VoleyShell>
  );
}

function stripInternalFlags(d: TournamentDraft & { __voleySetsMigrated?: boolean }) {
  // We don't want internal flags in DB.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __voleySetsMigrated, ...rest } = d;
  return rest as TournamentDraft;
}

function migrateDraftToVoleySets(d: TournamentDraft): TournamentDraft & { __voleySetsMigrated?: boolean } {
  if (d.sport !== "voley") return d;

  let touched = false;
  const ensure = (m: Match): Match => {
    if (m.sets && m.sets.length > 0) return m;
    touched = true;
    return { ...m, sets: makeEmptyVoleySets(), homeScore: null, awayScore: null };
  };

  const leagueMatches = d.leagueMatches ? d.leagueMatches.map(ensure) : undefined;
  const cupRounds = d.cupRounds
    ? d.cupRounds.map((r) => ({ ...r, matches: r.matches.map(ensure) }))
    : undefined;
  const playoffsRounds = d.playoffsRounds
    ? d.playoffsRounds.map((r) => ({ ...r, matches: r.matches.map(ensure) }))
    : undefined;
  const groups = d.groups
    ? {
        ...d.groups,
        A: d.groups.A ? { ...d.groups.A, matches: d.groups.A.matches.map(ensure) } : d.groups.A,
        B: d.groups.B ? { ...d.groups.B, matches: d.groups.B.matches.map(ensure) } : d.groups.B,
      }
    : undefined;

  if (!touched) return d;
  return { ...d, leagueMatches, cupRounds, playoffsRounds, groups, __voleySetsMigrated: true };
}

function VoleyMatchCard(props: {
  match: Match;
  onChange: (next: Match) => void;
  parseScore: (raw: string) => number | null;
  updateSetScoreInMatch: (m: Match, setIndex0: number, patch: Partial<VoleySetScore>) => Match;
}) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 font-medium">
        {props.match.home} vs {props.match.away}
      </div>
      <VoleySetsEditor
        match={props.match}
        parseScore={props.parseScore}
        updateSetScoreInMatch={props.updateSetScoreInMatch}
        onChange={props.onChange}
      />
    </div>
  );
}

function VoleySetsEditor(props: {
  match: Match;
  disabled?: boolean;
  onChange: (next: Match) => void;
  parseScore: (raw: string) => number | null;
  updateSetScoreInMatch: (m: Match, setIndex0: number, patch: Partial<VoleySetScore>) => Match;
}) {
  const m = props.match;
  const sets = m.sets ?? makeEmptyVoleySets();
  const summary = computeVoleyMatchSummary(m);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 dark:text-white/50">Set {i + 1}</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="w-full min-w-0 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                inputMode="numeric"
                placeholder="L"
                aria-label={`Set ${i + 1} - puntos Local (${m.home})`}
                disabled={props.disabled}
                value={sets[i]?.home ?? ""}
                onChange={(e) => {
                  const next = props.parseScore(e.target.value);
                  props.onChange(props.updateSetScoreInMatch(m, i, { home: next }));
                }}
              />
              <span className="text-xs text-zinc-400">-</span>
              <input
                className="w-full min-w-0 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                inputMode="numeric"
                placeholder="V"
                aria-label={`Set ${i + 1} - puntos Visitante (${m.away})`}
                disabled={props.disabled}
                value={sets[i]?.away ?? ""}
                onChange={(e) => {
                  const next = props.parseScore(e.target.value);
                  props.onChange(props.updateSetScoreInMatch(m, i, { away: next }));
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
          Sets: <span className="font-extrabold">{summary.homeSetsWon}</span>-<span className="font-extrabold">{summary.awaySetsWon}</span>
          <span className="mx-2 text-zinc-400">|</span>
          Puntos: <span className="font-extrabold">{summary.homePoints}</span>-<span className="font-extrabold">{summary.awayPoints}</span>
        </div>

        {!summary.finished && (sets.some((s) => s.home != null || s.away != null) ? (
          <div className="text-xs text-amber-700 dark:text-amber-300">Partido incompleto: falta cerrar sets hasta 3.</div>
        ) : (
          <div className="text-xs text-zinc-500 dark:text-white/60">Cargá sets para finalizar el partido.</div>
        ))}
      </div>

      {summary.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-bold">Atención</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {summary.warnings.slice(0, 3).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VoleyStandingsTable({ rows }: { rows: VoleyStandingsRow[] }) {
  if (rows.length === 0) {
    return <div className="mt-2 text-sm text-zinc-500">Sin datos todavía.</div>;
  }

  return (
    <div className="mt-2 overflow-auto">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50">
        Prioridad: Pts → Dif. sets → Dif. puntos
      </div>

      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-600 dark:text-zinc-400">
            <th className="py-2">Pos</th>
            <th className="py-2">Equipo</th>
            <th className="py-2">PJ</th>
            <th className="py-2">PG</th>
            <th className="py-2">PP</th>
            <th className="py-2">SF</th>
            <th className="py-2">SC</th>
            <th className="py-2">DS</th>
            <th className="py-2">PF</th>
            <th className="py-2">PC</th>
            <th className="py-2">DP</th>
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
              <td className="py-2">{r.lost}</td>
              <td className="py-2">{r.setsFor}</td>
              <td className="py-2">{r.setsAgainst}</td>
              <td className="py-2">{r.setsDiff}</td>
              <td className="py-2">{r.pointsFor}</td>
              <td className="py-2">{r.pointsAgainst}</td>
              <td className="py-2">{r.pointsDiff}</td>
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
  standings: VoleyStandingsRow[];
  onChangeMatch: (matchId: string, next: Match) => void;
  parseScore: (raw: string) => number | null;
  updateSetScoreInMatch: (m: Match, setIndex0: number, patch: Partial<VoleySetScore>) => Match;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="font-semibold">{props.title}</div>

      <div className="mt-3 space-y-4">
        {Array.from(new Set(props.matches.map((m) => m.round))).map((round) => (
          <div key={`${props.groupKey}_${round}`}>
            <div className="font-semibold text-sm">Fecha {round}</div>
            <div className="mt-2 space-y-2">
              {props.matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <VoleyMatchCard
                    key={m.id}
                    match={m.sets ? m : { ...m, sets: makeEmptyVoleySets() }}
                    onChange={(nextMatch) => props.onChangeMatch(m.id, nextMatch)}
                    parseScore={props.parseScore}
                    updateSetScoreInMatch={props.updateSetScoreInMatch}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="font-semibold text-sm">Tabla</div>
        <VoleyStandingsTable rows={props.standings} />
      </div>
    </div>
  );
}

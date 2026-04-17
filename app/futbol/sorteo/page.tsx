"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CupRound, GroupPhase, GroupKey, Team, TournamentDraft, TournamentFormat } from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetDraft, apiGetNistPulse, apiGetTeams, apiSetDraft, apiSetTeams } from "@/lib/tournamentsApi";
import { mulberry32, seed32FromHex, shuffleInPlace } from "@/lib/shuffle";
import { generateCupRounds, generateGroupPhase, generateLeagueMatches } from "@/lib/tournament";
import { useRequireAuth } from "@/lib/authRequired";
import FutbolShell from "../_components/FutbolShell";
import FutbolCard from "../_components/FutbolCard";

type SpinState = "idle" | "spinning" | "done";
type RevealMode = "all" | "step";

type DrawnPair = { home: string; away: string };

function formatPair(pair: DrawnPair) {
  const isGroup = pair.away.startsWith("Grupo");
  return isGroup ? `${pair.home} → ${pair.away}` : `${pair.home} vs ${pair.away}`;
}

function splitIntoRandomGroups(teamNames: string[]): Record<GroupKey, string[]> {
  const A: string[] = [];
  const B: string[] = [];
  teamNames.forEach((t, idx) => {
    (idx % 2 === 0 ? A : B).push(t);
  });
  return { A, B };
}

function isValidDraft(d: TournamentDraft | null): d is TournamentDraft {
  return !!d && d.sport === "futbol";
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function CupBracket(props: {
  rounds: CupRound[];
  revealMode: RevealMode;
  revealedPairKeySet: Set<string>;
}) {
  // Bracket layout (world-cup style): columns, with each next round centered between previous matches.
  // We use an absolute positioning approach so Semis/Final are vertically centered.
  const row = 110; // distance between match "slots" in round 1 (px)
  const cardH = 78; // approximate card height (px)

  const firstRoundCount = props.rounds[0]?.matches.length ?? 0;
  const totalH = Math.max(cardH, (firstRoundCount - 1) * row + cardH);

  return (
    <div className="mt-2 overflow-x-auto">
      <div className="flex min-w-[820px] gap-6 pb-2">
        {props.rounds.map((r, roundIndex) => {
          const matches = r.matches.filter((m) => {
            if (props.revealMode !== "step") return true;
            if (r.round !== 1) return true;
            const key = [m.home, m.away].sort().join("||");
            return props.revealedPairKeySet.has(key);
          });

          const step = row * 2 ** roundIndex;
          const offset = Math.max(0, (step - cardH) / 2);

          return (
            <div key={r.round} className="min-w-[220px]">
              <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{r.name}</div>

              <div className="relative mt-3" style={{ height: totalH }}>
                {matches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 p-3 text-xs text-zinc-500 dark:border-white/20 dark:bg-white/5 dark:text-white/60">
                    Revelá cruces para ver esta ronda.
                  </div>
                ) : (
                  matches.map((m, matchIndex) => (
                    <div
                      key={m.id}
                      className={
                        "absolute left-0 right-0 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 " +
                        // small horizontal connectors (bracket vibe)
                        (roundIndex > 0
                          ? "before:absolute before:left-[-12px] before:top-1/2 before:h-px before:w-3 before:bg-zinc-300 dark:before:bg-white/20"
                          : "") +
                        (roundIndex < props.rounds.length - 1
                          ? " after:absolute after:right-[-12px] after:top-1/2 after:h-px after:w-3 after:bg-zinc-300 dark:after:bg-white/20"
                          : "")
                      }
                      style={{ top: matchIndex * step + offset }}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="font-semibold leading-tight">{m.home}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/40">
                          vs
                        </div>
                        <div className="font-semibold leading-tight">{m.away}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FutbolSorteoPage() {
  const router = useRouter();
  const { loading } = useRequireAuth();

  const tournamentId = useMemo(() => (typeof window === "undefined" ? null : getActiveTournamentId()), []);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [format, setFormat] = useState<TournamentFormat | null>(null);
  const [ordered, setOrdered] = useState<Team[] | null>(null);
  const [cupRounds, setCupRounds] = useState<CupRound[] | null>(null);
  const [groups, setGroups] = useState<Record<GroupKey, GroupPhase> | null>(null);
  const [drawnPairs, setDrawnPairs] = useState<DrawnPair[]>([]);
  const [pendingPairs, setPendingPairs] = useState<DrawnPair[]>([]);
  const [spin, setSpin] = useState<SpinState>("idle");
  const [slotText, setSlotText] = useState<string>("—");
  const [revealMode, setRevealMode] = useState<RevealMode>("step");
  const intervalRef = useRef<number | null>(null);
  const pairIntervalRef = useRef<number | null>(null);
  const pairTimeoutRef = useRef<number | null>(null);
  const [pairSpinning, setPairSpinning] = useState(false);

  const [randomnessProof, setRandomnessProof] = useState<TournamentDraft["randomnessProof"] | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);

  useEffect(() => {
    if (!proofModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setProofModalOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [proofModalOpen]);

  const revealedPairKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const p of drawnPairs) {
      // order-independent key for matches
      const a = p.home;
      const b = p.away;
      set.add([a, b].sort().join("||"));
    }
    return set;
  }, [drawnPairs]);

  const bolilleroItems = useMemo(() => {
    if (pendingPairs.length === 0) return [] as string[];

    // Show remaining "balls" (teams) that haven't come out yet.
    if (format === "copa") {
      const set = new Set<string>();
      for (const p of pendingPairs) {
        if (p.home && p.home !== "BYE") set.add(p.home);
        if (p.away && p.away !== "BYE") set.add(p.away);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    if (format === "liga_grupos_playoffs") {
      return pendingPairs.map((p) => p.home);
    }

    // Liga: pairs are (position -> teamName)
    return pendingPairs.map((p) => p.away);
  }, [format, pendingPairs]);

  useEffect(() => {
    if (loading) return;
    if (!tournamentId) {
      router.replace("/tournaments");
      return;
    }

    let cancelled = false;

    Promise.all([apiGetTeams(tournamentId), apiGetDraft(tournamentId)])
      .then(([t, d]) => {
        if (cancelled) return;
        Promise.resolve().then(() => {
          if (cancelled) return;
          setTeams(t);
          setFormat(isValidDraft(d) ? (d.format ?? null) : null);
          setRandomnessProof(isValidDraft(d) ? d.randomnessProof ?? null : null);
        });
      })
      .catch((err) => {
        console.error("Failed to load sorteo context", err);
        alert("No se pudo cargar el torneo.");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, router, tournamentId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      if (pairIntervalRef.current != null) window.clearInterval(pairIntervalRef.current);
      if (pairTimeoutRef.current != null) window.clearTimeout(pairTimeoutRef.current);
    };
  }, []);

  function startPairSpin(samplePool: DrawnPair[], onDone: () => void) {
    if (pairIntervalRef.current != null) window.clearInterval(pairIntervalRef.current);
    if (pairTimeoutRef.current != null) window.clearTimeout(pairTimeoutRef.current);

    setPairSpinning(true);
    pairIntervalRef.current = window.setInterval(() => {
      const sample = pick(samplePool);
      setSlotText(formatPair(sample));
    }, 60);

    pairTimeoutRef.current = window.setTimeout(() => {
      if (pairIntervalRef.current != null) window.clearInterval(pairIntervalRef.current);
      pairIntervalRef.current = null;
      setPairSpinning(false);
      onDone();
    }, 900);
  }

  function revealNextPair() {
    if (revealMode !== "step") return;
    if (pairSpinning) return;
    if (pendingPairs.length === 0) return;

    // Add suspense: spin using remaining pair pool, then reveal exactly ONE.
    startPairSpin(pendingPairs, () => {
      const next = pendingPairs[0]!;
      setPendingPairs((prev) => prev.slice(1));
      setDrawnPairs((prev) => [...prev, next]);
      setSlotText(formatPair(next));
    });
  }

  function handlePrimaryDrawClick() {
    // Single button UX:
    // - First click starts the draw.
    // - Subsequent clicks reveal the remaining matchups (step mode).
    if (spin === "idle") {
      startSpin();
      return;
    }

    if (spin === "done" && revealMode === "step" && pendingPairs.length > 0) {
      revealNextPair();
    }
  }

  function startSpin() {
    if (!teams || teams.length < 2) return;
    if (!format) {
      router.push("/futbol/formato");
      return;
    }
    if (spin === "spinning") return;

    setSpin("spinning");
    setOrdered(null);
    setCupRounds(null);
    setGroups(null);
    setDrawnPairs([]);
    setPendingPairs([]);

    // Slot machine effect: quickly changes names, then stops.
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setSlotText(pick(teams).name);
    }, 60);

    // Stop after 1.2s, compute draw.
    window.setTimeout(async () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;

      // 1) Get a verifiable randomness pulse (NIST Beacon).
      // If it fails, fallback to local randomness (still works, but not verifiable).
      let proof: TournamentDraft["randomnessProof"];
      let rng = Math.random;

      try {
        const pulse = await apiGetNistPulse();
        const output = pulse.nistPulse?.outputValue;
        if (!output) throw new Error("NIST pulse missing outputValue");
        const seed = seed32FromHex(output);
        rng = mulberry32(seed);
        proof = {
          source: "nist-beacon",
          fetchedAt: pulse.fetchedAt,
          nistPulse: {
            uri: pulse.nistPulse?.uri,
            timeStamp: pulse.nistPulse?.timeStamp,
            pulseIndex: pulse.nistPulse?.pulseIndex,
            outputValue: pulse.nistPulse?.outputValue,
            signatureValue: pulse.nistPulse?.signatureValue,
          },
        };
      } catch (err) {
        console.warn("NIST beacon unavailable, using local randomness", err);
        const localRandomValue =
          typeof crypto !== "undefined" && "getRandomValues" in crypto
            ? crypto.getRandomValues(new Uint32Array(4)).join("-")
            : String(Math.random());
        proof = {
          source: "local",
          fetchedAt: new Date().toISOString(),
          nistPulse: { localRandomValue },
        };
      }

      const next = shuffleInPlace([...teams], rng);
      setOrdered(next);
      setSlotText("Sorteo listo");

      // Prepare the structure that will be revealed/persisted.
      const nextNames = next.map((t) => t.name);

      let nextDraft: TournamentDraft;
      let nextCupRounds: CupRound[] | null = null;
      let nextGroups: Record<GroupKey, GroupPhase> | null = null;
      let revealPairs: DrawnPair[] = [];

      if (format === "copa") {
        nextCupRounds = generateCupRounds(next);
        // reveal first round pairings.
        revealPairs = (nextCupRounds[0]?.matches ?? []).map((m) => ({ home: m.home, away: m.away }));
        nextDraft = { sport: "futbol", teams: next, format, randomnessProof: proof, cupRounds: nextCupRounds };
      } else if (format === "liga_grupos_playoffs") {
        // Randomly assign teams to groups A/B and generate matches.
        const split = splitIntoRandomGroups(nextNames);
        nextGroups = generateGroupPhase(split);
        // reveal group assignments as “pairs” (Team → Grupo X)
        revealPairs = nextNames.map((name) => ({ home: name, away: split.A.includes(name) ? "Grupo A" : "Grupo B" }));
        nextDraft = { sport: "futbol", teams: next, format, randomnessProof: proof, stage: "groups", groups: nextGroups };
      } else {
        // Liga: order affects the fixture too.
        revealPairs = nextNames.map((name, idx) => ({ home: String(idx + 1), away: name }));
        nextDraft = { sport: "futbol", teams: next, format, randomnessProof: proof, leagueMatches: generateLeagueMatches(next) };
      }

      if (revealMode === "all") {
        setDrawnPairs(revealPairs);
        setPendingPairs([]);
        if (revealPairs.length > 0) setSlotText(formatPair(revealPairs[revealPairs.length - 1]!));
      } else {
        // Step-by-step: the click on "Sortear" reveals the FIRST matchup.
        // Then the user reveals the rest one-by-one.
        setDrawnPairs([]);
        setPendingPairs(revealPairs);
      }

      try {
        if (!tournamentId) return;
        // 1) persist new order of teams
        await apiSetTeams(tournamentId, next);

        // 2) persist the tournament draft with generated matchups.
        await apiSetDraft(tournamentId, nextDraft);

        // 3) update UI previews
        if (nextCupRounds) setCupRounds(nextCupRounds);
        if (nextGroups) setGroups(nextGroups);
        setRandomnessProof(proof);
        setSpin("done");

        // In step mode, immediately reveal exactly 1 pairing (the first) with suspense.
        if (revealMode === "step" && revealPairs.length > 0) {
          startPairSpin(revealPairs, () => {
            const first = revealPairs[0]!;
            setDrawnPairs([first]);
            setPendingPairs(revealPairs.slice(1));
            setSlotText(formatPair(first));
          });
        }
      } catch (err) {
        console.error("Failed to persist shuffle", err);
        alert("No se pudo guardar el sorteo.");
        setSpin("idle");
      }
    }, 1200);
  }

  if (teams === null) {
    return (
      <FutbolShell step="sorteo" title="Sorteo" subtitle="Cargando equipos...">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          Cargando...
        </div>
      </FutbolShell>
    );
  }

  if (teams.length < 2) {
    return (
      <FutbolShell step="equipos" title="Sorteo" subtitle="Necesitás al menos 2 equipos.">
        <FutbolCard title="No hay equipos suficientes" subtitle="Volvé y cargá equipos.">
          <button
            className="mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold tracking-wide text-black shadow-sm"
            onClick={() => router.push("/futbol")}
          >
            ← Ir a crear equipos
          </button>
        </FutbolCard>
      </FutbolShell>
    );
  }

  return (
    <FutbolShell
      step="sorteo"
      title="Sorteo de equipos"
      subtitle="Se define el orden aleatorio de los equipos para el fixture."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <FutbolCard
          title="Ruleta"
          subtitle={
            format === "copa"
              ? "Se sortean todos los cruces del cuadro."
              : format === "liga_grupos_playoffs"
                ? "Se sortean los grupos A/B y sus enfrentamientos."
                : "Se sortea el orden y se genera el fixture."
          }
          right={
            <div className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              Paso 3/4
            </div>
          }
        >
          <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-6 text-center text-2xl font-extrabold tracking-tight shadow-sm dark:border-zinc-800 dark:bg-black">
            <div className={spin === "spinning" ? "animate-pulse" : ""}>{slotText}</div>
          </div>

          {randomnessProof && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold tracking-wide shadow-sm " +
                  (randomnessProof.source === "nist-beacon"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-zinc-200 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80")
                }
              >
                {randomnessProof.source === "nist-beacon" ? "✓ Aleatoriedad certificada (NIST Beacon)" : "Aleatoriedad local (sin certificación)"}
              </div>

              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => setProofModalOpen(true)}
              >
                Ver certificado
              </button>
            </div>
          )}

          {spin !== "idle" && revealMode === "step" && bolilleroItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50">
                Bolillero (faltan)
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bolilleroItems.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white/80"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drawnPairs.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50">
                {format === "copa" ? "Cruces sorteados" : format === "liga_grupos_playoffs" ? "Grupos sorteados" : "Orden"}
              </div>
              <ul className="space-y-2">
                {drawnPairs.map((p, idx) => (
                  <li
                    key={`${p.home}_${p.away}_${idx}`}
                    className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    {p.away.startsWith("Grupo") ? (
                      <>
                        <span className="font-semibold">{p.home}</span>
                        <span className="mx-2 text-zinc-400">→</span>
                        <span className="font-semibold">{p.away}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{p.home}</span>
                        <span className="mx-2 text-zinc-400">vs</span>
                        <span className="font-semibold">{p.away}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold tracking-wide text-black shadow-sm disabled:opacity-50"
            onClick={handlePrimaryDrawClick}
            disabled={spin === "spinning" || pairSpinning || (spin === "done" && revealMode === "step" && pendingPairs.length === 0)}
          >
            {spin === "spinning"
              ? "Sorteando..."
              : spin === "done" && revealMode === "step" && pendingPairs.length > 0
                ? `Sortear siguiente (${pendingPairs.length} restantes)`
                : "Sortear"}
          </button>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={
                "rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm " +
                (revealMode === "all"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-zinc-200 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80")
              }
              onClick={() => setRevealMode("all")}
              disabled={spin === "spinning" || pairSpinning}
            >
              Mostrar todo
            </button>

            <button
              type="button"
              className={
                "rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm " +
                (revealMode === "step"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-zinc-200 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80")
              }
              onClick={() => setRevealMode("step")}
              disabled={spin === "spinning" || pairSpinning}
            >
              Uno por uno
            </button>
          </div>

          {spin === "done" && (revealMode !== "step" || pendingPairs.length === 0) && (
            <button
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:from-white dark:to-white dark:text-black"
              onClick={() => router.push("/futbol/resumen")}
            >
              Continuar → Resumen
            </button>
          )}
        </FutbolCard>

        <FutbolCard
          title={
            format === "copa"
              ? cupRounds
                ? "Cuadro (completo)"
                : "Cuadro"
              : format === "liga_grupos_playoffs"
                ? groups
                  ? "Grupos"
                  : "Grupos"
                : ordered
                  ? "Orden sorteado"
                  : "Equipos"
          }
          subtitle={
            format === "copa"
              ? "Se muestran todos los cruces del cuadro."
              : format === "liga_grupos_playoffs"
                ? "Asignación a grupos A/B y sus partidos."
                : ordered
                  ? "Así quedó el orden."
                  : "Se usará para el sorteo."
          }
        >
          {format === "copa" && cupRounds ? (
            <>
              {revealMode === "step" && cupRounds[0] && (
                <div className="mt-2 text-xs text-zinc-500 dark:text-white/60">
                  Cruces revelados: {drawnPairs.length} / {cupRounds[0].matches.length}
                </div>
              )}
              <CupBracket rounds={cupRounds} revealMode={revealMode} revealedPairKeySet={revealedPairKeySet} />
            </>
          ) : format === "liga_grupos_playoffs" && groups ? (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {(Object.keys(groups) as GroupKey[]).map((k) => (
                <div key={k} className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="text-sm font-extrabold">Grupo {k}</div>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {groups[k].teams.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {(ordered ?? teams).map((t, idx) => (
                <li
                  key={`${t.name}_${idx}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <div className="w-7 text-center text-sm font-extrabold text-zinc-600 dark:text-white/70">{idx + 1}</div>
                  {t.photo ? (
                    <Image src={t.photo} alt={`Foto de ${t.name}`} width={36} height={36} className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-zinc-200 text-[10px] dark:bg-white/10">sin foto</div>
                  )}
                  <div className="font-semibold">{t.name}</div>
                </li>
              ))}
            </ul>
          )}
        </FutbolCard>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          onClick={() => router.push("/futbol")}
        >
          ← Volver a equipos
        </button>
      </div>

      {proofModalOpen && randomnessProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setProofModalOpen(false)}
            aria-label="Cerrar"
          />

          <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold tracking-tight">Certificado de aleatoriedad</div>
                <div className="text-xs text-zinc-500 dark:text-white/60">
                  Estos datos permiten auditar el sorteo (no garantiza criptográficamente tu UI, pero sí la fuente pública del seed).
                </div>
              </div>

              <button
                type="button"
                className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm dark:bg-white dark:text-black"
                onClick={() => setProofModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              <div>
                <span className="font-semibold">Fuente:</span> {randomnessProof.source}
              </div>
              <div>
                <span className="font-semibold">Fecha de obtención:</span> {randomnessProof.fetchedAt}
              </div>

              {randomnessProof.source === "nist-beacon" ? (
                <>
                  <div>
                    <span className="font-semibold">Pulse index:</span> {randomnessProof.nistPulse?.pulseIndex ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Timestamp:</span> {randomnessProof.nistPulse?.timeStamp ?? "-"}
                  </div>
                  <div className="break-all">
                    <span className="font-semibold">Output value (seed):</span> {randomnessProof.nistPulse?.outputValue ?? "-"}
                  </div>
                  <div className="break-all">
                    <span className="font-semibold">Signature:</span> {randomnessProof.nistPulse?.signatureValue ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold">URL:</span>{" "}
                    <a
                      className="underline"
                      href={randomnessProof.nistPulse?.uri ?? "https://beacon.nist.gov"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {randomnessProof.nistPulse?.uri ?? "https://beacon.nist.gov"}
                    </a>
                  </div>
                </>
              ) : (
                <div className="break-all">
                  <span className="font-semibold">Local random:</span> {randomnessProof.nistPulse?.localRandomValue ?? "-"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </FutbolShell>
  );
}

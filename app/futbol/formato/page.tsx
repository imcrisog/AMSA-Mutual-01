"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, TournamentDraft, TournamentFormat } from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetTeams, apiSetDraft } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";
import FutbolShell from "../_components/FutbolShell";
import FutbolCard from "../_components/FutbolCard";

export default function FutbolFormatoPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [format, setFormat] = useState<TournamentFormat>("liga");
  const { loading } = useRequireAuth();
  const tournamentId = useMemo(() => (typeof window === "undefined" ? null : getActiveTournamentId()), []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    if (!tournamentId) {
      router.replace("/tournaments");
      return;
    }

    apiGetTeams(tournamentId)
      .then((parsed) => {
        if (cancelled) return;

        // NOTE: This repo enforces react-hooks/set-state-in-effect.
        // Schedule the state update asynchronously to avoid cascading-renders warnings.
        Promise.resolve().then(() => {
          if (cancelled) return;
          setTeams(parsed);
        });
      })
      .catch((err) => {
        console.error("Failed to load teams", err);
        alert("No se pudieron cargar los equipos.");
      });

    return () => {
      cancelled = true;
    };
  }, [loading, router, tournamentId]);

  function finalizeFormat() {
    if (!teams || teams.length < 2) return;
    if (!tournamentId) return;

    const draft: TournamentDraft = {
      sport: "futbol",
      teams,
      format,
    };

    if (format === "liga_grupos_playoffs") {
      draft.stage = "league";
    }

    apiSetDraft(tournamentId, draft)
      .then(() => router.push("/futbol/sorteo"))
      .catch((err) => {
        console.error("Failed to persist tournamentDraft", err);
        alert("No se pudo guardar el torneo.");
      });
  }

  if (teams === null) {
    return (
      <FutbolShell step="formato" title="Formato" subtitle="Preparando el fixture...">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          Cargando...
        </div>
      </FutbolShell>
    );
  }

  if (teams.length < 2) {
    return (
      <FutbolShell
        step="formato"
        title="Formato"
        subtitle="Necesitás al menos 2 equipos para generar el torneo."
      >
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
      step="formato"
      title="Formato del torneo"
      subtitle={`Equipos cargados: ${teams.length}. Elegí el formato y mirá una vista previa del fixture.`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <FutbolCard
          title="Elegí un formato"
          subtitle="Podés cambiarlo cuando quieras, el fixture se recalcula."
          right={
            <div className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              Paso 2/4
            </div>
          }
        >

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="liga"
              checked={format === "liga"}
              onChange={() => setFormat("liga")}
            />
            <span className="font-medium">Liga</span>
            <span className="text-xs text-zinc-500 dark:text-white/60">(todos contra todos)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="copa"
              checked={format === "copa"}
              onChange={() => setFormat("copa")}
            />
            <span className="font-medium">Copa</span>
            <span className="text-xs text-zinc-500 dark:text-white/60">(eliminación directa)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="liga_grupos_playoffs"
              checked={format === "liga_grupos_playoffs"}
              onChange={() => setFormat("liga_grupos_playoffs")}
            />
            <span className="font-medium">Liga → Grupos → Playoffs</span>
            <span className="text-xs text-zinc-500 dark:text-white/60">(A top8 / B resto)</span>
          </label>
        </div>
        </FutbolCard>

        <FutbolCard
          title="Siguiente paso"
          subtitle="Luego del formato se hace el sorteo de enfrentamientos (cruces/grupos) y recién ahí se genera el fixture definitivo."
          right={
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Sorteo
            </div>
          }
        >
          <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            {format === "liga" && (
              <p>
                <strong>Liga:</strong> se sortea un orden y se arma el todos-contra-todos.
              </p>
            )}
            {format === "copa" && (
              <p>
                <strong>Copa:</strong> se sortean los cruces y se genera el cuadro completo.
              </p>
            )}
            {format === "liga_grupos_playoffs" && (
              <p>
                <strong>Liga → Grupos → Playoffs:</strong> se sortean los grupos A/B y se generan sus partidos.
              </p>
            )}
          </div>
        </FutbolCard>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          onClick={() => router.push("/futbol")}
        >
          ← Volver a equipos
        </button>

        <button
          className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold tracking-wide text-black shadow-sm"
          onClick={finalizeFormat}
        >
            Continuar → Sorteo
        </button>
      </div>
    </FutbolShell>
  );
}

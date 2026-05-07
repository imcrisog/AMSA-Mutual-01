"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, TournamentDraft, TournamentFormat } from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetTeams, apiSetDraft } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";
import VoleyShell from "../_components/VoleyShell";
import VoleyCard from "../_components/VoleyCard";

export default function VoleyFormatoPage() {
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
      sport: "voley",
      teams,
      format,
    };

    if (format === "liga_grupos_playoffs") {
      draft.stage = "league";
    }

    apiSetDraft(tournamentId, draft)
      .then(() => router.push("/voley/sorteo"))
      .catch((err) => {
        console.error("Failed to persist tournamentDraft", err);
        alert("No se pudo guardar el torneo.");
      });
  }

  if (teams === null) {
    return (
      <VoleyShell step="formato" title="Formato" subtitle="Preparando el fixture...">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          Cargando...
        </div>
      </VoleyShell>
    );
  }

  if (teams.length < 2) {
    return (
      <VoleyShell step="formato" title="Formato" subtitle="Necesitás al menos 2 equipos para generar el torneo.">
        <VoleyCard title="No hay equipos suficientes" subtitle="Volvé y cargá equipos.">
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

  return (
    <VoleyShell
      step="formato"
      title="Formato del torneo"
      subtitle={`Equipos cargados: ${teams.length}. Elegí el formato y mirá una vista previa del fixture.`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <VoleyCard
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
        </VoleyCard>

        <VoleyCard
          title="Siguiente paso"
          subtitle="Luego del formato se hace el sorteo y recién ahí se genera el fixture definitivo."
          right={
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
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
                <strong>Liga → Grupos → Playoffs:</strong> se sortea el orden para la Liga (todos contra todos). Luego, al terminar la Liga se arma Grupo A (top 8) y Grupo B (resto), y recién después se generan los Playoffs.
              </p>
            )}
          </div>
        </VoleyCard>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          onClick={() => router.push("/voley")}
        >
          ← Volver a equipos
        </button>

        <button
          className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-sm"
          onClick={finalizeFormat}
        >
          Continuar → Sorteo
        </button>
      </div>
    </VoleyShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TournamentMeta } from "@/types/tournament";
import { setActiveTournamentId } from "@/lib/storage";
import { apiDeleteTournament, apiListTournaments } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";

function sportLabel(sport: TournamentMeta["sport"]) {
  if (sport === "futbol") return "⚽ Fútbol";
  if (sport === "voley") return "🏐 Vóley";
  return sport;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function TournamentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<TournamentMeta[]>([]);
  const { loading } = useRequireAuth();

  useEffect(() => {
    if (loading) return;
    apiListTournaments()
      .then((list) => Promise.resolve().then(() => setItems(list)))
      .catch((err) => {
        console.error("Failed to list tournaments", err);
        alert("No se pudieron cargar tus torneos.");
      });
  }, [loading]);

  const hasAny = items.length > 0;
  const ordered = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items]
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Mis torneos</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Retomá un borrador o eliminá torneos viejos.
            </p>
          </div>

          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            onClick={() => router.push("/")}
          >
            ← Volver
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold tracking-wide text-black shadow-sm"
            onClick={() => router.push("/futbol/nuevo")}
          >
            + Nuevo torneo (Fútbol)
          </button>

          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-extrabold tracking-wide text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            onClick={() => router.push("/voley/nuevo")}
          >
            + Nuevo torneo (Vóley)
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black">
          {!hasAny && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Todavía no creaste torneos.
            </div>
          )}

          {hasAny && (
            <div className="space-y-3">
              {ordered.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-lg font-bold">{t.name}</div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {sportLabel(t.sport)} · Actualizado: {formatDate(t.updatedAt)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-extrabold tracking-wide text-black shadow-sm"
                      onClick={() => {
                        setActiveTournamentId(t.id);
                        if (t.sport === "futbol") router.push("/futbol");
                        else if (t.sport === "voley") router.push("/voley");
                        else router.push("/");
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                      onClick={async () => {
                        const ok = confirm(`¿Eliminar el torneo “${t.name}”?`);
                        if (!ok) return;
                        await apiDeleteTournament(t.id);
                        setItems(await apiListTournaments());
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

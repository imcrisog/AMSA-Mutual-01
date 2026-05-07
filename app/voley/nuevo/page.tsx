"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setActiveTournamentId } from "@/lib/storage";
import { apiCreateTournament } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";

export default function VoleyNuevoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { loading } = useRequireAuth();

  const canContinue = useMemo(() => name.trim().length >= 2, [name]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
        <h1 className="text-3xl font-extrabold tracking-tight">Nuevo torneo (Vóley)</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Elegí un nombre para identificar el borrador.</p>

        <label className="mt-8 block text-sm font-semibold">Nombre del torneo</label>
        <input
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm shadow-sm dark:border-zinc-700"
          placeholder="Ej: Vóley jueves"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            onClick={() => router.push("/tournaments")}
          >
            ← Mis torneos
          </button>

          <button
            className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-sm font-extrabold tracking-wide text-white shadow-sm disabled:opacity-50"
            disabled={!canContinue || loading}
            onClick={async () => {
              try {
                const meta = await apiCreateTournament({ name, sport: "voley" });
                setActiveTournamentId(meta.id);
                router.push("/voley");
              } catch (err) {
                console.error("Failed to create tournament", err);
                alert("No se pudo crear el torneo.");
              }
            }}
          >
            Crear torneo →
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TournamentMeta } from "@/types/tournament";
import { apiFetch } from "@/lib/apiClient";

const TARGET_EMAIL = "daniel@futbol.com";

function sportBadge(sport: TournamentMeta["sport"]) {
  if (sport === "futbol") {
    return {
      label: "Fútbol",
      className:
        "bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 text-emerald-100 ring-1 ring-emerald-400/25",
    };
  }
  if (sport === "voley") {
    return {
      label: "Vóley",
      className:
        "bg-gradient-to-r from-fuchsia-400/20 to-amber-400/20 text-fuchsia-100 ring-1 ring-fuchsia-400/25",
    };
  }
  return {
    label: sport,
    className: "bg-white/10 text-white/80 ring-1 ring-white/15",
  };
}

function formatCompactDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function DanielTorneosPage() {
  const router = useRouter();
  const [items, setItems] = useState<TournamentMeta[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ items: TournamentMeta[] }>("/api/public/daniel/tournaments")
      .then((res) => {
        if (cancelled) return;
        Promise.resolve().then(() => setItems(res.items));
      })
      .catch((err) => {
        console.error("Failed to list tournaments", err);
        if (cancelled) return;
        alert("No se pudieron cargar los torneos de Daniel.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return base;
    return base.filter((t) => t.name.toLowerCase().includes(q) || t.sport.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="min-h-dvh flex-1 bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(900px_circle_at_90%_20%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(900px_circle_at_10%_90%,rgba(34,197,94,0.2),transparent_60%),linear-gradient(to_bottom,#05070e,#000000)] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/15">
                Panel personal
                <span className="text-white/60">·</span>
                <span className="font-mono text-[11px] text-white/80">{TARGET_EMAIL}</span>
              </div>
              <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
                Mis torneos
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
                onClick={() => router.push("/")}
              >
                Volver al inicio
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold tracking-wide text-white/60">
              {loading ? "Cargando torneos…" : `${items.length} torneos`}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o deporte…"
                className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-cyan-400/60 sm:w-[320px]"
              />
              <button
                type="button"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
                onClick={() => {
                  setQuery("");
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </header>

        <section className="mt-10">
          {filtered.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-8 text-white/70 ring-1 ring-white/10">
              No hay torneos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => {
                const badge = sportBadge(t.sport);
                return (
                  <article
                    key={t.id}
                    className="group relative overflow-hidden rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10"
                  >
                    <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/15" />

                    <div>
                      <div className="text-lg font-extrabold tracking-tight">{t.name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-white/50">Actualizado: {formatCompactDate(t.updatedAt)}</span>
                      </div>

                      <button
                        type="button"
                        className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-extrabold ring-1 ring-white/15 transition hover:bg-white/15"
                        onClick={() => router.push(`/daniel/torneos/${t.id}`)}
                      >
                        Ver detalle
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-14 pb-10 text-center text-xs text-white/45">
          Tablero especial para <span className="font-mono">{TARGET_EMAIL}</span> - (1/2/3 columnas).
        </footer>
      </div>
    </div>
  );
}

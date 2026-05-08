"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { StandingsRow, TournamentDraft, TournamentMeta } from "@/types/tournament";
import { apiFetch } from "@/lib/apiClient";
import { applyAttendanceBonus, computeStandings } from "@/lib/tournament";

type PublicTournamentDetail = {
  item: TournamentMeta;
  teams: { name: string; players: { name: string; number: string }[]; photo: string | null }[];
  draft: TournamentDraft | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  if (rows.length === 0) return <div className="text-sm text-white/60">Sin datos.</div>;
  return (
    <div className="w-full min-w-0 max-w-full overscroll-x-contain overflow-x-auto rounded-2xl ring-1 ring-white/10">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-white/60">
          <tr>
            <th className="px-4 py-3">Pos</th>
            <th className="px-4 py-3">Equipo</th>
            <th className="px-4 py-3">PJ</th>
            <th className="px-4 py-3">PG</th>
            <th className="px-4 py-3">PE</th>
            <th className="px-4 py-3">PP</th>
            <th className="px-4 py-3">GF</th>
            <th className="px-4 py-3">GC</th>
            <th className="px-4 py-3">DG</th>
            <th className="px-4 py-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.team} className="border-t border-white/10">
              <td className="px-4 py-3 font-extrabold text-white/70">{idx + 1}</td>
              <td className="px-4 py-3 font-semibold">{r.team}</td>
              <td className="px-4 py-3 text-white/80">{r.played}</td>
              <td className="px-4 py-3 text-white/80">{r.won}</td>
              <td className="px-4 py-3 text-white/80">{r.drawn}</td>
              <td className="px-4 py-3 text-white/80">{r.lost}</td>
              <td className="px-4 py-3 text-white/80">{r.gf}</td>
              <td className="px-4 py-3 text-white/80">{r.ga}</td>
              <td className="px-4 py-3 text-white/80">{r.gd}</td>
              <td className="px-4 py-3 font-extrabold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DanielTorneoDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<PublicTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiFetch<PublicTournamentDetail>(`/api/public/daniel/tournaments/${id}`)
      .then((res) => {
        if (cancelled) return;
        Promise.resolve().then(() => setData(res));
      })
      .catch((err) => {
        console.error("Failed to load public tournament detail", err);
        if (cancelled) return;
        setData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const standings = useMemo(() => {
    const draft = data?.draft;
    if (!draft) return [];

    // Prefer league standings if league exists.
    if (draft.leagueMatches && draft.teams?.length) {
      const teamNames = draft.teams.map((t) => t.name);
      return applyAttendanceBonus(computeStandings(teamNames, draft.leagueMatches), draft.attendanceConfirmed);
    }
    // If groups exist, return Group A standings as a summary.
    const groupA = draft.groups?.A;
    if (groupA) {
      return applyAttendanceBonus(computeStandings(groupA.teams, groupA.matches), draft.attendanceConfirmed);
    }
    return [];
  }, [data]);

  return (
    <div className="min-h-dvh flex-1 overflow-x-hidden bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(900px_circle_at_90%_20%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(900px_circle_at_10%_90%,rgba(34,197,94,0.2),transparent_60%),linear-gradient(to_bottom,#05070e,#000000)] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/15">
              Torneo
              <span className="text-white/60">·</span>
              <span className="font-mono text-[11px] text-white/80">{id}</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {loading ? "Cargando…" : data?.item?.name ?? "No encontrado"}
            </h1>
            {!loading && data?.item && (
              <p className="mt-2 text-sm text-white/70">
                Deporte: <span className="font-semibold">{data.item.sport}</span> · Última actualización: {formatDate(data.item.updatedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
            onClick={() => router.push("/daniel/torneos")}
          >
            ← Volver
          </button>
        </div>

        {!loading && !data && (
          <div className="mt-10 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
            <div className="text-lg font-extrabold">Torneo no encontrado</div>
            <div className="mt-2 text-sm text-white/70">Puede que no exista o no pertenezca a Daniel.</div>
          </div>
        )}

        {data && (
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <section className="min-w-0 lg:col-span-2 space-y-6">
              <div className="min-w-0 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-xs font-semibold tracking-wide text-white/60">Tabla (resumen)</div>
                <div className="mt-4">
                  <StandingsTable rows={standings} />
                </div>
                <div className="mt-3 text-xs text-white/45">
                  Nota: por ahora mostramos una tabla resumen (Liga o Grupo A si aplica).
                </div>
              </div>

              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-xs font-semibold tracking-wide text-white/60">Borrador / estado</div>
                <div className="mt-3 text-sm text-white/70">
                  Formato: <span className="font-semibold">{data.draft?.format ?? "-"}</span>
                  {data.draft?.stage ? (
                    <>
                      {" "}· Etapa: <span className="font-semibold">{data.draft.stage}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-xs font-semibold tracking-wide text-white/60">Equipos</div>
                <div className="mt-4 space-y-3">
                  {(data.teams ?? []).map((t) => (
                    <div key={t.name} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                      <div className="font-extrabold">{t.name}</div>
                      <div className="mt-1 text-xs text-white/60">Jugadores: {t.players.length}</div>
                    </div>
                  ))}
                  {data.teams.length === 0 && <div className="text-sm text-white/60">Sin equipos cargados.</div>}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

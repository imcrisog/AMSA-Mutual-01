"use client";

import { useMemo, useState } from "react";
import type { Match, MatchEventTeamSide, Team } from "@/types/tournament";
import { addCardEvent, addGoalEvent, addSubEvent, removeEvent, sortEvents, teamPlayersByName } from "@/lib/matchEvents";

function parseMinute(raw: string) {
  const v = raw.trim();
  if (v === "") return 0;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function SideChip(props: { side: MatchEventTeamSide; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition " +
        (props.active
          ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100"
          : "border-zinc-200 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70")
      }
    >
      {props.side === "home" ? "Local" : "Visitante"}
    </button>
  );
}

export default function MatchEventsEditor(props: {
  match: Match;
  teams: Team[];
  onChange: (next: Match) => void;
}) {
  const [minute, setMinute] = useState("0");
  const [side, setSide] = useState<MatchEventTeamSide>("home");
  const [playerId, setPlayerId] = useState<string>("");
  const [playerInId, setPlayerInId] = useState<string>("");
  const [playerOutId, setPlayerOutId] = useState<string>("");

  const homePlayers = useMemo(() => teamPlayersByName(props.teams, props.match.home), [props.teams, props.match.home]);
  const awayPlayers = useMemo(() => teamPlayersByName(props.teams, props.match.away), [props.teams, props.match.away]);
  const players = side === "home" ? homePlayers : awayPlayers;

  const resolvedPlayer = useMemo(() => {
    const list = players;
    const found = list.find((p) => p.id === playerId) ?? list[0];
    return found ?? null;
  }, [players, playerId]);

  const resolvedOut = useMemo(() => {
    const found = players.find((p) => p.id === playerOutId) ?? players[0];
    return found ?? null;
  }, [players, playerOutId]);

  const resolvedIn = useMemo(() => {
    const found = players.find((p) => p.id === playerInId) ?? players[1] ?? players[0];
    return found ?? null;
  }, [players, playerInId]);

  const orderedEvents = useMemo(() => sortEvents(props.match.events ?? []), [props.match.events]);

  return (
    <div className="mt-3 rounded-xl border border-white/60 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <SideChip side="home" active={side === "home"} onClick={() => setSide("home")} />
          <SideChip side="away" active={side === "away"} onClick={() => setSide("away")} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-zinc-600 dark:text-white/70">Min</label>
          <input
            className="w-20 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            inputMode="numeric"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          />
        </div>
      </div>

      {players.length === 0 ? (
        <div className="mt-3 text-xs text-zinc-600 dark:text-white/70">
          No hay jugadores cargados para este equipo.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div>
            <div className="text-xs font-semibold text-zinc-600 dark:text-white/70">Jugador</div>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
              value={playerId || players[0]?.id || ""}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
              onClick={() => {
                if (!resolvedPlayer) return;
                props.onChange(
                  addGoalEvent({
                    match: props.match,
                    minute: parseMinute(minute),
                    teamSide: side,
                    player: resolvedPlayer,
                  })
                );
              }}
            >
              + Gol
            </button>
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-black shadow-sm"
              onClick={() => {
                if (!resolvedPlayer) return;
                props.onChange(
                  addCardEvent({
                    match: props.match,
                    minute: parseMinute(minute),
                    teamSide: side,
                    card: "yellow",
                    player: resolvedPlayer,
                  })
                );
              }}
            >
              + Amarilla
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
              onClick={() => {
                if (!resolvedPlayer) return;
                props.onChange(
                  addCardEvent({
                    match: props.match,
                    minute: parseMinute(minute),
                    teamSide: side,
                    card: "blue",
                    player: resolvedPlayer,
                  })
                );
              }}
            >
              + Azul
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
              onClick={() => {
                if (!resolvedPlayer) return;
                props.onChange(
                  addCardEvent({
                    match: props.match,
                    minute: parseMinute(minute),
                    teamSide: side,
                    card: "red",
                    player: resolvedPlayer,
                  })
                );
              }}
            >
              + Roja
            </button>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-600 dark:text-white/70">Cambio</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
                value={playerOutId || players[0]?.id || ""}
                onChange={(e) => setPlayerOutId(e.target.value)}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Sale: {p.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
                value={playerInId || players[1]?.id || players[0]?.id || ""}
                onChange={(e) => setPlayerInId(e.target.value)}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Entra: {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-bold text-zinc-800 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              onClick={() => {
                if (!resolvedOut || !resolvedIn) return;
                if (resolvedOut.id === resolvedIn.id) {
                  alert("En un cambio, el jugador que sale y entra no puede ser el mismo.");
                  return;
                }
                props.onChange(
                  addSubEvent({
                    match: props.match,
                    minute: parseMinute(minute),
                    teamSide: side,
                    playerOut: resolvedOut,
                    playerIn: resolvedIn,
                  })
                );
              }}
            >
              + Cambio
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50">
          Eventos
        </div>
        {orderedEvents.length === 0 ? (
          <div className="mt-2 text-xs text-zinc-600 dark:text-white/70">Sin eventos.</div>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {orderedEvents.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5"
              >
                <div className="text-sm">
                  <span className="font-semibold">{e.minute}{"'"}</span> ·{" "}
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/60">
                    {e.teamSide === "home" ? "LOCAL" : "VISITA"}
                  </span>{" "}
                  —{" "}
                  {e.type === "goal" && (
                    <span>
                      Gol: <span className="font-medium">{e.playerName}</span>
                    </span>
                  )}
                  {(e.type === "yellow" || e.type === "red" || e.type === "blue") && (
                    <span>
                      {e.type === "yellow" ? "Amarilla" : e.type === "red" ? "Roja" : "Azul"}: {" "}
                      <span className="font-medium">{e.playerName}</span>
                    </span>
                  )}
                  {e.type === "sub" && (
                    <span>
                      Cambio: <span className="font-medium">{e.playerOutName}</span> →{" "}
                      <span className="font-medium">{e.playerInName}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                  onClick={() => props.onChange(removeEvent(props.match, e.id))}
                >
                  borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

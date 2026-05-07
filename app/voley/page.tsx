"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Player, Team } from "@/types/tournament";
import { getActiveTournamentId } from "@/lib/storage";
import { apiGetDraft, apiGetTeams, apiListTournaments, apiSetTeams } from "@/lib/tournamentsApi";
import { useRequireAuth } from "@/lib/authRequired";
import VoleyShell from "./_components/VoleyShell";
import VoleyCard from "./_components/VoleyCard";

export default function VoleyPage() {
  const router = useRouter();
  const { loading } = useRequireAuth();
  const [tournamentName, setTournamentName] = useState<string | null>(null);

  const tournamentId = useMemo(() => (typeof window === "undefined" ? null : getActiveTournamentId()), []);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    if (!tournamentId) {
      router.replace("/tournaments");
      return;
    }

    Promise.all([apiGetTeams(tournamentId), apiGetDraft(tournamentId)])
      .then(([t, d]) => {
        if (cancelled) return;
        Promise.resolve().then(() => {
          if (cancelled) return;

          // If tournament already has format + draw saved, jump to resumen.
          if (d?.format && (d.cupRounds || d.leagueMatches || d.groups)) {
            router.replace("/voley/resumen");
            return;
          }

          if (d?.format) {
            router.replace("/voley/sorteo");
            return;
          }

          setTeams(t);
        });
      })
      .catch((err) => {
        console.error("Failed to load tournament state", err);
        alert("No se pudieron cargar los equipos.");
      });

    apiListTournaments()
      .then((list) => {
        const meta = list.find((x) => x.id === tournamentId) ?? null;
        Promise.resolve().then(() => setTournamentName(meta?.name ?? null));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, router, tournamentId]);

  const [teamName, setTeamName] = useState("");
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [teamPhotoName, setTeamPhotoName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");

  const canAddPlayer = useMemo(() => playerName.trim().length > 0, [playerName]);
  const canAddTeam = useMemo(() => teamName.trim().length > 0 && players.length > 0, [teamName, players.length]);

  function addPlayer() {
    if (!playerName.trim()) return;
    const newPlayer: Player = { name: playerName.trim(), number: playerNumber.trim() };
    setPlayers([...players, newPlayer]);
    setPlayerName("");
    setPlayerNumber("");
  }

  function removePlayer(index: number) {
    setPlayers(players.filter((_, i) => i !== index));
  }

  function addTeam() {
    if (!teamName.trim() || players.length === 0) return;
    const newTeam: Team = { name: teamName.trim(), photo: teamPhoto, players };
    setTeams([...teams, newTeam]);
    setTeamName("");
    setPlayers([]);
    setTeamPhoto(null);
    setTeamPhotoName(null);
  }

  function removeTeam(index: number) {
    setTeams(teams.filter((_, i) => i !== index));
  }

  function finishTeams() {
    if (!tournamentId) return;
    apiSetTeams(tournamentId, teams)
      .then(() => router.push("/voley/formato"))
      .catch((err) => {
        console.error("Failed to save teams", err);
        alert("No se pudieron guardar los equipos.");
      });
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTeamPhoto(reader.result as string);
      setTeamPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setTeamPhoto(null);
    setTeamPhotoName(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  return (
    <VoleyShell
      step="equipos"
      title={tournamentName ? `Torneo: ${tournamentName}` : "Torneo de vóley"}
      subtitle="Armá tus equipos, elegí el formato y cargá resultados."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <VoleyCard
          title="Crear equipo"
          subtitle="Nombre, foto (opcional) y al menos 1 jugador."
          right={
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
              Paso 1/4
            </div>
          }
        >
          <label className="mt-4 block text-sm font-medium">Nombre del equipo</label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            placeholder="Ej: Las Panteras"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />

          <label className="mt-4 block text-sm font-medium">Foto (opcional)</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={photoInputRef}
              className="hidden"
              id="teamPhotoVoley"
              type="file"
              accept="image/*"
              onChange={handleImage}
            />

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              onClick={() => photoInputRef.current?.click()}
            >
              Elegir foto
            </button>

            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {teamPhotoName ? teamPhotoName : "Sin archivo seleccionado"}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {teamPhoto ? (
                <Image
                  src={teamPhoto}
                  alt="Previsualización de equipo"
                  width={96}
                  height={96}
                  className="h-24 w-24 object-cover"
                />
              ) : (
                <span className="text-xs text-zinc-500">preview</span>
              )}
            </div>

            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-zinc-700 underline disabled:opacity-50 dark:text-zinc-300"
              onClick={clearImage}
              disabled={!teamPhoto}
            >
              Quitar foto
            </button>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Jugadores</h3>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 sm:col-span-2"
                placeholder="Nombre jugador"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />

              <input
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                placeholder="N° camiseta"
                value={playerNumber}
                onChange={(e) => setPlayerNumber(e.target.value)}
              />
            </div>

            <button
              className="mt-3 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
              onClick={addPlayer}
              disabled={!canAddPlayer}
            >
              Añadir jugador
            </button>

            <ul className="mt-4 space-y-2">
              {players.map((p, i) => (
                <li
                  key={`${p.name}_${i}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span>
                    👕 {p.number || "-"} — {p.name}
                  </span>
                  <button
                    className="text-xs text-zinc-600 underline dark:text-zinc-400"
                    onClick={() => removePlayer(i)}
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 dark:from-white dark:to-white dark:text-black"
            onClick={addTeam}
            disabled={!canAddTeam}
          >
            Añadir equipo
          </button>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Nota: para añadir un equipo se requiere al menos 1 jugador.</p>
        </VoleyCard>

        <VoleyCard
          title="Equipos cargados"
          subtitle="Necesitás mínimo 2 equipos para continuar."
          right={
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
              {teams.length} equipos
            </div>
          }
        >
          <div className="mt-4 space-y-4">
            {teams.length === 0 && <div className="text-sm text-zinc-600 dark:text-zinc-400">Todavía no cargaste equipos.</div>}

            {teams.map((team, i) => (
              <div key={`${team.name}_${i}`} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {team.photo ? (
                      <Image
                        src={team.photo}
                        alt={`Foto de ${team.name}`}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-200 text-xs dark:bg-zinc-800">
                        sin foto
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">Jugadores: {team.players.length}</div>
                    </div>
                  </div>

                  <button className="text-xs text-zinc-600 underline dark:text-zinc-400" onClick={() => removeTeam(i)}>
                    borrar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-sm disabled:opacity-50"
            onClick={finishTeams}
            disabled={teams.length < 2}
          >
            Continuar → Elegir formato
          </button>
        </VoleyCard>
      </div>
    </VoleyShell>
  );
}

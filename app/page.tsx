import Link from "next/link";
import { UserControls } from "./_components/UserControls";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Armador de torneos</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Elegí un deporte para crear un torneo.
            </p>
          </div>
          <UserControls />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/tournaments"
            className="rounded-xl border border-amber-200 bg-amber-50 p-6 transition hover:bg-amber-100/70 dark:border-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
          >
            <div className="text-xl font-semibold">🏆 Mis torneos</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Ver y retomar borradores
            </div>
          </Link>

          <Link
            href="/futbol/nuevo"
            className="rounded-xl border border-zinc-200 p-6 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="text-xl font-semibold">⚽ Fútbol</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Crear equipos + formato (liga o copa)
            </div>
          </Link>

          <Link
            href="/voley/nuevo"
            className="rounded-xl border border-zinc-200 p-6 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="text-xl font-semibold">🏐 Vóley</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Crear torneo
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}


"use client";

import Link from "next/link";

type VoleyStep = "equipos" | "formato" | "sorteo" | "resumen";

function StepDot(props: { active: boolean }) {
  return (
    <span
      className={
        "inline-flex h-2.5 w-2.5 rounded-full " +
        (props.active
          ? "bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.18)]"
          : "bg-zinc-300 dark:bg-white/20")
      }
    />
  );
}

function StepLabel(props: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        "text-xs font-semibold uppercase tracking-widest " +
        (props.active ? "text-sky-700 dark:text-sky-300" : "text-zinc-500 dark:text-white/50")
      }
    >
      {props.children}
    </span>
  );
}

export default function VoleyShell(props: {
  title: string;
  subtitle?: string;
  step: VoleyStep;
  children: React.ReactNode;
}) {
  const is = (s: VoleyStep) => props.step === s;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-6 py-14 text-zinc-900 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-white">
      {/* ambient lights */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-blue-400/15 blur-3xl dark:bg-blue-400/10" />
      </div>

      <header className="relative mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span className="text-base">←</span>
            <span>Inicio</span>
          </Link>

          <div className="flex items-center gap-4 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <StepDot active={is("equipos")} />
              <StepLabel active={is("equipos")}>Equipos</StepLabel>
            </div>
            <span className="text-zinc-300 dark:text-white/20">—</span>
            <div className="flex items-center gap-2">
              <StepDot active={is("formato")} />
              <StepLabel active={is("formato")}>Formato</StepLabel>
            </div>
            <span className="text-zinc-300 dark:text-white/20">—</span>
            <div className="flex items-center gap-2">
              <StepDot active={is("sorteo")} />
              <StepLabel active={is("sorteo")}>Sorteo</StepLabel>
            </div>
            <span className="text-zinc-300 dark:text-white/20">—</span>
            <div className="flex items-center gap-2">
              <StepDot active={is("resumen")} />
              <StepLabel active={is("resumen")}>Resumen</StepLabel>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
            <span className="text-sm">🏐</span>
            Modo torneo
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-sky-200 dark:to-sky-200">
              {props.title}
            </span>
          </h1>

          {props.subtitle && <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-white/70">{props.subtitle}</p>}
        </div>
      </header>

      <main className="relative mx-auto mt-10 w-full max-w-6xl">{props.children}</main>
    </div>
  );
}

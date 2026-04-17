"use client";

export default function FutbolCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_18px_50px_-30px_rgba(2,6,23,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{props.title}</h2>
          {props.subtitle && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-white/70">{props.subtitle}</p>
          )}
        </div>
        {props.right && <div className="shrink-0">{props.right}</div>}
      </div>

      <div className="mt-5">{props.children}</div>
    </section>
  );
}

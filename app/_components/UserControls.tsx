"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logout, me } from "@/lib/authClient";

export function UserControls() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    me()
      .then((u) => setEmail(u?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  if (!email) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          Ingresar
        </Link>
        <Link
          href="/signup"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-2 text-sm font-extrabold tracking-wide text-black shadow-sm"
        >
          Crear cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{email}</div>
      <button
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        onClick={() => {
          logout()
            .then(() => location.reload())
            .catch(() => location.reload());
        }}
      >
        Salir
      </button>
    </div>
  );
}

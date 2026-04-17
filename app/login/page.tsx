"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, me } from "@/lib/authClient";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length > 0, [email, password]);

  useEffect(() => {
    // Avoid `useSearchParams()` to keep this page prerender-safe.
    try {
      const q = new URLSearchParams(window.location.search);
      setNext(q.get("next") || "/");
    } catch {
      setNext("/");
    }
  }, []);

  useEffect(() => {
    // If already logged in, go where user intended.
    me()
      .then((u) => {
        if (u) router.replace(next);
      })
      .catch(() => {
        // ignore
      });
  }, [router, next]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
        <h1 className="text-3xl font-extrabold tracking-tight">Ingresar</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Usá tu email y contraseña.</p>

        <label className="mt-6 block text-sm font-semibold">Email</label>
        <input
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm shadow-sm dark:border-zinc-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label className="mt-4 block text-sm font-semibold">Contraseña</label>
        <input
          type="password"
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm shadow-sm dark:border-zinc-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

        <button
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 dark:from-white dark:to-white dark:text-black"
          disabled={!canSubmit || pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              await login(email, password);
              router.replace(next);
            } catch {
              setError("Credenciales inválidas.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          ¿No tenés cuenta?{" "}
          <Link className="font-semibold underline" href={`/signup?next=${encodeURIComponent(next)}`}>
            Crear cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}

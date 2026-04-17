"use client";

import { apiFetch } from "@/lib/apiClient";

export type AuthedUser = { id: string; email: string };

export async function signup(email: string, password: string): Promise<AuthedUser> {
  const res = await apiFetch<{ ok: true; user: AuthedUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.user;
}

export async function login(email: string, password: string): Promise<AuthedUser> {
  const res = await apiFetch<{ ok: true; user: AuthedUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function me(): Promise<AuthedUser | null> {
  const res = await apiFetch<{ user: AuthedUser | null }>("/api/auth/me");
  return res.user;
}

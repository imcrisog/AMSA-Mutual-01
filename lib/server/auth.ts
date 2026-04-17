import "server-only";

import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { usersCollection } from "@/lib/server/collections";
import { readSessionCookie } from "@/lib/server/session";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  // bcryptjs is pure JS. 10 rounds is a good baseline.
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(params: { password: string; passwordHash: string }) {
  return bcrypt.compare(params.password, params.passwordHash);
}

export async function getAuthedUserId(): Promise<ObjectId | null> {
  const session = await readSessionCookie();
  if (!session) return null;
  try {
    return new ObjectId(session.userId);
  } catch {
    return null;
  }
}

export async function requireAuthedUserId(): Promise<ObjectId> {
  const userId = await getAuthedUserId();
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}

export async function findUserByEmail(email: string) {
  const col = await usersCollection();
  return col.findOne({ email: normalizeEmail(email) });
}

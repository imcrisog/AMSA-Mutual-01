import "server-only";

import { usersCollection, tournamentsCollection } from "@/lib/server/collections";

declare global {
  var __mongoIndexesEnsured: boolean | undefined;
}

export async function ensureMongoIndexes() {
  if (globalThis.__mongoIndexesEnsured) return;

  // NOTE: best-effort. If two requests race here, Mongo will dedupe index creation.
  const users = await usersCollection();
  await users.createIndex({ email: 1 }, { unique: true });

  const tournaments = await tournamentsCollection();
  await tournaments.createIndex({ ownerId: 1, updatedAt: -1 });

  globalThis.__mongoIndexesEnsured = true;
}

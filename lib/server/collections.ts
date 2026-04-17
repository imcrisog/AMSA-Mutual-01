import "server-only";

import type { Collection } from "mongodb";
import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/server/mongo";
import type { Team, TournamentDraft, TournamentMeta, TournamentSport } from "@/types/tournament";

export type DbUser = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type DbTournament = {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  sport: TournamentSport;
  createdAt: Date;
  updatedAt: Date;
  teams: Team[];
  draft: TournamentDraft | null;
};

export function toTournamentMeta(doc: DbTournament): TournamentMeta {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    sport: doc.sport,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function usersCollection(): Promise<Collection<DbUser>> {
  const db = await getMongoDb();
  return db.collection<DbUser>("users");
}

export async function tournamentsCollection(): Promise<Collection<DbTournament>> {
  const db = await getMongoDb();
  return db.collection<DbTournament>("tournaments");
}

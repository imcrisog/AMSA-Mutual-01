import { z } from "zod";
import { ObjectId } from "mongodb";

import { requireAuthedUserId } from "@/lib/server/auth";
import { ensureMongoIndexes } from "@/lib/server/ensureIndexes";
import { tournamentsCollection, toTournamentMeta } from "@/lib/server/collections";

const CreateTournamentSchema = z.object({
  name: z.string().min(2).max(100).transform((v) => v.trim()),
  sport: z.enum(["futbol", "voley"]),
});

export async function GET() {
  await ensureMongoIndexes();
  const ownerId = await requireAuthedUserId();
  const col = await tournamentsCollection();
  const docs = await col
    .find({ ownerId }, { projection: { ownerId: 0, teams: 0, draft: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return Response.json({ items: docs.map(toTournamentMeta) });
}

export async function POST(req: Request) {
  await ensureMongoIndexes();
  const ownerId = await requireAuthedUserId();

  const json = await req.json().catch(() => null);
  const parsed = CreateTournamentSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const col = await tournamentsCollection();
  const _id = new ObjectId();

  await col.insertOne({
    _id,
    ownerId,
    name: parsed.data.name,
    sport: parsed.data.sport,
    createdAt: now,
    updatedAt: now,
    teams: [],
    draft: null,
  });

  return Response.json({ item: toTournamentMeta({
    _id,
    ownerId,
    name: parsed.data.name,
    sport: parsed.data.sport,
    createdAt: now,
    updatedAt: now,
    teams: [],
    draft: null,
  }) });
}

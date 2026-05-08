import { ObjectId } from "mongodb";

import { ensureMongoIndexes } from "@/lib/server/ensureIndexes";
import { findUserByEmail } from "@/lib/server/auth";
import { tournamentsCollection, toTournamentMeta } from "@/lib/server/collections";

const TARGET_EMAIL = "daniel@futbol.com";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureMongoIndexes();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const daniel = await findUserByEmail(TARGET_EMAIL);
  if (!daniel) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const col = await tournamentsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id), ownerId: daniel._id }, { projection: { ownerId: 0 } });
  if (!doc) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({
    item: toTournamentMeta(doc),
    teams: doc.teams,
    draft: doc.draft,
  });
}

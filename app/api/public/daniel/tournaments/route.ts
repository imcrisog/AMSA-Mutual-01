import { ensureMongoIndexes } from "@/lib/server/ensureIndexes";
import { findUserByEmail } from "@/lib/server/auth";
import { tournamentsCollection, toTournamentMeta } from "@/lib/server/collections";

const TARGET_EMAIL = "daniel@futbol.com";

export async function GET() {
  await ensureMongoIndexes();

  const daniel = await findUserByEmail(TARGET_EMAIL);
  if (!daniel) return Response.json({ items: [] });

  const col = await tournamentsCollection();
  const docs = await col
    .find({ ownerId: daniel._id }, { projection: { ownerId: 0, teams: 0, draft: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  return Response.json({ items: docs.map(toTournamentMeta) });
}

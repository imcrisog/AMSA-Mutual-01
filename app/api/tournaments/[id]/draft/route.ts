import { z } from "zod";
import { ObjectId } from "mongodb";

import { requireAuthedUserId } from "@/lib/server/auth";
import { tournamentsCollection } from "@/lib/server/collections";

// We store the draft structure as-is; validate minimally.
const BodySchema = z.object({
  draft: z.any().nullable(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/tournaments/[id]/draft">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const col = await tournamentsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id), ownerId }, { projection: { draft: 1 } });
  if (!doc) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ draft: doc.draft ?? null });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/tournaments/[id]/draft">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const col = await tournamentsCollection();
  const now = new Date();
  const res = await col.updateOne(
    { _id: new ObjectId(id), ownerId },
    { $set: { draft: parsed.data.draft, updatedAt: now } }
  );
  if (res.matchedCount === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}

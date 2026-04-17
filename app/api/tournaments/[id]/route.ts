import { z } from "zod";
import { ObjectId } from "mongodb";

import { requireAuthedUserId } from "@/lib/server/auth";
import { tournamentsCollection, toTournamentMeta } from "@/lib/server/collections";

const RenameSchema = z.object({
  name: z.string().min(2).max(100).transform((v) => v.trim()),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/tournaments/[id]">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const col = await tournamentsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id), ownerId });
  if (!doc) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({
    item: toTournamentMeta(doc),
    teams: doc.teams,
    draft: doc.draft,
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/tournaments/[id]">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = RenameSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const col = await tournamentsCollection();
  const now = new Date();
  const _id = new ObjectId(id);
  const res = await col.updateOne({ _id, ownerId }, { $set: { name: parsed.data.name, updatedAt: now } });
  if (res.matchedCount === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const doc = await col.findOne({ _id, ownerId });
  if (!doc) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({ item: toTournamentMeta(doc) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tournaments/[id]">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const col = await tournamentsCollection();
  const res = await col.deleteOne({ _id: new ObjectId(id), ownerId });
  if (res.deletedCount === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}

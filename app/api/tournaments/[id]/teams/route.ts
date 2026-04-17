import { z } from "zod";
import { ObjectId } from "mongodb";

import { requireAuthedUserId } from "@/lib/server/auth";
import { tournamentsCollection } from "@/lib/server/collections";

const PlayerSchema = z.object({
  name: z.string().min(1).max(80),
  number: z.string().max(10),
});

const TeamSchema = z.object({
  name: z.string().min(1).max(80),
  photo: z.string().nullable(),
  players: z.array(PlayerSchema),
});

const BodySchema = z.object({
  teams: z.array(TeamSchema),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/tournaments/[id]/teams">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const col = await tournamentsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id), ownerId }, { projection: { teams: 1 } });
  if (!doc) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ teams: doc.teams ?? [] });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/tournaments/[id]/teams">) {
  const ownerId = await requireAuthedUserId();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const col = await tournamentsCollection();
  const now = new Date();
  const res = await col.updateOne(
    { _id: new ObjectId(id), ownerId },
    { $set: { teams: parsed.data.teams, updatedAt: now } }
  );
  if (res.matchedCount === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}

import { z } from "zod";
import { ObjectId } from "mongodb";

import { usersCollection } from "@/lib/server/collections";
import { ensureMongoIndexes } from "@/lib/server/ensureIndexes";
import { hashPassword, normalizeEmail } from "@/lib/server/auth";
import { createSessionCookie } from "@/lib/server/session";

const SignupSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  await ensureMongoIndexes();

  const json = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const passwordHash = await hashPassword(parsed.data.password);

  const col = await usersCollection();
  const existing = await col.findOne({ email });
  if (existing) {
    return Response.json({ error: "EMAIL_IN_USE" }, { status: 409 });
  }

  const _id = new ObjectId();
  await col.insertOne({
    _id,
    email,
    passwordHash,
    createdAt: new Date(),
  });

  await createSessionCookie({ userId: _id.toHexString(), email });
  return Response.json({ ok: true, user: { id: _id.toHexString(), email } });
}

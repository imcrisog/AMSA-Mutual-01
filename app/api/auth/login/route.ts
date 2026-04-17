import { z } from "zod";

import { findUserByEmail, normalizeEmail, verifyPassword } from "@/lib/server/auth";
import { createSessionCookie } from "@/lib/server/session";

const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findUserByEmail(email);
  if (!user) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const ok = await verifyPassword({ password: parsed.data.password, passwordHash: user.passwordHash });
  if (!ok) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  await createSessionCookie({ userId: user._id.toHexString(), email: user.email });
  return Response.json({ ok: true, user: { id: user._id.toHexString(), email: user.email } });
}

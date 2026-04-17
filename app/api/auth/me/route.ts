import { readSessionCookie } from "@/lib/server/session";

export async function GET() {
  const session = await readSessionCookie();
  if (!session) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user: { id: session.userId, email: session.email } }, { status: 200 });
}

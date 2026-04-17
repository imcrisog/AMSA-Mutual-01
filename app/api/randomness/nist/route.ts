import { z } from "zod";

const PulseSchema = z
  .object({
    pulse: z
      .object({
        uri: z.string().optional(),
        timeStamp: z.string().optional(),
        pulseIndex: z.number().optional(),
        outputValue: z.string().optional(),
        signatureValue: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Proxies the NIST Randomness Beacon to avoid browser CORS.
 * We only expose the fields we need for verifiable randomness.
 */
export async function GET() {
  const url = "https://beacon.nist.gov/beacon/2.0/pulse/last";

  const res = await fetch(url, {
    // No caching: we want a fresh pulse.
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return Response.json({ error: "NIST_FETCH_FAILED", status: res.status }, { status: 502 });
  }

  const json = await res.json().catch(() => null);
  const parsed = PulseSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "NIST_INVALID_RESPONSE" }, { status: 502 });
  }

  const p = parsed.data.pulse;
  return Response.json({
    source: "nist-beacon" as const,
    fetchedAt: new Date().toISOString(),
    nistPulse: p
      ? {
          uri: p.uri,
          timeStamp: p.timeStamp,
          pulseIndex: p.pulseIndex,
          outputValue: p.outputValue,
          signatureValue: p.signatureValue,
        }
      : null,
  });
}

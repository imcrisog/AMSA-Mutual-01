export type ApiError = {
  status: number;
  body: unknown;
};

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw { status: res.status, body: await parseJsonSafe(res) } satisfies ApiError;
  }

  return (await res.json()) as T;
}

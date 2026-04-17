"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthedUser } from "@/lib/authClient";
import { me } from "@/lib/authClient";

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    me()
      .then((u) => {
        if (cancelled) return;
        if (!u) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setUser(u);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return { user, loading };
}

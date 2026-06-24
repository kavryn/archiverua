"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSession } from "next-auth/react";
import { toSentryUser } from "@/lib/sentry-user";

export default function SentryUserSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    Sentry.setUser(toSentryUser(session?.user));
  }, [session?.user?.id, session?.user?.name, status]);

  return null;
}

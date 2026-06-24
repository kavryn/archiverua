import NextAuth from "next-auth";
import Wikimedia from "next-auth/providers/wikimedia";
import type { DefaultSession, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { cache } from "react";
import { wikiFetch } from "@/lib/wiki-fetch";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

const REFRESH_LEEWAY_SEC = 60;
const INFLIGHT_TTL_MS = 30_000;
// Retry only transient refresh failures (5xx / 429 / network). A permanent 4xx
// (e.g. invalid_grant from a revoked/rotated refresh token) is not retried — it
// would fail identically and only delay the inevitable re-login. Total added
// latency on the failure path stays under INFLIGHT_TTL_MS so a manual retry
// after the inflight entry expires still gets a fresh attempt.
const REFRESH_MAX_RETRIES = 2;
const REFRESH_RETRY_BASE_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Dedup concurrent refreshes against Wikimedia. Wikimedia rotates the refresh
// token on every successful exchange and invalidates the previous one, so two
// parallel requests with the same refresh_token would race: first wins, second
// gets 400. Keyed by the old refresh_token; entries linger 30s after the inflight
// promise settles to absorb late callers (e.g. RSC `auth()` that runs after
// middleware already triggered the refresh in the same request).
const g = globalThis as unknown as {
  _wikiRefreshInflight?: Map<string, Promise<JWT | null>>;
};
const inflight = (g._wikiRefreshInflight ??= new Map());

async function doRefresh(token: JWT): Promise<JWT | null> {
  for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
    const isLastAttempt = attempt === REFRESH_MAX_RETRIES;
    try {
      const res = await wikiFetch("https://meta.wikimedia.org/w/rest.php/oauth2/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refreshToken!,
          client_id: process.env.AUTH_WIKIMEDIA_ID!,
          client_secret: process.env.AUTH_WIKIMEDIA_SECRET!,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "(unreadable)");
        const transient = res.status >= 500 || res.status === 429;
        if (transient && !isLastAttempt) {
          console.warn("[auth] refresh transient failure, retrying", { status: res.status, attempt });
          await sleep(REFRESH_RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        console.error("[auth] refresh failed", { status: res.status, body });
        return null;
      }
      const data = await res.json();
      return {
        ...token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? token.refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      };
    } catch (err) {
      // Network/timeout exception — transient, retry until the budget runs out.
      if (!isLastAttempt) {
        console.warn("[auth] refresh error, retrying", { attempt, err });
        await sleep(REFRESH_RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      console.error("[auth] refresh error", err);
      return null;
    }
  }
  return null;
}

async function refreshOnce(token: JWT): Promise<JWT | null> {
  const key = token.refreshToken!;
  let p = inflight.get(key);
  if (!p) {
    p = doRefresh(token).finally(() => {
      setTimeout(() => inflight.delete(key), INFLIGHT_TTL_MS);
    });
    inflight.set(key, p);
  }
  return p;
}

const nextAuth = NextAuth({
  providers: [
    Wikimedia({
      clientId: process.env.AUTH_WIKIMEDIA_ID!,
      clientSecret: process.env.AUTH_WIKIMEDIA_SECRET!,
      authorization: "https://meta.wikimedia.org/w/rest.php/oauth2/authorize?scope=basic+createeditmovepage+uploadfile",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      const forceExpired = process.env.DEBUG_FORCE_TOKEN_EXPIRED === "1";
      const nowSec = Math.floor(Date.now() / 1000);
      if (!forceExpired && token.expiresAt && token.expiresAt - nowSec > REFRESH_LEEWAY_SEC) {
        return token;
      }

      // Returning null signals Auth.js to clear the session cookie (sessionStore.clean).
      if (!token.refreshToken) return null;
      return refreshOnce(token);
    },
    session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken = token.accessToken;
      // Stable per-user key for the server-side upload-eligibility cache.
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;
export const auth = cache(nextAuth.auth);

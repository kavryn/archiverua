import NextAuth from "next-auth";
import Wikimedia from "next-auth/providers/wikimedia";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { wikiFetch } from "@/lib/wiki-fetch";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
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
      console.error("[refreshAccessToken] Failed to refresh token", {
        status: res.status,
        body,
      });
      return { ...token, error: "RefreshTokenError" };
    }

    const data = await res.json();
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      error: undefined,
    };
  } catch (err) {
    console.error("[refreshAccessToken] Unexpected error", err);
    return { ...token, error: "RefreshTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Wikimedia({
      clientId: process.env.AUTH_WIKIMEDIA_ID!,
      clientSecret: process.env.AUTH_WIKIMEDIA_SECRET!,
      authorization: "https://meta.wikimedia.org/w/rest.php/oauth2/authorize?scope=basic+createeditmovepage+uploadfile",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Token still valid
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }

      // Token expired — refresh
      if (!token.refreshToken) {
        console.error("[jwt] No refresh token available");
        return { ...token, error: "RefreshTokenError" };
      }

      return refreshAccessToken(token);
    },
    session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Auth.js v5 middleware wrapper. Before our fn runs, Auth.js decodes the session
// cookie, invokes the jwt callback (which refreshes the Wikimedia access token if
// expired, see src/auth.ts), re-encodes the JWT, and emits Set-Cookie headers
// (including chunking for large JWEs) on the response we return. We just pass
// through with NextResponse.next() — Auth.js appends its Set-Cookie to it.
//
// Run on every route except static assets and Sentry tunnel. Negative lookahead
// covers new routes by default; /api/auth/* is included so SessionProvider's
// /api/auth/session call (used by useSession().update()) also gets the refresh.
export const proxy = auth(() => NextResponse.next());

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|monitoring).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { method, nextUrl } = request;
  console.log(`[${new Date().toISOString()}] ${method} ${nextUrl.pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

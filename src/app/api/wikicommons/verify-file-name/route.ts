import { auth } from "@/auth";
import { logError } from "@/lib/logger";
import { wikicommons } from "@/lib/wikimedia";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.error === "RefreshTokenError") {
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 401 });
  }
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename) return NextResponse.json({ error: "Missing filename" }, { status: 400 });

  try {
    const [exists, { blacklisted, reason, line }] = await Promise.all([
      wikicommons.fileExists(filename),
      wikicommons.checkTitleBlacklist(filename),
    ]);
    if (blacklisted) {
      logError("wikicommons/verify-file-name blacklist", null, { filename, reason, line });
    }
    return NextResponse.json({ exists, blacklisted });
  } catch (err) {
    logError("wikicommons/verify-file-name", err, { filename });
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

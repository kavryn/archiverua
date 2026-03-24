import { auth } from "@/auth";
import { logError } from "@/lib/logger";
import { wikisource } from "@/lib/wikimedia";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.error === "RefreshTokenError") {
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 401 });
  }
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  try {
    const content = await wikisource.getPageContent(session.accessToken, title);
    if (content === null) return NextResponse.json({ name: null, exists: false });

    const match = content.match(/\|\s*назва\s*=\s*([^\n|{}]+)/);

    return NextResponse.json({ name: match ? match[1].trim() : null, exists: true });
  } catch (err) {
    logError("wikisource/name", err, { title });
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

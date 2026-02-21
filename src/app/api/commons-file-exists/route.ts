import { auth } from "@/auth";
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

  const commonsApi =
    process.env.NEXT_PUBLIC_COMMONS_API_URL ?? "https://commons.wikimedia.org/w/api.php";

  const params = new URLSearchParams({
    action: "query",
    titles: `File:${filename}`,
    prop: "info",
    format: "json",
  });

  const res = await fetch(`${commonsApi}?${params}`, {
    headers: { "User-Agent": "archiverua/1.0" },
  });
  const data = await res.json();

  const pages = data?.query?.pages;
  if (!pages) return NextResponse.json({ exists: false });

  const page = Object.values(pages)[0] as Record<string, unknown>;
  const exists = !("missing" in page);
  return NextResponse.json({ exists });
}

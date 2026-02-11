import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: title,
      format: "json",
    });

    const res = await fetch(`https://uk.wikisource.org/w/api.php?${params}`, {
      headers: { "User-Agent": "archiverua/1.0" },
    });
    const data = await res.json();

    const pages = data?.query?.pages;
    if (!pages) return NextResponse.json({ name: null, exists: false });

    const page = Object.values(pages)[0] as Record<string, unknown>;
    if ("missing" in page) return NextResponse.json({ name: null, exists: false });

    const revisions = page?.revisions as Array<Record<string, unknown>> | undefined;
    const firstRev = revisions?.[0];
    const slots = firstRev?.slots as Record<string, Record<string, string>> | undefined;
    const content: string = slots?.main?.["*"] ?? (firstRev?.["*"] as string) ?? "";
    const match = content.match(/\|\s*назва\s*=\s*([^\n|{}]+)/);

    return NextResponse.json({ name: match ? match[1].trim() : null, exists: true });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

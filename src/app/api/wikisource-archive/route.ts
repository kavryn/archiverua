import { auth } from "@/auth";
import { getWikisourceCsrfToken } from "@/lib/wikimedia";
import { updateArchivePage } from "@/lib/wikisource-archive";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const { archiveAbbr, archiveName, fond, fondName } = body;

  if (!archiveAbbr || !fond) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  try {
    const csrfToken = await getWikisourceCsrfToken(session.accessToken);
    const result = await updateArchivePage({
      accessToken: session.accessToken,
      csrfToken,
      archiveAbbr,
      archiveName: archiveName ?? "",
      fond,
      fondName: fondName ?? "",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Помилка оновлення сторінки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

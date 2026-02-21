import { auth } from "@/auth";
import { getWikisourceCsrfToken } from "@/lib/wikimedia";
import { updateFondPage } from "@/lib/wikisource-fond";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.error === "RefreshTokenError") {
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 401 });
  }
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const { archiveAbbr, fond, opis, opisName, fondName } = body;

  if (!archiveAbbr || !fond || !opis) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  try {
    const csrfToken = await getWikisourceCsrfToken(session.accessToken);
    const result = await updateFondPage({
      accessToken: session.accessToken,
      csrfToken,
      archiveAbbr,
      fond,
      opis,
      opisName: opisName ?? "",
      fondName: fondName ?? "",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Помилка оновлення сторінки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

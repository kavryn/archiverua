import { auth } from "@/auth";
import { getWikisourceCsrfToken } from "@/lib/wikimedia";
import { updateOpysPage } from "@/lib/wikisource-opys";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const { archiveAbbr, fond, opis, sprava, spravaName, opisName, dates } = body;

  if (!archiveAbbr || !fond || !opis || !sprava) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  try {
    const csrfToken = await getWikisourceCsrfToken(session.accessToken);
    const result = await updateOpysPage({
      accessToken: session.accessToken,
      csrfToken,
      archiveAbbr,
      fond,
      opis,
      sprava: String(sprava),
      spravaName: spravaName ?? "",
      opisName: opisName ?? "",
      dates: dates ?? "",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Помилка оновлення сторінки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
